import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import mammoth from 'mammoth';
import { db, sha256 } from './db.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
const TTS_CACHE = join(DATA_DIR, 'tts-cache');
mkdirSync(TTS_CACHE, { recursive: true });
const PIPER_BIN = process.env.PIPER_BIN || 'piper';
const PIPER_MODEL = process.env.PIPER_MODEL || join(ROOT, 'voices', 'en_US-lessac-medium.onnx');
const PIPER_OK = existsSync(PIPER_MODEL);

const app = express();
app.use(express.json({ limit: '15mb' })); // photos for page-scanning are base64 in the JSON body
app.use(express.static(join(ROOT, 'public')));

// ---------- helpers ----------

// Days until next review after reaching each Leitner box
const INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
const MASTERED_BOX = 5;

const normalize = (s) => String(s).trim().toLowerCase();
const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
const today = () => new Date().toISOString().slice(0, 10);

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Apply a result to a student's Leitner state. Words and flashcards each
// have their own progress table but share the same scheduling rules.
function leitnerUpdater(table, idCol) {
  const select = db.prepare(`SELECT box FROM ${table} WHERE student_id = ? AND ${idCol} = ?`);
  const upsert = db.prepare(`
    INSERT INTO ${table} (student_id, ${idCol}, box, due, attempts, correct)
    VALUES (?, ?, ?, date('now', ?), 1, ?)
    ON CONFLICT (student_id, ${idCol}) DO UPDATE SET
      box = excluded.box,
      due = excluded.due,
      attempts = attempts + 1,
      correct = correct + excluded.correct
  `);
  return (studentId, itemId, correct) => {
    const row = select.get(studentId, itemId);
    const box = correct ? Math.min((row ? row.box : 0) + 1, MASTERED_BOX) : 1;
    const days = correct ? INTERVALS[box] : 0;
    upsert.run(studentId, itemId, box, `+${days} days`, correct ? 1 : 0);
    return box;
  };
}
const updateProgress = leitnerUpdater('progress', 'word_id');
const updateCardProgress = leitnerUpdater('card_progress', 'card_id');

// Parent-only routes must send the PIN in the x-pin header
function requirePin(req, res, next) {
  const stored = db.prepare(`SELECT value FROM settings WHERE key = 'pin'`).get().value;
  if (sha256(req.get('x-pin') || '') !== stored) {
    return res.status(401).json({ error: 'Wrong PIN' });
  }
  next();
}

// Mark a scheduled agenda entry for this student/item/date as done, if one exists
const markScheduleDone = db.prepare(`
  UPDATE schedule SET done = 1, done_at = datetime('now')
  WHERE student_id = ? AND item_id = ? AND date = ?
`);

const ITEM_TYPES = ['lesson', 'assignment', 'quiz', 'spelling_practice', 'spelling_test', 'flashcards'];
const GRADABLE_TYPES = ['assignment', 'quiz', 'spelling_test'];

// ---------- kid picker ----------

app.get('/api/students', (req, res) => {
  res.json(db.prepare(`SELECT id, name, emoji, theme, streak_count, streak_date FROM students ORDER BY name`).all());
});

app.patch('/api/students/:id/theme', (req, res) => {
  const theme = ['blue','green','purple','orange','pink'].includes(req.body.theme) ? req.body.theme : 'blue';
  db.prepare(`UPDATE students SET theme = ? WHERE id = ?`).run(theme, req.params.id);
  res.json({ ok: true });
});

app.post('/api/students/:id/complete-day', (req, res) => {
  const student = db.prepare(`SELECT streak_date, streak_count, best_streak FROM students WHERE id = ?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  const t = today();
  if (student.streak_date === t) return res.json({ streak: student.streak_count, best: student.best_streak, alreadyCounted: true });
  const d = new Date(t + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  const newStreak = student.streak_date === yesterday ? student.streak_count + 1 : 1;
  const newBest = Math.max(newStreak, student.best_streak);
  db.prepare(`UPDATE students SET streak_date = ?, streak_count = ?, best_streak = ? WHERE id = ?`)
    .run(t, newStreak, newBest, req.params.id);
  res.json({ streak: newStreak, best: newBest, alreadyCounted: false });
});

// ---------- spelling module ----------

// Everything the standalone spelling home screen needs
app.get('/api/state/:studentId', (req, res) => {
  const id = req.params.studentId;
  const student = db.prepare(`SELECT id, name, emoji FROM students WHERE id = ?`).get(id);
  if (!student) return res.status(404).json({ error: 'No such student' });

  const assignment = db.prepare(`
    SELECT l.id, l.name FROM assignments a JOIN lists l ON l.id = a.list_id
    WHERE a.student_id = ?
  `).get(id);

  let listProgress = null;
  if (assignment) {
    listProgress = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN COALESCE(p.box, 0) >= ${MASTERED_BOX} THEN 1 ELSE 0 END) AS mastered
      FROM words w
      LEFT JOIN progress p ON p.word_id = w.id AND p.student_id = ?
      WHERE w.list_id = ?
    `).get(id, assignment.id);
  }

  // only words outside this week's list count as "old reviews"
  const dueReviews = db.prepare(`
    SELECT COUNT(*) AS n FROM progress p JOIN words w ON w.id = p.word_id
    WHERE p.student_id = ? AND w.list_id <> ? AND p.box < ${MASTERED_BOX}
      AND date(p.due) <= date('now')
  `).get(id, assignment ? assignment.id : -1).n;

  res.json({ student, assignment, listProgress, dueReviews });
});

// Build a practice session: the target list's unmastered words + due reviews.
// listId overrides the student's pinned weekly assignment (used when launched from a course item).
app.get('/api/session/:studentId', (req, res) => {
  const id = req.params.studentId;
  let listId = req.query.listId ? Number(req.query.listId) : null;
  if (!listId) {
    const assignment = db.prepare(`SELECT list_id FROM assignments WHERE student_id = ?`).get(id);
    listId = assignment ? assignment.list_id : -1;
  }

  const weekWords = db.prepare(`
    SELECT w.id, w.word, w.sentence, w.definition, COALESCE(p.box, 0) AS box
    FROM words w
    LEFT JOIN progress p ON p.word_id = w.id AND p.student_id = ?
    WHERE w.list_id = ? AND COALESCE(p.box, 0) < ${MASTERED_BOX}
    ORDER BY box, RANDOM()
    LIMIT 10
  `).all(id, listId);

  const reviews = db.prepare(`
    SELECT w.id, w.word, w.sentence, w.definition, p.box
    FROM progress p JOIN words w ON w.id = p.word_id
    WHERE p.student_id = ? AND w.list_id <> ? AND p.box < ${MASTERED_BOX}
      AND date(p.due) <= date('now')
    ORDER BY p.due
    LIMIT 5
  `).all(id, listId);

  res.json({ words: shuffle([...weekWords, ...reviews]) });
});

// Grade one practice answer. firstTry attempts move the Leitner box;
// look-cover-write-check retypes are recorded but don't.
app.post('/api/attempt', (req, res) => {
  const { studentId, wordId, typed, firstTry } = req.body;
  const word = db.prepare(`SELECT word FROM words WHERE id = ?`).get(wordId);
  if (!word) return res.status(404).json({ error: 'No such word' });

  const correct = normalize(typed) === normalize(word.word);
  db.prepare(`INSERT INTO attempts (student_id, word_id, typed, correct, mode) VALUES (?, ?, ?, ?, ?)`)
    .run(studentId, wordId, String(typed), correct ? 1 : 0, firstTry ? 'practice' : 'retype');

  let box = null;
  if (firstTry) box = updateProgress(studentId, wordId, correct);
  res.json({ correct, word: word.word, box });
});

// ---------- spelling test (Friday test, or a course spelling_test item) ----------

app.get('/api/test/:studentId', (req, res) => {
  let list;
  if (req.query.listId) {
    list = db.prepare(`SELECT id, name FROM lists WHERE id = ?`).get(req.query.listId);
  } else {
    list = db.prepare(`
      SELECT l.id, l.name FROM assignments a JOIN lists l ON l.id = a.list_id
      WHERE a.student_id = ?
    `).get(req.params.studentId);
  }
  if (!list) return res.status(404).json({ error: 'No list assigned' });

  const words = db.prepare(`SELECT id, word, sentence, definition FROM words WHERE list_id = ?`).all(list.id);
  res.json({ list, words: shuffle(words) });
});

app.post('/api/test/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const { listId, answers, itemId, date } = req.body; // answers: [{ wordId, typed }]
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'No answers' });
  }

  const getWord = db.prepare(`SELECT word FROM words WHERE id = ?`);
  const graded = answers.map((a) => {
    const w = getWord.get(a.wordId);
    return { ...a, word: w.word, correct: normalize(a.typed) === normalize(w.word) };
  });
  const score = graded.filter((g) => g.correct).length;

  const testId = db.prepare(`INSERT INTO tests (student_id, list_id, score, total) VALUES (?, ?, ?, ?)`)
    .run(studentId, listId, score, graded.length).lastInsertRowid;
  const insAnswer = db.prepare(`INSERT INTO test_answers (test_id, word_id, typed, correct) VALUES (?, ?, ?, ?)`);
  for (const g of graded) {
    insAnswer.run(testId, g.wordId, String(g.typed), g.correct ? 1 : 0);
    updateProgress(studentId, g.wordId, g.correct); // missed test words come back in practice
  }

  // if this test was launched from a course item, record it in the gradebook too
  if (itemId) {
    db.prepare(`
      INSERT INTO submissions (student_id, item_id, status, score, points_possible, completed_at, graded_at)
      VALUES (?, ?, 'graded', ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT (student_id, item_id) DO UPDATE SET
        status = 'graded', score = excluded.score, points_possible = excluded.points_possible,
        completed_at = datetime('now'), graded_at = datetime('now')
    `).run(studentId, itemId, score, graded.length);
    db.prepare(`INSERT INTO submission_history (student_id, item_id, score, points_possible) VALUES (?, ?, ?, ?)`)
      .run(studentId, itemId, score, graded.length);
    markScheduleDone.run(studentId, itemId, isDateStr(date) ? date : today());
  }

  res.json({ testId, score, total: graded.length, graded });
});

// Full detail for the printable report
app.get('/api/test-report/:testId', (req, res) => {
  const test = db.prepare(`
    SELECT t.id, t.score, t.total, t.at, s.name AS student, l.name AS list
    FROM tests t JOIN students s ON s.id = t.student_id JOIN lists l ON l.id = t.list_id
    WHERE t.id = ?
  `).get(req.params.testId);
  if (!test) return res.status(404).json({ error: 'No such test' });

  test.answers = db.prepare(`
    SELECT w.word, ta.typed, ta.correct
    FROM test_answers ta JOIN words w ON w.id = ta.word_id
    WHERE ta.test_id = ?
    ORDER BY w.word
  `).all(req.params.testId);
  res.json(test);
});

// ---------- word lists (read is public, kids never write) ----------

app.get('/api/lists', (req, res) => {
  res.json(db.prepare(`
    SELECT l.id, l.name, l.builtin, COUNT(w.id) AS wordCount
    FROM lists l LEFT JOIN words w ON w.list_id = l.id
    GROUP BY l.id ORDER BY l.builtin, l.name
  `).all());
});

app.get('/api/lists/:id', (req, res) => {
  const list = db.prepare(`SELECT id, name, builtin FROM lists WHERE id = ?`).get(req.params.id);
  if (!list) return res.status(404).json({ error: 'No such list' });
  list.words = db.prepare(`SELECT id, word, sentence, definition FROM words WHERE list_id = ? ORDER BY id`).all(req.params.id);
  res.json(list);
});

app.post('/api/lists', requirePin, (req, res) => {
  const { name, words } = req.body;
  if (!name || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'Name and at least one word required' });
  }
  const id = db.prepare(`INSERT INTO lists (name, builtin) VALUES (?, 0)`).run(String(name).trim()).lastInsertRowid;
  const ins = db.prepare(`INSERT INTO words (list_id, word, sentence, definition) VALUES (?, ?, ?, ?)`);
  for (const w of words) ins.run(id, String(w.word).trim(), String(w.sentence || '').trim(), String(w.definition || '').trim());
  res.json({ id });
});

app.put('/api/lists/:id', requirePin, (req, res) => {
  const { name, words } = req.body;
  const id = req.params.id;
  if (!db.prepare(`SELECT id FROM lists WHERE id = ?`).get(id)) {
    return res.status(404).json({ error: 'No such list' });
  }
  db.prepare(`UPDATE lists SET name = ? WHERE id = ?`).run(String(name).trim(), id);
  db.prepare(`DELETE FROM words WHERE list_id = ?`).run(id);
  const ins = db.prepare(`INSERT INTO words (list_id, word, sentence, definition) VALUES (?, ?, ?, ?)`);
  for (const w of words) ins.run(id, String(w.word).trim(), String(w.sentence || '').trim(), String(w.definition || '').trim());
  res.json({ ok: true });
});

app.delete('/api/lists/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM lists WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- flashcards module ----------

app.get('/api/decks', (req, res) => {
  res.json(db.prepare(`
    SELECT d.id, d.name, d.builtin, COUNT(c.id) AS cardCount
    FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
    GROUP BY d.id ORDER BY d.builtin, d.name
  `).all());
});

app.get('/api/decks/:id', (req, res) => {
  const deck = db.prepare(`SELECT id, name, builtin FROM decks WHERE id = ?`).get(req.params.id);
  if (!deck) return res.status(404).json({ error: 'No such deck' });
  deck.cards = db.prepare(`SELECT id, front, back FROM cards WHERE deck_id = ? ORDER BY id`).all(req.params.id);
  res.json(deck);
});

app.post('/api/decks', requirePin, (req, res) => {
  const { name, cards } = req.body;
  if (!name || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'Name and at least one card required' });
  }
  const id = db.prepare(`INSERT INTO decks (name, builtin) VALUES (?, 0)`).run(String(name).trim()).lastInsertRowid;
  const ins = db.prepare(`INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)`);
  for (const c of cards) ins.run(id, String(c.front).trim(), String(c.back).trim());
  res.json({ id });
});

app.put('/api/decks/:id', requirePin, (req, res) => {
  const { name, cards } = req.body;
  const id = req.params.id;
  if (!db.prepare(`SELECT id FROM decks WHERE id = ?`).get(id)) {
    return res.status(404).json({ error: 'No such deck' });
  }
  db.prepare(`UPDATE decks SET name = ? WHERE id = ?`).run(String(name).trim(), id);
  db.prepare(`DELETE FROM cards WHERE deck_id = ?`).run(id);
  const ins = db.prepare(`INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)`);
  for (const c of cards) ins.run(id, String(c.front).trim(), String(c.back).trim());
  res.json({ ok: true });
});

app.delete('/api/decks/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM decks WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// Due + new cards from one deck, capped per session
app.get('/api/flashcards/session/:studentId', (req, res) => {
  const cards = db.prepare(`
    SELECT c.id, c.front, c.back, COALESCE(p.box, 0) AS box
    FROM cards c
    LEFT JOIN card_progress p ON p.card_id = c.id AND p.student_id = ?
    WHERE c.deck_id = ? AND COALESCE(p.box, 0) < ${MASTERED_BOX}
      AND (p.due IS NULL OR date(p.due) <= date('now'))
    ORDER BY box, RANDOM()
    LIMIT 20
  `).all(req.params.studentId, req.query.deckId);
  res.json({ cards: shuffle(cards) });
});

app.post('/api/flashcards/grade', (req, res) => {
  const { studentId, cardId, gotIt } = req.body;
  if (!db.prepare(`SELECT id FROM cards WHERE id = ?`).get(cardId)) {
    return res.status(404).json({ error: 'No such card' });
  }
  const box = updateCardProgress(studentId, cardId, !!gotIt);
  res.json({ ok: true, box });
});

// ---------- parent account API ----------

app.post('/api/parent/verify', (req, res) => {
  const stored = db.prepare(`SELECT value FROM settings WHERE key = 'pin'`).get().value;
  res.json({ ok: sha256(req.body.pin || '') === stored });
});

app.post('/api/parent/pin', requirePin, (req, res) => {
  const pin = String(req.body.newPin || '');
  if (pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  db.prepare(`UPDATE settings SET value = ? WHERE key = 'pin'`).run(sha256(pin));
  res.json({ ok: true });
});

app.post('/api/students', requirePin, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = db.prepare(`INSERT INTO students (name, emoji) VALUES (?, ?)`)
    .run(name, req.body.emoji || '🙂').lastInsertRowid;
  res.json({ id });
});

app.put('/api/students/:id', requirePin, (req, res) => {
  const { emoji, theme } = req.body;
  if (emoji) db.prepare(`UPDATE students SET emoji = ? WHERE id = ?`).run(String(emoji), req.params.id);
  if (theme && ['blue','green','purple','orange','pink'].includes(theme))
    db.prepare(`UPDATE students SET theme = ? WHERE id = ?`).run(theme, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/students/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM students WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/assign', requirePin, (req, res) => {
  const { studentId, listId } = req.body;
  db.prepare(`
    INSERT INTO assignments (student_id, list_id) VALUES (?, ?)
    ON CONFLICT (student_id) DO UPDATE SET list_id = excluded.list_id, assigned_at = datetime('now')
  `).run(studentId, listId);
  res.json({ ok: true });
});

// Legacy spelling-only dashboard summary
app.get('/api/overview', requirePin, (req, res) => {
  const students = db.prepare(`SELECT id, name, emoji FROM students ORDER BY name`).all();
  for (const s of students) {
    s.assignment = db.prepare(`
      SELECT l.id, l.name FROM assignments a JOIN lists l ON l.id = a.list_id WHERE a.student_id = ?
    `).get(s.id) || null;
    s.mastered = db.prepare(
      `SELECT COUNT(*) AS n FROM progress WHERE student_id = ? AND box >= ${MASTERED_BOX}`
    ).get(s.id).n;
    s.tests = db.prepare(`
      SELECT t.id, t.score, t.total, t.at, l.name AS list
      FROM tests t JOIN lists l ON l.id = t.list_id
      WHERE t.student_id = ? ORDER BY t.at DESC LIMIT 20
    `).all(s.id);
  }
  res.json({ students });
});

// ============================================================
// LMS layer: courses, units, items, submissions, gradebook
// ============================================================

// ---------- courses (admin) ----------

app.get('/api/admin/courses', requirePin, (req, res) => {
  res.json(db.prepare(`
    SELECT c.id, c.name, c.subject, c.color, c.archived,
           (SELECT COUNT(*) FROM units u WHERE u.course_id = c.id) AS unitCount,
           (SELECT COUNT(*) FROM items i JOIN units u ON u.id = i.unit_id WHERE u.course_id = c.id) AS itemCount
    FROM courses c ORDER BY c.archived, c.name
  `).all());
});

app.post('/api/courses', requirePin, (req, res) => {
  const { name, subject, color } = req.body;
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name required' });
  const id = db.prepare(`INSERT INTO courses (name, subject, color) VALUES (?, ?, ?)`)
    .run(String(name).trim(), String(subject || '').trim(), color || '#4f86f7').lastInsertRowid;
  res.json({ id });
});

app.put('/api/courses/:id', requirePin, (req, res) => {
  const { name, subject, color, archived } = req.body;
  if (!db.prepare(`SELECT id FROM courses WHERE id = ?`).get(req.params.id)) {
    return res.status(404).json({ error: 'No such course' });
  }
  db.prepare(`UPDATE courses SET name = ?, subject = ?, color = ?, archived = ? WHERE id = ?`)
    .run(String(name).trim(), String(subject || '').trim(), color || '#4f86f7', archived ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/courses/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM courses WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/courses/:id/enroll', requirePin, (req, res) => {
  db.prepare(`INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)`)
    .run(req.body.studentId, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/courses/:id/enroll/:studentId', requirePin, (req, res) => {
  db.prepare(`DELETE FROM enrollments WHERE student_id = ? AND course_id = ?`)
    .run(req.params.studentId, req.params.id);
  res.json({ ok: true });
});

// Full course structure for the admin course editor (no student-specific filtering)
app.get('/api/admin/courses/:id', requirePin, (req, res) => {
  const course = db.prepare(`SELECT id, name, subject, color, archived FROM courses WHERE id = ?`).get(req.params.id);
  if (!course) return res.status(404).json({ error: 'No such course' });
  const units = db.prepare(`SELECT id, name, sort FROM units WHERE course_id = ? ORDER BY sort, id`).all(req.params.id);
  const itemStmt = db.prepare(`SELECT id, type, title, points, ref_id, sort, due_date, allow_retakes, prereq_item_id FROM items WHERE unit_id = ? ORDER BY sort, id`);
  for (const u of units) u.items = itemStmt.all(u.id);
  res.json({ ...course, units });
});

// Full item detail for the admin item editor (quiz correct answers always included)
app.get('/api/admin/items/:id', requirePin, (req, res) => {
  const item = db.prepare(`SELECT id, unit_id, type, title, body, points, ref_id, due_date, allow_retakes, prereq_item_id, evidence_mode, retake_policy FROM items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No such item' });
  if (item.type === 'quiz') {
    item.questions = db.prepare(`
      SELECT id, type, prompt, choices, correct_answer, points FROM quiz_questions WHERE item_id = ? ORDER BY sort, id
    `).all(req.params.id).map((q) => ({ ...q, choices: JSON.parse(q.choices) }));
  }
  res.json(item);
});

app.get('/api/courses/:id/roster', requirePin, (req, res) => {
  res.json(db.prepare(`
    SELECT s.id, s.name, s.emoji, (e.student_id IS NOT NULL) AS enrolled
    FROM students s LEFT JOIN enrollments e ON e.student_id = s.id AND e.course_id = ?
    ORDER BY s.name
  `).all(req.params.id));
});

// ---------- units (admin) ----------

app.post('/api/units', requirePin, (req, res) => {
  const { courseId, name } = req.body;
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name required' });
  const sort = db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM units WHERE course_id = ?`).get(courseId).n;
  const id = db.prepare(`INSERT INTO units (course_id, name, sort) VALUES (?, ?, ?)`)
    .run(courseId, String(name).trim(), sort).lastInsertRowid;
  res.json({ id });
});

app.put('/api/units/:id', requirePin, (req, res) => {
  const { name, sort } = req.body;
  db.prepare(`UPDATE units SET name = COALESCE(?, name), sort = COALESCE(?, sort) WHERE id = ?`)
    .run(name ? String(name).trim() : null, Number.isInteger(sort) ? sort : null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/units/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM units WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- items (admin) ----------

function validateItemBody(body) {
  const { type, title, refId } = body;
  if (!ITEM_TYPES.includes(type)) return 'Invalid item type';
  if (!String(title || '').trim()) return 'Title required';
  if (type === 'spelling_practice' || type === 'spelling_test') {
    if (!db.prepare(`SELECT id FROM lists WHERE id = ?`).get(refId)) return 'Pick a word list';
  }
  if (type === 'flashcards' && !db.prepare(`SELECT id FROM decks WHERE id = ?`).get(refId)) {
    return 'Pick a deck';
  }
  if (type === 'quiz' && (!Array.isArray(body.questions) || body.questions.length === 0)) {
    return 'Quiz needs at least one question';
  }
  return null;
}

function saveQuizQuestions(itemId, questions) {
  db.prepare(`DELETE FROM quiz_questions WHERE item_id = ?`).run(itemId);
  const ins = db.prepare(`
    INSERT INTO quiz_questions (item_id, type, prompt, choices, correct_answer, points, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  questions.forEach((q, i) => {
    ins.run(
      itemId,
      q.type,
      String(q.prompt).trim(),
      JSON.stringify(q.type === 'mc' ? (q.choices || []) : []),
      String(q.correctAnswer).trim(),
      Number(q.points) || 1,
      i
    );
  });
}

app.post('/api/items', requirePin, (req, res) => {
  const err = validateItemBody(req.body);
  if (err) return res.status(400).json({ error: err });
  const { unitId, type, title, body, points, refId, dueDate, allowRetakes, prereqItemId, evidenceMode, retakePolicy } = req.body;
  const sort = db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM items WHERE unit_id = ?`).get(unitId).n;
  const id = db.prepare(`
    INSERT INTO items (unit_id, type, title, body, points, ref_id, sort, due_date, allow_retakes, prereq_item_id, evidence_mode, retake_policy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(unitId, type, String(title).trim(), String(body || ''), Number(points) || 0,
         (type === 'flashcards' || type === 'spelling_practice' || type === 'spelling_test') ? refId : null,
         sort, dueDate || null, allowRetakes ? 1 : 0, prereqItemId || null,
         evidenceMode || 'none', retakePolicy || 'latest').lastInsertRowid;
  if (type === 'quiz') {
    saveQuizQuestions(id, req.body.questions);
    const totalPoints = req.body.questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
    db.prepare(`UPDATE items SET points = ? WHERE id = ?`).run(totalPoints, id);
  }
  res.json({ id });
});

app.put('/api/items/:id', requirePin, (req, res) => {
  const err = validateItemBody(req.body);
  if (err) return res.status(400).json({ error: err });
  if (!db.prepare(`SELECT id FROM items WHERE id = ?`).get(req.params.id)) {
    return res.status(404).json({ error: 'No such item' });
  }
  const { type, title, body, points, refId, dueDate, allowRetakes, prereqItemId, evidenceMode, retakePolicy } = req.body;
  const finalPoints = type === 'quiz'
    ? req.body.questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0)
    : (Number(points) || 0);
  db.prepare(`UPDATE items SET type = ?, title = ?, body = ?, points = ?, ref_id = ?, due_date = ?, allow_retakes = ?, prereq_item_id = ?, evidence_mode = ?, retake_policy = ? WHERE id = ?`)
    .run(type, String(title).trim(), String(body || ''), finalPoints,
         (type === 'flashcards' || type === 'spelling_practice' || type === 'spelling_test') ? refId : null,
         dueDate || null, allowRetakes ? 1 : 0, prereqItemId || null,
         evidenceMode || 'none', retakePolicy || 'latest', req.params.id);
  if (type === 'quiz') saveQuizQuestions(req.params.id, req.body.questions);
  res.json({ ok: true });
});

app.delete('/api/items/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM items WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- kid course views ----------

// Enrolled courses with rough completion progress
app.get('/api/courses/mine/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const courses = db.prepare(`
    SELECT c.id, c.name, c.subject, c.color
    FROM courses c JOIN enrollments e ON e.course_id = c.id
    WHERE e.student_id = ? AND c.archived = 0
    ORDER BY c.name
  `).all(studentId);
  for (const c of courses) {
    const totals = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END) AS done
      FROM items i
      JOIN units u ON u.id = i.unit_id
      LEFT JOIN submissions s ON s.item_id = i.id AND s.student_id = ?
      WHERE u.course_id = ?
    `).get(studentId, c.id);
    c.total = totals.total;
    c.done = totals.done || 0;
  }
  res.json(courses);
});

// Full course outline with per-item status for this student
app.get('/api/courses/:id/detail', (req, res) => {
  const studentId = req.query.studentId;
  const course = db.prepare(`SELECT id, name, subject, color FROM courses WHERE id = ?`).get(req.params.id);
  if (!course) return res.status(404).json({ error: 'No such course' });

  const units = db.prepare(`SELECT id, name, sort FROM units WHERE course_id = ? ORDER BY sort, id`).all(req.params.id);
  const itemStmt = db.prepare(`
    SELECT i.id, i.type, i.title, i.points, i.sort, i.due_date, i.allow_retakes, i.prereq_item_id,
           s.status, s.score, s.points_possible
    FROM items i
    LEFT JOIN submissions s ON s.item_id = i.id AND s.student_id = ?
    WHERE i.unit_id = ? ORDER BY i.sort, i.id
  `);
  for (const u of units) {
    u.items = itemStmt.all(studentId, u.id).map((it) => ({ ...it, status: it.status || 'not_started' }));
  }
  // Build submission map for prereq locking
  const subMap = {};
  for (const u of units) for (const it of u.items) subMap[it.id] = it.status;
  for (const u of units) {
    for (const it of u.items) {
      it.locked = it.prereq_item_id ? (subMap[it.prereq_item_id] === 'not_started' || !subMap[it.prereq_item_id]) : false;
    }
  }
  res.json({ ...course, units });
});

// Single item detail for the kid to work on
app.get('/api/items/:id', (req, res) => {
  const studentId = req.query.studentId;
  const item = db.prepare(`
    SELECT i.id, i.type, i.title, i.body, i.points, i.ref_id, i.due_date, i.allow_retakes, i.prereq_item_id, i.evidence_mode, i.retake_policy,
           u.name AS unit_name, u.course_id, c.name AS course_name
    FROM items i JOIN units u ON u.id = i.unit_id JOIN courses c ON c.id = u.course_id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No such item' });

  if (item.prereq_item_id && studentId) {
    const prereqSub = db.prepare(`SELECT status FROM submissions WHERE student_id = ? AND item_id = ?`).get(studentId, item.prereq_item_id);
    item.locked = !prereqSub;
  } else {
    item.locked = false;
  }

  item.submission = db.prepare(`
    SELECT status, score, points_possible, answers, completed_at, graded_at, parent_comment, student_note
    FROM submissions WHERE student_id = ? AND item_id = ?
  `).get(studentId, req.params.id) || null;

  if (item.type === 'quiz') {
    const graded = item.submission && item.submission.status === 'graded';
    const savedAnswers = graded && item.submission.answers ? JSON.parse(item.submission.answers) : null;
    item.questions = db.prepare(`
      SELECT id, type, prompt, choices, points ${graded ? ', correct_answer' : ''}
      FROM quiz_questions WHERE item_id = ? ORDER BY sort, id
    `).all(req.params.id).map((q) => ({
      ...q,
      choices: JSON.parse(q.choices),
      given: savedAnswers ? savedAnswers[q.id] : undefined,
    }));
  } else if (item.type === 'flashcards') {
    item.deck = db.prepare(`SELECT id, name FROM decks WHERE id = ?`).get(item.ref_id);
  } else if (item.type === 'spelling_practice' || item.type === 'spelling_test') {
    item.list = db.prepare(`SELECT id, name FROM lists WHERE id = ?`).get(item.ref_id);
  }
  res.json(item);
});

// Mark a lesson viewed, an assignment done, or a practice/flashcards session finished.
// Never downgrades an already-graded submission unless allow_retakes is set.
app.post('/api/items/:id/complete', (req, res) => {
  const { studentId, date, evidenceNotes, evidencePhoto, studentNote } = req.body;
  const item = db.prepare(`SELECT id, points, allow_retakes FROM items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No such item' });

  if (item.allow_retakes) {
    db.prepare(`
      INSERT INTO submissions (student_id, item_id, status, points_possible, completed_at, evidence_notes, evidence_photo, student_note)
      VALUES (?, ?, 'done', ?, datetime('now'), ?, ?, ?)
      ON CONFLICT (student_id, item_id) DO UPDATE SET
        status = 'done', points_possible = excluded.points_possible,
        completed_at = datetime('now'), score = NULL, graded_at = NULL,
        evidence_notes = excluded.evidence_notes, evidence_photo = excluded.evidence_photo,
        student_note = excluded.student_note
    `).run(studentId, req.params.id, item.points || null, evidenceNotes || null, evidencePhoto || null, studentNote || null);
  } else {
    db.prepare(`
      INSERT INTO submissions (student_id, item_id, status, points_possible, completed_at, evidence_notes, evidence_photo, student_note)
      VALUES (?, ?, 'done', ?, datetime('now'), ?, ?, ?)
      ON CONFLICT (student_id, item_id) DO UPDATE SET
        completed_at = datetime('now'),
        evidence_notes = COALESCE(excluded.evidence_notes, evidence_notes),
        evidence_photo = COALESCE(excluded.evidence_photo, evidence_photo),
        student_note = COALESCE(excluded.student_note, student_note)
      WHERE submissions.status != 'graded'
    `).run(studentId, req.params.id, item.points || null, evidenceNotes || null, evidencePhoto || null, studentNote || null);
  }

  markScheduleDone.run(studentId, req.params.id, isDateStr(date) ? date : today());
  res.json({ ok: true });
});

// Auto-graded quiz submission
app.post('/api/items/:id/quiz-submit', (req, res) => {
  const { studentId, answers, date } = req.body; // answers: { questionId: value }
  const questions = db.prepare(`SELECT * FROM quiz_questions WHERE item_id = ?`).all(req.params.id);
  if (questions.length === 0) return res.status(404).json({ error: 'No such quiz' });

  let earned = 0, possible = 0;
  const record = {};
  for (const q of questions) {
    possible += q.points;
    const given = answers ? answers[q.id] : undefined;
    const correct = given !== undefined && normalize(given) === normalize(q.correct_answer);
    if (correct) earned += q.points;
    record[q.id] = given ?? '';
  }

  db.prepare(`
    INSERT INTO submissions (student_id, item_id, status, score, points_possible, answers, completed_at, graded_at)
    VALUES (?, ?, 'graded', ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT (student_id, item_id) DO UPDATE SET
      status = 'graded', score = excluded.score, points_possible = excluded.points_possible,
      answers = excluded.answers, completed_at = datetime('now'), graded_at = datetime('now')
  `).run(studentId, req.params.id, earned, possible, JSON.stringify(record));

  db.prepare(`INSERT INTO submission_history (student_id, item_id, score, points_possible, answers) VALUES (?, ?, ?, ?, ?)`)
    .run(studentId, req.params.id, earned, possible, JSON.stringify(record));

  markScheduleDone.run(studentId, req.params.id, isDateStr(date) ? date : today());
  res.json({ score: earned, total: possible });
});

// ---------- grading (parent) ----------

app.get('/api/grading-queue/count', requirePin, (req, res) => {
  const { n } = db.prepare(`
    SELECT COUNT(*) AS n FROM submissions sub
    JOIN items i ON i.id = sub.item_id
    WHERE sub.status = 'done' AND i.type IN ('assignment', 'lesson', 'spelling_practice', 'flashcards')
  `).get();
  res.json({ count: n });
});

app.get('/api/grading-queue', requirePin, (req, res) => {
  res.json(db.prepare(`
    SELECT sub.id AS submissionId, sub.completed_at, sub.points_possible,
           sub.evidence_notes, sub.evidence_photo, sub.student_note,
           s.id AS studentId, s.name AS studentName, s.emoji,
           i.id AS itemId, i.title AS itemTitle, i.type AS itemType,
           c.name AS courseName, u.name AS unitName
    FROM submissions sub
    JOIN students s ON s.id = sub.student_id
    JOIN items i ON i.id = sub.item_id
    JOIN units u ON u.id = i.unit_id
    JOIN courses c ON c.id = u.course_id
    WHERE sub.status = 'done' AND i.type IN ('assignment', 'lesson', 'spelling_practice', 'flashcards')
    ORDER BY sub.completed_at
  `).all());
});

app.put('/api/submissions/:id/grade', requirePin, (req, res) => {
  const score = Number(req.body.score);
  if (Number.isNaN(score)) return res.status(400).json({ error: 'Score must be a number' });
  const comment = req.body.parentComment !== undefined ? String(req.body.parentComment).trim() || null : undefined;
  db.prepare(`
    UPDATE submissions SET score = ?, status = 'graded', graded_at = datetime('now')
    ${comment !== undefined ? ', parent_comment = ?' : ''}
    WHERE id = ?
  `).run(...(comment !== undefined ? [score, comment, req.params.id] : [score, req.params.id]));
  res.json({ ok: true });
});

// ---------- gradebook (parent) ----------

app.get('/api/gradebook/:courseId', requirePin, (req, res) => {
  const course = db.prepare(`SELECT id, name FROM courses WHERE id = ?`).get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'No such course' });

  const gradableItems = db.prepare(`
    SELECT i.id, i.title, i.type, i.points, i.due_date, i.retake_policy
    FROM items i JOIN units u ON u.id = i.unit_id
    WHERE u.course_id = ? AND i.type IN (${GRADABLE_TYPES.map(() => '?').join(',')})
    ORDER BY u.sort, i.sort, i.id
  `).all(req.params.courseId, ...GRADABLE_TYPES);

  const students = db.prepare(`
    SELECT s.id, s.name, s.emoji FROM students s
    JOIN enrollments e ON e.student_id = s.id WHERE e.course_id = ? ORDER BY s.name
  `).all(req.params.courseId);

  const scoreStmt = db.prepare(`SELECT score, points_possible, status, parent_comment FROM submissions WHERE student_id = ? AND item_id = ?`);
  const histBest = db.prepare(`SELECT MAX(score * 1.0 / points_possible) AS ratio, MAX(score) AS score, points_possible FROM submission_history WHERE student_id = ? AND item_id = ? AND points_possible > 0`);
  const histAvg = db.prepare(`SELECT AVG(score) AS score, points_possible, COUNT(*) AS cnt FROM submission_history WHERE student_id = ? AND item_id = ? AND points_possible > 0`);
  const now = today();
  for (const s of students) {
    s.scores = {};
    let earned = 0, possible = 0;
    for (const item of gradableItems) {
      const row = scoreStmt.get(s.id, item.id);
      const overdue = !!(item.due_date && item.due_date < now && (!row || row.status !== 'graded'));
      let effectiveScore = row?.score;
      if (row?.status === 'graded' && item.retake_policy === 'highest') {
        const best = histBest.get(s.id, item.id);
        if (best?.score !== null) effectiveScore = best.score;
      } else if (row?.status === 'graded' && item.retake_policy === 'average') {
        const avg = histAvg.get(s.id, item.id);
        if (avg?.cnt > 0) effectiveScore = Math.round(avg.score * 10) / 10;
      }
      s.scores[item.id] = row ? { ...row, score: effectiveScore, overdue } : (overdue ? { overdue: true } : null);
      if (row && row.status === 'graded' && row.points_possible) {
        earned += effectiveScore ?? 0;
        possible += row.points_possible;
      }
    }
    s.percent = possible > 0 ? Math.round((earned / possible) * 100) : null;
  }

  res.json({ course, gradableItems, students });
});

// CSV export for the gradebook
app.get('/api/gradebook/:courseId/csv', requirePin, (req, res) => {
  const course = db.prepare(`SELECT id, name FROM courses WHERE id = ?`).get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'No such course' });

  const gradableItems = db.prepare(`
    SELECT i.id, i.title, i.type, i.points
    FROM items i JOIN units u ON u.id = i.unit_id
    WHERE u.course_id = ? AND i.type IN (${GRADABLE_TYPES.map(() => '?').join(',')})
    ORDER BY u.sort, i.sort, i.id
  `).all(req.params.courseId, ...GRADABLE_TYPES);

  const students = db.prepare(`
    SELECT s.id, s.name FROM students s
    JOIN enrollments e ON e.student_id = s.id WHERE e.course_id = ? ORDER BY s.name
  `).all(req.params.courseId);

  const scoreStmt = db.prepare(`SELECT score, points_possible, status FROM submissions WHERE student_id = ? AND item_id = ?`);
  const csvEsc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = ['Student', ...gradableItems.map((i) => csvEsc(`${i.title} (${i.points}pts)`)), 'Overall %'];
  const rows = students.map((s) => {
    let earned = 0, possible = 0;
    const cells = gradableItems.map((item) => {
      const row = scoreStmt.get(s.id, item.id);
      if (!row || row.status !== 'graded') return '—';
      if (row.points_possible) { earned += row.score; possible += row.points_possible; }
      return `${row.score}/${row.points_possible}`;
    });
    const pct = possible > 0 ? Math.round((earned / possible) * 100) + '%' : '—';
    return [csvEsc(s.name), ...cells, pct];
  });

  const filename = `gradebook-${course.name.replace(/[^a-z0-9]/gi, '-')}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send([header, ...rows].map((r) => r.join(',')).join('\n'));
});

// Full evidence for a submission (photo can be large, not included in queue list)
app.get('/api/grading-queue/:id/evidence', requirePin, (req, res) => {
  const row = db.prepare(`SELECT evidence_notes, evidence_photo FROM submissions WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Evidence detail for a schedule item (offline task)
app.get('/api/schedule/:id/evidence', requirePin, (req, res) => {
  const row = db.prepare(`SELECT evidence_notes, evidence_photo FROM schedule WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No such task' });
  res.json(row);
});

// Score history for a student on one item
app.get('/api/items/:id/history', (req, res) => {
  const { studentId } = req.query;
  const history = db.prepare(`
    SELECT score, points_possible, completed_at FROM submission_history
    WHERE student_id = ? AND item_id = ? ORDER BY completed_at DESC
  `).all(studentId, req.params.id);
  res.json({ history });
});

// ---------- quiz templates ----------

app.get('/api/quiz-templates', requirePin, (req, res) => {
  const templates = db.prepare(`
    SELECT t.id, t.name, COUNT(q.id) AS questionCount
    FROM quiz_templates t LEFT JOIN quiz_template_questions q ON q.template_id = t.id
    GROUP BY t.id ORDER BY t.name
  `).all();
  res.json(templates);
});

app.get('/api/quiz-templates/:id', requirePin, (req, res) => {
  const t = db.prepare(`SELECT id, name FROM quiz_templates WHERE id = ?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'No such template' });
  t.questions = db.prepare(`
    SELECT type, prompt, choices, correct_answer, points FROM quiz_template_questions
    WHERE template_id = ? ORDER BY sort, id
  `).all(req.params.id).map((q) => ({ ...q, choices: JSON.parse(q.choices) }));
  res.json(t);
});

app.post('/api/quiz-templates', requirePin, (req, res) => {
  const { name, itemId } = req.body;
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name required' });
  let qs = req.body.questions;
  if (itemId) {
    qs = db.prepare(`SELECT type, prompt, choices, correct_answer, points, sort FROM quiz_questions WHERE item_id = ? ORDER BY sort, id`).all(itemId);
  }
  if (!Array.isArray(qs) || qs.length === 0) return res.status(400).json({ error: 'No questions' });
  const id = db.prepare(`INSERT INTO quiz_templates (name) VALUES (?)`).run(String(name).trim()).lastInsertRowid;
  const ins = db.prepare(`INSERT INTO quiz_template_questions (template_id, type, prompt, choices, correct_answer, points, sort) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  qs.forEach((q, i) => ins.run(id, q.type, String(q.prompt).trim(),
    typeof q.choices === 'string' ? q.choices : JSON.stringify(q.choices || []),
    String(q.correct_answer ?? q.correctAnswer ?? '').trim(), Number(q.points) || 1, i));
  res.json({ id });
});

app.delete('/api/quiz-templates/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM quiz_templates WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- daily agenda / scheduling ----------

// Kid's checklist for one day
app.get('/api/schedule/:studentId', (req, res) => {
  const date = isDateStr(req.query.date) ? req.query.date : null;
  if (!date) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  const tasks = db.prepare(`
    SELECT sc.id, sc.date, sc.title AS offlineTitle, sc.done, sc.status AS offlineStatus,
           sc.evidence_notes IS NOT NULL OR sc.evidence_photo IS NOT NULL AS hasEvidence,
           i.id AS itemId, i.type, i.title AS itemTitle,
           c.name AS courseName, c.color AS courseColor,
           sub.status AS subStatus, sub.score, sub.points_possible, sub.parent_comment AS parentComment
    FROM schedule sc
    LEFT JOIN items i ON i.id = sc.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    LEFT JOIN courses c ON c.id = u.course_id
    LEFT JOIN submissions sub ON sub.item_id = sc.item_id AND sub.student_id = sc.student_id
    WHERE sc.student_id = ? AND sc.date = ?
    ORDER BY sc.sort, sc.id
  `).all(req.params.studentId, date);
  res.json({ tasks });
});

app.post('/api/schedule/auto', requirePin, (req, res) => {
  const { studentId, courseId, startDate, itemsPerDay = 1 } = req.body;
  if (!isDateStr(startDate)) return res.status(400).json({ error: 'startDate=YYYY-MM-DD required' });
  const items = db.prepare(`
    SELECT i.id, i.title FROM items i
    JOIN units u ON u.id = i.unit_id
    WHERE u.course_id = ?
    ORDER BY u.sort, i.sort
  `).all(courseId);
  if (!items.length) return res.json({ scheduled: 0 });

  const perDay = Math.max(1, Math.min(20, Number(itemsPerDay)));
  const ins = db.prepare(`INSERT INTO schedule (student_id, date, item_id, title, sort) VALUES (?, ?, ?, '', ?)`);
  const sortQ = db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM schedule WHERE student_id = ? AND date = ?`);

  let d = new Date(startDate + 'T12:00:00Z');
  let scheduled = 0;
  for (let i = 0; i < items.length; ) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = d.toISOString().slice(0, 10);
      for (let j = 0; j < perDay && i < items.length; j++, i++) {
        const sort = sortQ.get(studentId, dateStr).n + j;
        ins.run(studentId, dateStr, items[i].id, sort);
        scheduled++;
      }
    }
    d = new Date(d.getTime() + 86400000);
  }
  res.json({ scheduled });
});

app.post('/api/schedule/copy', requirePin, (req, res) => {
  const { studentId, from, to } = req.body;
  if (!isDateStr(from) || !isDateStr(to)) return res.status(400).json({ error: 'from/to dates required' });
  const offsetDays = Math.round((new Date(to) - new Date(from)) / 86400000);
  const rows = db.prepare(`
    SELECT date, item_id, title, sort FROM schedule WHERE student_id = ? AND date BETWEEN ? AND date(?, '+4 days')
  `).all(studentId, from, from);
  const ins = db.prepare(`
    INSERT INTO schedule (student_id, date, item_id, title, sort) VALUES (?, date(?, ?), ?, ?, ?)
  `);
  for (const r of rows) ins.run(studentId, r.date, `+${offsetDays} days`, r.item_id, r.title, r.sort);
  res.json({ copied: rows.length });
});

// Kid updates a standalone offline task: status (not_started/in_progress/done) + optional evidence
app.post('/api/schedule/:id/done', (req, res) => {
  const row = db.prepare(`SELECT item_id FROM schedule WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No such task' });
  if (row.item_id) return res.status(400).json({ error: 'Course items complete themselves — open the item instead' });
  const status = ['not_started', 'in_progress', 'done'].includes(req.body.status) ? req.body.status : (req.body.done ? 'done' : 'not_started');
  const done = status === 'done' ? 1 : 0;
  db.prepare(`
    UPDATE schedule SET
      status = ?, done = ?, done_at = CASE WHEN ? THEN datetime('now') ELSE NULL END,
      evidence_notes = COALESCE(?, evidence_notes),
      evidence_photo = COALESCE(?, evidence_photo)
    WHERE id = ?
  `).run(status, done, done, req.body.evidenceNotes || null, req.body.evidencePhoto || null, req.params.id);
  res.json({ ok: true });
});

app.post('/api/schedule', requirePin, (req, res) => {
  const { studentId, date, itemId, title } = req.body;
  if (!isDateStr(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  if (!itemId && !String(title || '').trim()) return res.status(400).json({ error: 'Pick an item or write a task' });
  if (itemId && !db.prepare(`SELECT id FROM items WHERE id = ?`).get(itemId)) {
    return res.status(400).json({ error: 'No such item' });
  }
  const sort = db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM schedule WHERE student_id = ? AND date = ?`)
    .get(studentId, date).n;
  const id = db.prepare(`
    INSERT INTO schedule (student_id, date, item_id, title, sort) VALUES (?, ?, ?, ?, ?)
  `).run(studentId, date, itemId || null, itemId ? '' : String(title).trim(), sort).lastInsertRowid;
  res.json({ id });
});

app.patch('/api/schedule/:id', requirePin, (req, res) => {
  const { date } = req.body;
  if (!isDateStr(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  db.prepare(`UPDATE schedule SET date = ? WHERE id = ?`).run(date, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/schedule/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM schedule WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// One week of plan for the parent grid (start = Monday)
app.get('/api/schedule-week/:studentId', requirePin, (req, res) => {
  const start = isDateStr(req.query.start) ? req.query.start : null;
  if (!start) return res.status(400).json({ error: 'start=YYYY-MM-DD required' });
  const tasks = db.prepare(`
    SELECT sc.id, sc.date, sc.title AS offlineTitle, sc.done,
           i.id AS itemId, i.type, i.title AS itemTitle, c.name AS courseName
    FROM schedule sc
    LEFT JOIN items i ON i.id = sc.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    LEFT JOIN courses c ON c.id = u.course_id
    WHERE sc.student_id = ? AND sc.date BETWEEN ? AND date(?, '+4 days')
    ORDER BY sc.date, sc.sort, sc.id
  `).all(req.params.studentId, start, start);
  res.json({ tasks });
});

app.get('/api/schedule-range/:studentId', requirePin, (req, res) => {
  const start = isDateStr(req.query.start) ? req.query.start : null;
  const end   = isDateStr(req.query.end)   ? req.query.end   : null;
  if (!start || !end) return res.status(400).json({ error: 'start and end (YYYY-MM-DD) required' });
  const tasks = db.prepare(`
    SELECT sc.id, sc.date, sc.title AS offlineTitle, sc.done,
           i.id AS itemId, i.type, i.title AS itemTitle, c.name AS courseName
    FROM schedule sc
    LEFT JOIN items i ON i.id = sc.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    LEFT JOIN courses c ON c.id = u.course_id
    WHERE sc.student_id = ? AND sc.date BETWEEN ? AND ?
    ORDER BY sc.date, sc.sort, sc.id
  `).all(req.params.studentId, start, end);
  res.json({ tasks });
});

// Printable weekly report: schedule completion + any graded work that week
app.get('/api/week-report/:studentId', requirePin, (req, res) => {
  const start = isDateStr(req.query.start) ? req.query.start : null;
  if (!start) return res.status(400).json({ error: 'start=YYYY-MM-DD required' });
  const student = db.prepare(`SELECT name FROM students WHERE id = ?`).get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'No such student' });

  const tasks = db.prepare(`
    SELECT sc.date, sc.title AS offlineTitle, sc.done, i.title AS itemTitle, i.type, c.name AS courseName
    FROM schedule sc
    LEFT JOIN items i ON i.id = sc.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    LEFT JOIN courses c ON c.id = u.course_id
    WHERE sc.student_id = ? AND sc.date BETWEEN ? AND date(?, '+4 days')
    ORDER BY sc.date, sc.sort, sc.id
  `).all(req.params.studentId, start, start);

  const graded = db.prepare(`
    SELECT sub.score, sub.points_possible, sub.graded_at, i.title AS itemTitle, c.name AS courseName
    FROM submissions sub
    JOIN items i ON i.id = sub.item_id
    JOIN units u ON u.id = i.unit_id
    JOIN courses c ON c.id = u.course_id
    WHERE sub.student_id = ? AND sub.status = 'graded' AND date(sub.graded_at) BETWEEN ? AND date(?, '+4 days')
    ORDER BY sub.graded_at
  `).all(req.params.studentId, start, start);

  const spellingTests = db.prepare(`
    SELECT t.score, t.total, t.at, l.name AS list
    FROM tests t JOIN lists l ON l.id = t.list_id
    WHERE t.student_id = ? AND date(t.at) BETWEEN ? AND date(?, '+4 days')
    ORDER BY t.at
  `).all(req.params.studentId, start, start);

  res.json({ student: student.name, start, tasks, graded, spellingTests });
});

// ---------- page scanning: photo -> lesson/quiz content ----------

const getSetting = (key) => db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)?.value;

const SCAN_PROMPTS = {
  lesson: `You are an OCR engine. Your only job is to copy the printed text from this image exactly as it appears — word for word, letter for letter. Do NOT summarize, paraphrase, rewrite, or shorten anything. Do NOT add explanations or commentary.

Rules:
- Copy every word of the body text exactly as printed.
- Preserve paragraph breaks (use a blank line between paragraphs).
- If there is a heading or title printed on the page, put it in "title". Otherwise use a very short descriptive label.
- Skip page numbers, running headers/footers, and captions under illustrations — copy body text only.
- If a word is hard to read, give your best exact guess — never skip it or replace it with a summary.

Respond with ONLY a JSON object in exactly this shape, nothing else, no markdown fences:
{"title": "the heading printed on the page", "body": "the complete word-for-word text of the page, paragraphs separated by a blank line"}`,

  quiz: `You are an OCR engine helping digitize a quiz or test page. Copy every question and every answer choice exactly as printed — word for word. Do NOT summarize, rewrite, or skip any question.

For each question extract:
- "type": "mc" if it has lettered/numbered answer choices, "tf" if it is true/false, "short" if it expects a written answer
- "prompt": the exact question text as printed
- "choices": for "mc", an array of the exact answer choice texts as printed (empty array for "tf" or "short")
- "correctAnswer": copy the marked answer ONLY if one is clearly indicated (circled, checked, starred, bolded, or in an answer key on the page). For "tf" use exactly "true" or "false". If no answer is marked, use "".
- "points": 1 unless the page prints a different value

Respond with ONLY a JSON object in exactly this shape, nothing else, no markdown fences:
{"title": "the quiz title as printed, or a short label if none", "questions": [{"type": "mc", "prompt": "...", "choices": ["...", "..."], "correctAnswer": "...", "points": 1}]}`,
};

function parseVisionJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model didn\'t return usable JSON. Try again or try a different model.');
  return JSON.parse(match[0]);
}

// Local Ollama provider
async function callOllama(imageBase64, mode) {
  const host = (getSetting('ollama_host') || 'http://localhost:11434').replace(/\/+$/, '');
  const model = getSetting('ollama_model') || 'llava';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  let res;
  try {
    res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: SCAN_PROMPTS[mode], images: [imageBase64], stream: false, format: 'json' }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Ollama timed out (3 min). Try a smaller photo or a faster model.');
    throw new Error(`Couldn't reach Ollama at ${host} — is it running? (${err.message})`);
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404) throw new Error(`Model "${model}" not found on Ollama. Run: ollama pull ${model}`);
    throw new Error(`Ollama error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return parseVisionJson(data.response);
}

// Ollama Cloud provider — routes through local Ollama with :cloud model tag.
// Cloud models are pulled via local Ollama (e.g. `ollama pull gemma4:cloud`) and
// automatically offloaded to Ollama's cloud infrastructure.
async function callOllamaCloud(imageBase64, mode) {
  const apiKey = getSetting('ollama_cloud_api_key') || '';
  const host = (getSetting('ollama_host') || 'http://localhost:11434').replace(/\/+$/, '');
  // Ensure model has :cloud suffix so Ollama offloads it
  const baseModel = (getSetting('ollama_cloud_model') || 'gemma4').replace(/:cloud$/, '');
  const model = `${baseModel}:cloud`;
  if (!apiKey) throw new Error('Ollama Cloud API key not set — add it in Settings.');

  // Ollama reads OLLAMA_API_KEY from env; we inject it per-request via Authorization header
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  let res;
  try {
    // Auth is handled by Ollama via OLLAMA_API_KEY env var — do not send it as a header
    res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: SCAN_PROMPTS[mode], images: [imageBase64] }],
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Ollama Cloud timed out (3 min).');
    throw new Error(`Couldn't reach local Ollama at ${host} — is it running? (${err.message})`);
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404) throw new Error(`Cloud model "${model}" not found. Run: ollama pull ${model}`);
    throw new Error(`Ollama Cloud error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.message?.content;
  if (!content) throw new Error('Ollama Cloud returned an empty response.');
  return parseVisionJson(content);
}

// Try primary provider, fall back to the other
app.post('/api/admin/scan', requirePin, async (req, res) => {
  const { image, mode } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });
  if (!SCAN_PROMPTS[mode]) return res.status(400).json({ error: 'mode must be "lesson" or "quiz"' });

  const primary = getSetting('scan_primary') || 'local';
  const providerFns = { local: callOllama, ollama_cloud: callOllamaCloud };
  const order = primary === 'ollama_cloud'
    ? ['ollama_cloud', 'local']
    : ['local', 'ollama_cloud'];
  const isConfigured = {
    local: true,
    ollama_cloud: !!getSetting('ollama_cloud_api_key'),
  };

  const errors = [];
  for (const provider of order) {
    if (!isConfigured[provider]) continue;
    try {
      const result = await providerFns[provider](image, mode);
      return res.json({ ...result, _provider: provider, _fallback: provider !== primary, _primaryError: errors[0] || null });
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
    }
  }
  return res.status(502).json({ error: errors.join(' | ') || 'No scan providers configured.' });
});

app.get('/api/admin/scan-config', requirePin, (req, res) => {
  res.json({
    primary: getSetting('scan_primary') || 'local',
    ollama_host: getSetting('ollama_host'),
    ollama_model: getSetting('ollama_model'),
    ollama_cloud_model: getSetting('ollama_cloud_model') || '',
    ollama_cloud_has_key: !!(getSetting('ollama_cloud_api_key')),
  });
});

app.post('/api/admin/scan-config', requirePin, (req, res) => {
  const { primary, ollama_host, ollama_model, ollama_cloud_model, ollama_cloud_api_key } = req.body;
  const set = (k, v) => {
    if (v === undefined) return;
    const s = String(v).trim();
    if (s) db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(k, s);
  };
  set('scan_primary', primary);
  set('ollama_host', ollama_host);
  set('ollama_model', ollama_model);
  set('ollama_cloud_model', ollama_cloud_model);
  if (ollama_cloud_api_key !== undefined)
    db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run('ollama_cloud_api_key', String(ollama_cloud_api_key).trim());
  res.json({ ok: true });
});

// Keep backward-compat routes for existing ollama-config/test calls
app.get('/api/admin/ollama-config', requirePin, (req, res) => {
  res.json({ host: getSetting('ollama_host'), model: getSetting('ollama_model') });
});
app.post('/api/admin/ollama-config', requirePin, (req, res) => {
  const { host, model } = req.body;
  if (String(host || '').trim()) db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run('ollama_host', String(host).trim());
  if (String(model || '').trim()) db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run('ollama_model', String(model).trim());
  res.json({ ok: true });
});

app.post('/api/admin/ollama-test', requirePin, async (req, res) => {
  const host = (getSetting('ollama_host') || '').replace(/\/+$/, '');
  const model = getSetting('ollama_model');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(`${host}/api/tags`, { signal: controller.signal });
    if (!r.ok) throw new Error(`Ollama responded with HTTP ${r.status}`);
    const { models } = await r.json();
    const names = (models || []).map((m) => m.name);
    const hasModel = names.some((n) => n === model || n.startsWith(`${model}:`));
    res.json({ reachable: true, hasModel, availableModels: names });
  } catch (err) {
    res.json({ reachable: false, error: err.name === 'AbortError' ? 'Timed out reaching Ollama' : err.message });
  } finally {
    clearTimeout(timer);
  }
});

// ---------- local TTS (Piper) ----------

app.get('/api/tts/status', (_req, res) => res.json({ available: PIPER_OK }));

app.get('/api/tts', (req, res) => {
  if (!PIPER_OK) return res.status(503).json({ error: 'Piper not configured' });
  const text = String(req.query.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'text required' });

  const hash = createHash('sha256').update(text).digest('hex').slice(0, 20);
  const cachePath = join(TTS_CACHE, `${hash}.wav`);

  if (!existsSync(cachePath)) {
    const result = spawnSync(PIPER_BIN, [
      '--model', PIPER_MODEL,
      '--output_file', cachePath,
      '--quiet',
    ], { input: text, timeout: 15000 });

    if (result.status !== 0 || !existsSync(cachePath)) {
      console.error('piper failed:', result.status, result.stderr?.toString(), result.error);
      return res.status(500).json({ error: 'TTS generation failed', detail: result.stderr?.toString() });
    }
  }

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(readFileSync(cachePath));
});

// ---------- Homeschool folder import ----------

const HOMESCHOOL_DIR = "/Users/nateemmert/Library/CloudStorage/SeaDrive-NateEmmert(seafile.necloud.us)/My Libraries/Homeschool";

function listDocxFiles(dir, base = '') {
  const results = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return results; }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      results.push(...listDocxFiles(full, base ? `${base}/${name}` : name));
    } else if (name.toLowerCase().endsWith('.docx') && !name.startsWith('~$')) {
      results.push({ name, path: base ? `${base}/${name}` : name, full });
    }
  }
  return results;
}

app.get('/api/admin/homeschool-files', requirePin, (req, res) => {
  const files = listDocxFiles(HOMESCHOOL_DIR);
  res.json({ files: files.map(({ name, path }) => ({ name, path })) });
});

const TEXT_SCAN_PROMPTS = {
  lesson: `You are given the text content of a homeschool lesson or assignment document. Extract it as structured content.

Respond with ONLY a JSON object in exactly this shape, nothing else, no markdown fences:
{"title": "the document title or heading", "body": "the full text content, paragraphs separated by a blank line"}`,

  quiz: `You are given the text content of a homeschool quiz or test document. Extract every question exactly as written.

For each question determine:
- "type": "mc" if it has lettered/numbered answer choices, "tf" if it is true/false, "short" if it expects a written answer
- "prompt": the exact question text
- "choices": for "mc", an array of the exact answer choice texts (empty array for "tf" or "short")
- "correctAnswer": the marked answer if clearly indicated; for "tf" use exactly "true" or "false"; otherwise use ""
- "points": 1 unless the document states a different value

Respond with ONLY a JSON object in exactly this shape, nothing else, no markdown fences:
{"title": "the quiz/test title", "questions": [{"type": "mc", "prompt": "...", "choices": ["...", "..."], "correctAnswer": "...", "points": 1}]}`,
};

app.post('/api/admin/import-docx', requirePin, async (req, res) => {
  const { path: relPath, mode } = req.body;
  if (!relPath || !TEXT_SCAN_PROMPTS[mode]) {
    return res.status(400).json({ error: 'path and mode (lesson or quiz) required' });
  }
  const fullPath = join(HOMESCHOOL_DIR, relPath);
  if (!fullPath.startsWith(HOMESCHOOL_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let buffer;
  try { buffer = await readFile(fullPath); }
  catch (err) { return res.status(404).json({ error: `Could not read file: ${err.message}` }); }

  let docText;
  try {
    const result = await mammoth.extractRawText({ buffer });
    docText = result.value.trim();
  } catch (err) {
    return res.status(500).json({ error: `Could not parse docx: ${err.message}` });
  }
  if (!docText) return res.status(400).json({ error: 'Document appears to be empty' });

  const host = (getSetting('ollama_host') || 'http://localhost:11434').replace(/\/+$/, '');
  const model = getSetting('ollama_model') || 'llava';
  const prompt = TEXT_SCAN_PROMPTS[mode] + '\n\nDOCUMENT TEXT:\n' + docText;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const r = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
      signal: controller.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Ollama error (${r.status}): ${t.slice(0, 200)}`);
    }
    const data = await r.json();
    const parsed = parseVisionJson(data.response);
    return res.json(parsed);
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Ollama timed out.' });
    return res.status(502).json({ error: err.message });
  } finally {
    clearTimeout(timer);
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Spelling v2 running on http://localhost:${PORT}`));
