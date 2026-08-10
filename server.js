import express from 'express';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import mammoth from 'mammoth';
import multer from 'multer';
import { db, sha256 } from './db.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
const TTS_CACHE = join(DATA_DIR, 'tts-cache');
mkdirSync(TTS_CACHE, { recursive: true });
const ATTACHMENTS_DIR = join(DATA_DIR, 'attachments');
mkdirSync(ATTACHMENTS_DIR, { recursive: true });
const PIPER_BIN = process.env.PIPER_BIN || 'piper';
const PIPER_MODEL = process.env.PIPER_MODEL || join(ROOT, 'voices', 'en_US-lessac-medium.onnx');
const PIPER_OK = existsSync(PIPER_MODEL);

const app = express();
app.use(express.json({ limit: '15mb' })); // photos for page-scanning are base64 in the JSON body
app.use(express.static(join(ROOT, 'public')));

const docxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Strip HTML tags and decode entities to plain text
function htmlToText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Parse a unit docx buffer (from mammoth HTML) into an array of LMS items.
// Handles: Week N: headings → lesson items, Unit X Quiz → quiz item with questions + answers.
async function parseUnitDocxBuffer(buffer, filename) {
  const { value: html } = await mammoth.convertToHtml({ buffer });

  // Strip worksheet tables — they are fill-in-blank print sheets, not digital content
  const stripped = html.replace(/<table[\s\S]*?<\/table>/gi, '');

  // Walk the HTML and collect typed elements
  const elements = [];
  for (const m of stripped.matchAll(/<(h[1-6]|p|ul|ol)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi)) {
    const tag = m[0].match(/^<(\w+)/)[1].toLowerCase();
    const inner = m[0].replace(/^<[^>]+>/, '').replace(/<\/\w+>\s*$/, '');

    if (tag === 'p' || /^h[1-6]$/.test(tag)) {
      const text = htmlToText(inner);
      if (!text) continue;
      // h1-h6 are always headings; <p> is a heading only if its sole content is <strong>
      const isHeading = /^h[1-6]$/.test(tag) || /^<strong>[^<]+<\/strong>\s*$/.test(inner.trim());
      elements.push({ kind: isHeading ? 'heading' : 'para', text });
    } else {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => htmlToText(li[1])).filter(Boolean);
      if (items.length) elements.push({ kind: tag === 'ol' ? 'numbered' : 'bullets', items });
    }
  }

  // Infer unit letter from filename (e.g. Unit_A_Kitchen.docx → 'A')
  const lm = filename.match(/[Uu]nit[_\s-]([A-Ha-h])[_\s-]/);
  const letter = lm ? lm[1].toUpperCase() : '';

  // State machine over elements
  const SECTIONS = {
    'Objective': 'OBJECTIVE',
    'Materials Needed': 'MATERIALS NEEDED',
    'Lesson & Activity Steps': 'LESSON STEPS',
    'Safety Notes': 'SAFETY NOTES',
    'Wrap-Up Discussion': 'WRAP-UP DISCUSSION',
  };

  const weeks = [];
  let cur = null;
  let inQuiz = false, inAnswers = false, skipWorksheet = false;
  const qPrompts = [], qAnswers = [];

  for (const el of elements) {
    if (el.kind === 'heading') {
      const t = el.text;
      if (/^Week \d+:/i.test(t)) {
        if (cur) weeks.push(cur);
        inQuiz = inAnswers = skipWorksheet = false;
        cur = { title: t, lines: [] };
      } else if (/^Week \d+ Worksheet:/i.test(t)) {
        skipWorksheet = true;
      } else if (/^Unit [A-H] Quiz:/i.test(t)) {
        if (cur) { weeks.push(cur); cur = null; }
        inQuiz = true; inAnswers = false;
      } else if (/^Answer Key$/i.test(t)) {
        inAnswers = true; inQuiz = false;
      } else if (cur && !skipWorksheet && SECTIONS[t]) {
        cur.lines.push('\n' + SECTIONS[t]);
      }
      continue;
    }

    if (el.kind === 'para') {
      const t = el.text;
      if (/^Name:\s*_/.test(t) || /^Part \d+\b/i.test(t)) continue;
      if (inAnswers) {
        const m = t.match(/^\d+[\.\)]+\s*(.+)$/); if (m) qAnswers.push(m[1].trim());
      } else if (inQuiz) {
        const m = t.match(/^\d+[\.\)]+\s*(.+)$/); if (m) qPrompts.push(m[1].trim());
      } else if (cur && !skipWorksheet) {
        cur.lines.push(t);
      }
      continue;
    }

    if (el.kind === 'bullets') {
      if (cur && !skipWorksheet) el.items.forEach((item) => cur.lines.push('• ' + item));
      continue;
    }

    if (el.kind === 'numbered') {
      if (inAnswers) { qAnswers.push(...el.items); }
      else if (inQuiz) { qPrompts.push(...el.items); }
      else if (cur && !skipWorksheet) {
        el.items.forEach((item, i) => cur.lines.push(`${i + 1}. ${item}`));
      }
    }
  }
  if (cur) weeks.push(cur);

  const items = weeks.map((w, i) => ({
    type: 'lesson', title: w.title,
    body: w.lines.join('\n').trim(),
    points: 0, sort: i, allow_retakes: 0,
    evidence_mode: 'none', retake_policy: 'latest',
  }));

  if (qPrompts.length) {
    const questions = qPrompts.map((q, i) => ({
      type: /^True or False/i.test(q) ? 'tf' : 'short',
      prompt: q, choices: [], correct_answer: qAnswers[i] || '',
      points: 1, sort: i,
    }));
    items.push({
      type: 'quiz', title: `${letter ? `Unit ${letter} Quiz` : 'Unit Quiz'}`, body: '',
      points: questions.length, sort: items.length,
      allow_retakes: 1, evidence_mode: 'none', retake_policy: 'latest',
      questions,
    });
  }

  return { letter, items };
}

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
const getStoredPin = db.prepare(`SELECT value FROM settings WHERE key = 'pin'`);
const getSetting = (key) => db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)?.value;

function requirePin(req, res, next) {
  const stored = getStoredPin.get().value;
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

// ---------- crossword generator ----------

function generateCrossword(acrossEntries, downEntries) {
  const allEntries = [
    ...acrossEntries.map(e => ({ word: String(e.word || '').toUpperCase().replace(/[^A-Z]/g, ''), clue: e.clue, preferDir: 'across' })),
    ...downEntries.map(e => ({ word: String(e.word || '').toUpperCase().replace(/[^A-Z]/g, ''), clue: e.clue, preferDir: 'down' })),
  ].filter(e => e.word.length > 1);
  if (allEntries.length === 0) return null;
  allEntries.sort((a, b) => b.word.length - a.word.length);

  const cells = new Map(); // 'r,c' -> letter
  const placed = [];

  const dr = (dir) => dir === 'down' ? 1 : 0;
  const dc = (dir) => dir === 'across' ? 1 : 0;

  function placeWord(word, r, c, dir) {
    for (let i = 0; i < word.length; i++) cells.set(`${r + i * dr(dir)},${c + i * dc(dir)}`, word[i]);
  }

  function canPlace(word, r, c, dir) {
    if (cells.has(`${r - dr(dir)},${c - dc(dir)}`)) return false;
    if (cells.has(`${r + word.length * dr(dir)},${c + word.length * dc(dir)}`)) return false;
    let intersects = false;
    for (let i = 0; i < word.length; i++) {
      const cr = r + i * dr(dir), cc = c + i * dc(dir);
      const existing = cells.get(`${cr},${cc}`);
      if (existing !== undefined) {
        if (existing !== word[i]) return false;
        intersects = true;
      } else {
        if (cells.has(`${cr - dc(dir)},${cc - dr(dir)}`)) return false;
        if (cells.has(`${cr + dc(dir)},${cc + dr(dir)}`)) return false;
      }
    }
    return intersects;
  }

  function countIntersections(word, r, c, dir) {
    let n = 0;
    for (let i = 0; i < word.length; i++) if (cells.has(`${r + i * dr(dir)},${c + i * dc(dir)}`)) n++;
    return n;
  }

  const first = allEntries[0];
  placeWord(first.word, 0, 0, first.preferDir);
  placed.push({ ...first, dir: first.preferDir, row: 0, col: 0 });

  for (let i = 1; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const { word, preferDir } = entry;
    const dirs = [preferDir, preferDir === 'across' ? 'down' : 'across'];
    let best = null, bestScore = -1;
    for (const dir of dirs) {
      for (let wi = 0; wi < word.length; wi++) {
        for (const [key, letter] of cells) {
          if (letter !== word[wi]) continue;
          const [er, ec] = key.split(',').map(Number);
          const r = er - wi * dr(dir), c = ec - wi * dc(dir);
          if (canPlace(word, r, c, dir)) {
            const score = countIntersections(word, r, c, dir);
            if (score > bestScore) { bestScore = score; best = { r, c, dir }; }
          }
        }
      }
      if (best) break;
    }
    if (best) {
      placeWord(word, best.r, best.c, best.dir);
      placed.push({ ...entry, dir: best.dir, row: best.r, col: best.c });
    }
  }
  if (placed.length === 0) return null;

  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const k of cells.keys()) {
    const [r, c] = k.split(',').map(Number);
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (c < minC) minC = c; if (c > maxC) maxC = c;
  }
  for (const p of placed) { p.row -= minR; p.col -= minC; }
  const rows = maxR - minR + 1, cols = maxC - minC + 1;

  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const [k, letter] of cells) {
    const [r, c] = k.split(',').map(Number);
    grid[r - minR][c - minC] = letter;
  }

  let num = 1;
  const cellNum = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const sa = (c === 0 || !grid[r][c - 1]) && c + 1 < cols && grid[r][c + 1];
      const sd = (r === 0 || !grid[r - 1][c]) && r + 1 < rows && grid[r + 1][c];
      if (sa || sd) cellNum[`${r},${c}`] = num++;
    }
  }
  for (const p of placed) p.num = cellNum[`${p.row},${p.col}`] || null;

  const mkList = (dir) => placed.filter(p => p.dir === dir && p.num)
    .map(p => ({ num: p.num, clue: p.clue, row: p.row, col: p.col, len: p.word.length, answer: p.word }))
    .sort((a, b) => a.num - b.num);

  return { rows, cols, grid, across: mkList('across'), down: mkList('down'), placed: placed.length, total: allEntries.length };
}

const ITEM_TYPES = ['lesson', 'assignment', 'quiz', 'matching', 'crossword', 'spelling_practice', 'spelling_test', 'flashcards', 'worksheet'];
const GRADABLE_TYPES = ['assignment', 'quiz', 'matching', 'crossword', 'spelling_test', 'worksheet'];

// ---------- kid picker ----------

// Returns true if today falls within the Mon–Sun week that contains the birthday (MM-DD)
function isBirthdayWeek(birthday) {
  if (!birthday) return false;
  const [mm, dd] = birthday.split('-').map(Number);
  if (!mm || !dd) return false;
  const now = new Date();
  const year = now.getFullYear();
  const bday = new Date(year, mm - 1, dd);
  // Monday of the week containing the birthday
  const dow = bday.getDay(); // 0=Sun
  const monday = new Date(bday);
  monday.setDate(bday.getDate() - (dow === 0 ? 6 : dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return todayMidnight >= monday && todayMidnight <= sunday;
}

app.get('/api/students', (req, res) => {
  res.json(db.prepare(`SELECT id, name, emoji, theme, bg_pattern, streak_count, streak_date, young_learner, birthday FROM students ORDER BY name`).all());
});

const VALID_THEMES = ['blue','green','purple','orange','pink','red','teal','yellow','indigo'];
const VALID_BG_PATTERNS = ['none','dots','stripes','grid','stars','bubbles'];

app.patch('/api/students/:id/theme', (req, res) => {
  const theme = VALID_THEMES.includes(req.body.theme) ? req.body.theme : 'blue';
  db.prepare(`UPDATE students SET theme = ? WHERE id = ?`).run(theme, req.params.id);
  res.json({ ok: true });
});

app.patch('/api/students/:id/bg-pattern', (req, res) => {
  const pattern = VALID_BG_PATTERNS.includes(req.body.pattern) ? req.body.pattern : 'none';
  db.prepare(`UPDATE students SET bg_pattern = ? WHERE id = ?`).run(pattern, req.params.id);
  res.json({ ok: true });
});

app.patch('/api/students/:id/young-learner', requirePin, (req, res) => {
  const val = req.body.young_learner ? 1 : 0;
  db.prepare(`UPDATE students SET young_learner = ? WHERE id = ?`).run(val, req.params.id);
  res.json({ ok: true });
});

app.patch('/api/students/:id/emoji', (req, res) => {
  const emoji = req.body.emoji ? String(req.body.emoji).trim() : null;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });
  db.prepare(`UPDATE students SET emoji = ? WHERE id = ?`).run(emoji, req.params.id);
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
  const student = db.prepare(`SELECT id, name, emoji, theme, bg_pattern, young_learner, birthday FROM students WHERE id = ?`).get(id);
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

  res.json({ student: { ...student, isBirthdayWeek: isBirthdayWeek(student.birthday) }, assignment, listProgress, dueReviews });
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
    SELECT l.id, l.name, l.builtin, l.group_name, COUNT(w.id) AS wordCount
    FROM lists l LEFT JOIN words w ON w.list_id = l.id
    GROUP BY l.id ORDER BY l.group_name, l.builtin, l.name
  `).all());
});

app.get('/api/lists/:id', (req, res) => {
  const list = db.prepare(`SELECT id, name, builtin, group_name FROM lists WHERE id = ?`).get(req.params.id);
  if (!list) return res.status(404).json({ error: 'No such list' });
  list.words = db.prepare(`SELECT id, word, sentence, definition FROM words WHERE list_id = ? ORDER BY id`).all(req.params.id);
  res.json(list);
});

app.post('/api/lists', requirePin, (req, res) => {
  const { name, words, groupName } = req.body;
  if (!name || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'Name and at least one word required' });
  }
  const id = db.prepare(`INSERT INTO lists (name, builtin, group_name) VALUES (?, 0, ?)`)
    .run(String(name).trim(), String(groupName || '').trim()).lastInsertRowid;
  const ins = db.prepare(`INSERT INTO words (list_id, word, sentence, definition) VALUES (?, ?, ?, ?)`);
  for (const w of words) ins.run(id, String(w.word).trim(), String(w.sentence || '').trim(), String(w.definition || '').trim());
  res.json({ id });
});

app.put('/api/lists/:id', requirePin, (req, res) => {
  const { name, words, groupName } = req.body;
  const id = req.params.id;
  if (!db.prepare(`SELECT id FROM lists WHERE id = ?`).get(id)) {
    return res.status(404).json({ error: 'No such list' });
  }
  const ins = db.prepare(`INSERT INTO words (list_id, word, sentence, definition) VALUES (?, ?, ?, ?)`);
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE lists SET name = ?, group_name = ? WHERE id = ?`)
      .run(String(name).trim(), String(groupName || '').trim(), id);
    db.prepare(`DELETE FROM words WHERE list_id = ?`).run(id);
    for (const w of words) ins.run(id, String(w.word).trim(), String(w.sentence || '').trim(), String(w.definition || '').trim());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

app.delete('/api/lists/:id', requirePin, (req, res) => {
  db.prepare(`DELETE FROM lists WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- flashcards module ----------

app.get('/api/decks', (req, res) => {
  res.json(db.prepare(`
    SELECT d.id, d.name, d.builtin, d.group_name, COUNT(c.id) AS cardCount
    FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
    GROUP BY d.id ORDER BY d.group_name, d.builtin, d.name
  `).all());
});

app.get('/api/decks/:id', (req, res) => {
  const deck = db.prepare(`SELECT id, name, builtin, group_name FROM decks WHERE id = ?`).get(req.params.id);
  if (!deck) return res.status(404).json({ error: 'No such deck' });
  deck.cards = db.prepare(`SELECT id, front, back FROM cards WHERE deck_id = ? ORDER BY id`).all(req.params.id);
  res.json(deck);
});

app.post('/api/decks', requirePin, (req, res) => {
  const { name, cards, groupName } = req.body;
  if (!name || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'Name and at least one card required' });
  }
  const id = db.prepare(`INSERT INTO decks (name, builtin, group_name) VALUES (?, 0, ?)`)
    .run(String(name).trim(), String(groupName || '').trim()).lastInsertRowid;
  const ins = db.prepare(`INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)`);
  for (const c of cards) ins.run(id, String(c.front).trim(), String(c.back).trim());
  res.json({ id });
});

app.put('/api/decks/:id', requirePin, (req, res) => {
  const { name, cards, groupName } = req.body;
  const id = req.params.id;
  if (!db.prepare(`SELECT id FROM decks WHERE id = ?`).get(id)) {
    return res.status(404).json({ error: 'No such deck' });
  }
  const ins = db.prepare(`INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)`);
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE decks SET name = ?, group_name = ? WHERE id = ?`)
      .run(String(name).trim(), String(groupName || '').trim(), id);
    db.prepare(`DELETE FROM cards WHERE deck_id = ?`).run(id);
    for (const c of cards) ins.run(id, String(c.front).trim(), String(c.back).trim());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
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

app.get('/api/admin/app-settings', requirePin, (req, res) => {
  res.json({
    school_name: getSetting('school_name') || '',
    passing_pct: Number(getSetting('passing_pct') || 80),
    week_start_day: getSetting('week_start_day') || 'monday',
    show_home_emoji: getSetting('show_home_emoji') !== 'false',
  });
});

app.post('/api/admin/app-settings', requirePin, (req, res) => {
  const { school_name, passing_pct, week_start_day, show_home_emoji } = req.body;
  const upsert = (k, v) => db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(k, String(v));
  if (school_name !== undefined) upsert('school_name', String(school_name).trim());
  if (passing_pct !== undefined) upsert('passing_pct', Math.max(0, Math.min(100, Number(passing_pct))));
  if (week_start_day !== undefined && ['monday', 'sunday'].includes(week_start_day)) upsert('week_start_day', week_start_day);
  if (show_home_emoji !== undefined) upsert('show_home_emoji', show_home_emoji ? 'true' : 'false');
  res.json({ ok: true });
});

app.get('/api/public-settings', (req, res) => {
  const logoExt = getSetting('logo_ext');
  res.json({
    show_home_emoji: getSetting('show_home_emoji') !== 'false',
    school_name: getSetting('school_name') || '',
    has_logo: !!(logoExt && existsSync(join(DATA_DIR, `logo${logoExt}`))),
  });
});

app.get('/api/logo', (req, res) => {
  const ext = getSetting('logo_ext');
  if (!ext) return res.status(404).end();
  const filePath = join(DATA_DIR, `logo${ext}`);
  if (!existsSync(filePath)) return res.status(404).end();
  const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(filePath);
});

app.post('/api/admin/upload-logo', requirePin, async (req, res) => {
  const { base64: b64, mime } = req.body;
  if (!b64 || !mime) return res.status(400).json({ error: 'base64 and mime required' });
  const mimeToExt = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
  const ext = mimeToExt[mime];
  if (!ext) return res.status(400).json({ error: 'Unsupported image type' });

  let buffer;
  try { buffer = Buffer.from(b64, 'base64'); }
  catch (_) { return res.status(400).json({ error: 'Invalid base64' }); }

  if (buffer.byteLength > 2 * 1024 * 1024) return res.status(400).json({ error: 'Logo must be under 2 MB' });

  const oldExt = getSetting('logo_ext');
  if (oldExt && oldExt !== ext) {
    await unlink(join(DATA_DIR, `logo${oldExt}`)).catch(() => {});
  }

  await writeFile(join(DATA_DIR, `logo${ext}`), buffer);
  const upsert = (k, v) => db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(k, String(v));
  upsert('logo_ext', ext);
  res.json({ ok: true });
});

app.delete('/api/admin/logo', requirePin, async (req, res) => {
  const ext = getSetting('logo_ext');
  if (ext) {
    await unlink(join(DATA_DIR, `logo${ext}`)).catch(() => {});
    db.prepare(`DELETE FROM settings WHERE key = 'logo_ext'`).run();
  }
  res.json({ ok: true });
});

// Validate MM-DD format (no year stored — birthday repeats annually)
function parseBirthday(val) {
  if (!val) return null;
  const m = String(val).match(/^(\d{1,2})-(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[1]), dd = Number(m[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

app.post('/api/students', requirePin, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const birthday = parseBirthday(req.body.birthday);
  const id = db.prepare(`INSERT INTO students (name, emoji, birthday) VALUES (?, ?, ?)`)
    .run(name, req.body.emoji || '🙂', birthday).lastInsertRowid;
  res.json({ id });
});

app.put('/api/students/:id', requirePin, (req, res) => {
  const { emoji, theme, birthday } = req.body;
  if (emoji) db.prepare(`UPDATE students SET emoji = ? WHERE id = ?`).run(String(emoji), req.params.id);
  if (theme && VALID_THEMES.includes(theme))
    db.prepare(`UPDATE students SET theme = ? WHERE id = ?`).run(theme, req.params.id);
  if (birthday !== undefined)
    db.prepare(`UPDATE students SET birthday = ? WHERE id = ?`).run(parseBirthday(birthday), req.params.id);
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
    if (s.assignment) {
      s.listProgress = db.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN COALESCE(p.box, 0) >= ${MASTERED_BOX} THEN 1 ELSE 0 END) AS mastered
        FROM words w
        LEFT JOIN progress p ON p.word_id = w.id AND p.student_id = ?
        WHERE w.list_id = ?
      `).get(s.id, s.assignment.id);
    }
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

app.post('/api/courses/:id/duplicate', requirePin, (req, res) => {
  const src = db.prepare(`SELECT name, subject, color FROM courses WHERE id = ?`).get(req.params.id);
  if (!src) return res.status(404).json({ error: 'No such course' });

  const newCourseId = db.prepare(`INSERT INTO courses (name, subject, color) VALUES (?, ?, ?)`)
    .run(`Copy of ${src.name}`, src.subject || '', src.color || '#4f86f7').lastInsertRowid;

  const insUnit = db.prepare(`INSERT INTO units (course_id, name, sort) VALUES (?, ?, ?)`);
  const insItem = db.prepare(`
    INSERT INTO items (unit_id, type, title, body, points, ref_id, sort, due_date, allow_retakes, prereq_item_id, evidence_mode, retake_policy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insQ = db.prepare(`INSERT INTO quiz_questions (item_id, type, prompt, choices, correct_answer, points, sort) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const getItems = db.prepare(`SELECT * FROM items WHERE unit_id = ? ORDER BY sort, id`);
  const getQs = db.prepare(`SELECT * FROM quiz_questions WHERE item_id = ? ORDER BY sort, id`);

  const units = db.prepare(`SELECT id, name, sort FROM units WHERE course_id = ? ORDER BY sort, id`).all(req.params.id);
  for (const u of units) {
    const newUnitId = insUnit.run(newCourseId, u.name, u.sort).lastInsertRowid;
    for (const it of getItems.all(u.id)) {
      const newItemId = insItem.run(
        newUnitId, it.type, it.title, it.body, it.points, it.ref_id,
        it.sort, it.due_date, it.allow_retakes,
        null, // prereq_item_id: don't copy — old IDs won't match new items
        it.evidence_mode || 'none', it.retake_policy || 'latest'
      ).lastInsertRowid;
      if (it.type === 'quiz') {
        for (const q of getQs.all(it.id)) {
          insQ.run(newItemId, q.type, q.prompt, q.choices, q.correct_answer, q.points, q.sort);
        }
      }
    }
  }

  res.json({ id: newCourseId });
});

// ---------- course export / import ----------

app.get('/api/admin/courses/:id/export', requirePin, (req, res) => {
  const course = db.prepare(`SELECT name, subject, color FROM courses WHERE id = ?`).get(req.params.id);
  if (!course) return res.status(404).json({ error: 'No such course' });

  const units = db.prepare(`SELECT id, name, sort FROM units WHERE course_id = ? ORDER BY sort, id`).all(req.params.id);
  const itemStmt = db.prepare(`SELECT id, type, title, body, points, sort, due_date, allow_retakes, evidence_mode, retake_policy FROM items WHERE unit_id = ? ORDER BY sort, id`);
  const qStmt = db.prepare(`SELECT type, prompt, choices, correct_answer, points, sort FROM quiz_questions WHERE item_id = ? ORDER BY sort, id`);

  const bundle = {
    format: 'homeschool-lms-course',
    version: 1,
    exportedAt: new Date().toISOString(),
    course,
    units: units.map((u) => ({
      name: u.name,
      sort: u.sort,
      items: itemStmt.all(u.id).map((it) => {
        const out = {
          type: it.type,
          title: it.title,
          body: it.body || '',
          points: it.points,
          sort: it.sort,
          due_date: it.due_date || null,
          allow_retakes: it.allow_retakes,
          evidence_mode: it.evidence_mode || 'none',
          retake_policy: it.retake_policy || 'latest',
        };
        if (it.type === 'quiz') {
          out.questions = qStmt.all(it.id).map((q) => ({
            type: q.type,
            prompt: q.prompt,
            choices: JSON.parse(q.choices || '[]'),
            correct_answer: q.correct_answer,
            points: q.points,
            sort: q.sort,
          }));
        }
        return out;
      }),
    })),
  };

  const safe = course.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.json"`);
  res.json(bundle);
});

app.post('/api/admin/import-course', requirePin, (req, res) => {
  const { format, course, units } = req.body;
  if (format !== 'homeschool-lms-course' || !String(course?.name || '').trim()) {
    return res.status(400).json({ error: 'Invalid course bundle' });
  }

  const insItem = db.prepare(`
    INSERT INTO items (unit_id, type, title, body, points, sort, due_date, allow_retakes, evidence_mode, retake_policy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insQ = db.prepare(`
    INSERT INTO quiz_questions (item_id, type, prompt, choices, correct_answer, points, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let courseId;
  try {
    db.exec('BEGIN');
    courseId = db.prepare(`INSERT INTO courses (name, subject, color) VALUES (?, ?, ?)`)
      .run(String(course.name).trim(), String(course.subject || '').trim(), course.color || '#4f86f7')
      .lastInsertRowid;

    for (const unit of (units || [])) {
      const unitId = db.prepare(`INSERT INTO units (course_id, name, sort) VALUES (?, ?, ?)`)
        .run(courseId, String(unit.name).trim(), unit.sort ?? 0)
        .lastInsertRowid;

      for (const item of (unit.items || [])) {
        const itemId = insItem.run(
          unitId,
          item.type || 'lesson',
          String(item.title || '').trim(),
          String(item.body || ''),
          item.points || 0,
          item.sort ?? 0,
          item.due_date || null,
          item.allow_retakes ? 1 : 0,
          item.evidence_mode || 'none',
          item.retake_policy || 'latest',
        ).lastInsertRowid;

        if (item.type === 'quiz' && Array.isArray(item.questions) && item.questions.length) {
          let totalPts = 0;
          for (const q of item.questions) {
            insQ.run(
              itemId,
              q.type || 'short',
              String(q.prompt || ''),
              JSON.stringify(Array.isArray(q.choices) ? q.choices : []),
              String(q.correct_answer || ''),
              q.points || 1,
              q.sort ?? 0,
            );
            totalPts += q.points || 1;
          }
          db.prepare(`UPDATE items SET points = ? WHERE id = ?`).run(totalPts, itemId);
        }
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: e.message });
  }

  res.json({ id: courseId });
});

// Multi-file docx → course import
app.post('/api/admin/import-course-docx', requirePin, docxUpload.array('files'), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
    const courseName = String(req.body.name || '').trim();
    if (!courseName) return res.status(400).json({ error: 'Course name is required' });

    // Sort by filename so Unit_A_ comes before Unit_B_, etc.
    const sorted = [...req.files].sort((a, b) => a.originalname.localeCompare(b.originalname));

    // Parse each docx into unit items
    const parsedUnits = [];
    for (const file of sorted) {
      const { letter, items } = await parseUnitDocxBuffer(file.buffer, file.originalname);
      const unitName = letter
        ? `Unit ${letter}`
        : file.originalname.replace(/\.docx$/i, '').replace(/[_-]/g, ' ').trim();
      parsedUnits.push({ name: unitName, items });
    }

    const insItem = db.prepare(`
      INSERT INTO items (unit_id, type, title, body, points, sort, due_date, allow_retakes, evidence_mode, retake_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insQ = db.prepare(`
      INSERT INTO quiz_questions (item_id, type, prompt, choices, correct_answer, points, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let courseId;
    db.exec('BEGIN');
    try {
      courseId = db.prepare(`INSERT INTO courses (name, subject, color) VALUES (?, ?, ?)`)
        .run(courseName, String(req.body.subject || '').trim(), req.body.color || '#4f86f7')
        .lastInsertRowid;

      for (let ui = 0; ui < parsedUnits.length; ui++) {
        const pu = parsedUnits[ui];
        const unitId = db.prepare(`INSERT INTO units (course_id, name, sort) VALUES (?, ?, ?)`)
          .run(courseId, pu.name, ui).lastInsertRowid;

        for (const item of pu.items) {
          const itemId = insItem.run(
            unitId, item.type, item.title, item.body,
            item.points, item.sort, null,
            item.allow_retakes ? 1 : 0,
            item.evidence_mode, item.retake_policy,
          ).lastInsertRowid;

          if (item.type === 'quiz' && item.questions?.length) {
            let pts = 0;
            for (const q of item.questions) {
              insQ.run(itemId, q.type, q.prompt, JSON.stringify(q.choices || []),
                q.correct_answer, q.points || 1, q.sort ?? 0);
              pts += q.points || 1;
            }
            db.prepare(`UPDATE items SET points = ? WHERE id = ?`).run(pts, itemId);
          }
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    res.json({ id: courseId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
  const itemStmt = db.prepare(`SELECT id, type, title, body, points, ref_id, sort, due_date, allow_retakes, prereq_item_id FROM items WHERE unit_id = ? ORDER BY sort, id`);
  const qStmt = db.prepare(`SELECT type, prompt, choices, correct_answer, points FROM quiz_questions WHERE item_id = ? ORDER BY sort, id`);
  for (const u of units) {
    u.items = itemStmt.all(u.id).map((it) => {
      if (it.type === 'quiz') it.questions = qStmt.all(it.id).map((q) => ({ ...q, choices: JSON.parse(q.choices) }));
      return it;
    });
  }
  res.json({ ...course, units });
});

// Full item detail for the admin item editor (quiz correct answers always included)
app.get('/api/admin/items/:id', requirePin, (req, res) => {
  const item = db.prepare(`SELECT id, unit_id, type, title, body, points, ref_id, due_date, allow_retakes, prereq_item_id, evidence_mode, retake_policy FROM items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No such item' });
  if (item.type === 'quiz' || item.type === 'matching') {
    item.questions = db.prepare(`
      SELECT id, type, prompt, choices, correct_answer, points FROM quiz_questions WHERE item_id = ? ORDER BY sort, id
    `).all(req.params.id).map((q) => ({ ...q, choices: JSON.parse(q.choices) }));
  }
  if (item.type === 'crossword' && item.body) {
    try { item.crosswordData = JSON.parse(item.body); } catch { item.crosswordData = null; }
  }
  if (item.type === 'worksheet' && item.body) {
    try { item.worksheetData = JSON.parse(item.body); } catch { item.worksheetData = null; }
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

app.post('/api/crossword/generate', requirePin, (req, res) => {
  const { across, down } = req.body;
  if (!Array.isArray(across) && !Array.isArray(down)) return res.status(400).json({ error: 'across and/or down arrays required' });
  const result = generateCrossword(across || [], down || []);
  if (!result) return res.status(400).json({ error: 'Could not place any words — check that words share common letters' });
  res.json(result);
});

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
  if (type === 'crossword' && !body.crosswordData) return 'Generate the crossword first';
  if (type === 'worksheet') {
    const wd = body.worksheetData;
    if (!wd || !Array.isArray(wd.sections) || !wd.sections.some(s => Array.isArray(s.questions) && s.questions.length > 0)) {
      return 'Parse the worksheet and add at least one question';
    }
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
  if (type === 'quiz' || type === 'matching') {
    saveQuizQuestions(id, req.body.questions);
    const totalPoints = req.body.questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
    db.prepare(`UPDATE items SET points = ? WHERE id = ?`).run(totalPoints, id);
  }
  if (type === 'crossword' && req.body.crosswordData) {
    const cw = req.body.crosswordData;
    const totalPoints = (cw.across || []).length + (cw.down || []).length;
    const bodyJson = JSON.stringify(cw);
    db.prepare(`UPDATE items SET body = ?, points = ? WHERE id = ?`).run(bodyJson, totalPoints, id);
  }
  if (type === 'worksheet' && req.body.worksheetData) {
    const wd = req.body.worksheetData;
    const totalPoints = wd.sections.reduce((sum, s) =>
      sum + (s.questions || []).reduce((qs, q) => qs + (Number(q.points) || 1), 0), 0);
    db.prepare(`UPDATE items SET body = ?, points = ? WHERE id = ?`).run(JSON.stringify(wd), totalPoints, id);
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
  const finalPoints = (type === 'quiz' || type === 'matching')
    ? req.body.questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0)
    : (Number(points) || 0);
  db.prepare(`UPDATE items SET type = ?, title = ?, body = ?, points = ?, ref_id = ?, due_date = ?, allow_retakes = ?, prereq_item_id = ?, evidence_mode = ?, retake_policy = ? WHERE id = ?`)
    .run(type, String(title).trim(), String(body || ''), finalPoints,
         (type === 'flashcards' || type === 'spelling_practice' || type === 'spelling_test') ? refId : null,
         dueDate || null, allowRetakes ? 1 : 0, prereqItemId || null,
         evidenceMode || 'none', retakePolicy || 'latest', req.params.id);
  if (type === 'quiz' || type === 'matching') saveQuizQuestions(req.params.id, req.body.questions);
  if (type === 'crossword' && req.body.crosswordData) {
    const cw = req.body.crosswordData;
    const totalPoints = (cw.across || []).length + (cw.down || []).length;
    const bodyJson = JSON.stringify(cw);
    db.prepare(`UPDATE items SET body = ?, points = ? WHERE id = ?`).run(bodyJson, totalPoints, req.params.id);
  }
  if (type === 'worksheet' && req.body.worksheetData) {
    const wd = req.body.worksheetData;
    const totalPoints = wd.sections.reduce((sum, s) =>
      sum + (s.questions || []).reduce((qs, q) => qs + (Number(q.points) || 1), 0), 0);
    db.prepare(`UPDATE items SET body = ?, points = ? WHERE id = ?`).run(JSON.stringify(wd), totalPoints, req.params.id);
  }
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
  } else if (item.type === 'matching') {
    const graded = item.submission && item.submission.status === 'graded';
    const savedAnswers = graded && item.submission.answers ? JSON.parse(item.submission.answers) : null;
    const qs = db.prepare(`SELECT id, prompt, correct_answer, points FROM quiz_questions WHERE item_id = ? ORDER BY sort, id`).all(req.params.id);
    const words = [...new Set(qs.map(q => q.correct_answer))].sort((a, b) => a.localeCompare(b));
    const wordToLetter = Object.fromEntries(words.map((w, i) => [w, String.fromCharCode(65 + i)]));
    item.wordBank = words;
    item.questions = qs.map(q => ({
      id: q.id,
      prompt: q.prompt,
      points: q.points,
      given: savedAnswers ? savedAnswers[q.id] : undefined,
      correctLetter: graded ? wordToLetter[q.correct_answer] : undefined,
      correctWord: graded ? q.correct_answer : undefined,
    }));
  } else if (item.type === 'crossword' && item.body) {
    try {
      const cw = JSON.parse(item.body);
      const graded = item.submission && item.submission.status === 'graded';
      const savedAnswers = graded && item.submission.answers ? JSON.parse(item.submission.answers) : null;
      // Strip answers from grid for students unless graded
      const safeGrid = cw.grid.map(row => row.map(cell => cell !== null ? '' : null));
      const safeAcross = cw.across.map(({ num, clue, row, col, len }) => ({ num, clue, row, col, len }));
      const safeDown = cw.down.map(({ num, clue, row, col, len }) => ({ num, clue, row, col, len }));
      item.crosswordData = {
        rows: cw.rows, cols: cw.cols,
        grid: safeGrid,
        across: graded ? cw.across : safeAcross,
        down: graded ? cw.down : safeDown,
        savedAnswers,
      };
    } catch { item.crosswordData = null; }
  } else if (item.type === 'worksheet' && item.body) {
    try {
      const wd = JSON.parse(item.body);
      const graded = item.submission && item.submission.status === 'graded';
      const savedAnswers = item.submission && item.submission.answers
        ? JSON.parse(item.submission.answers) : null;
      item.worksheetData = {
        hasHeader: wd.hasHeader,
        sections: wd.sections.map((section, si) => ({
          title: section.title,
          questions: section.questions.map((q, qi) => {
            const out = { type: q.type, points: q.points };
            if (q.num !== undefined) out.num = q.num;
            if (q.type === 'fitb') {
              out.template = q.template;
              out.blankCount = Array.isArray(q.blanks) ? q.blanks.length : 0;
              if (graded) {
                out.blanks = q.blanks;
                out.givenBlanks = Array.from({ length: out.blankCount }, (_, bi) =>
                  savedAnswers ? (savedAnswers[`${si}:${qi}:${bi}`] ?? '') : '');
              }
            } else if (q.type === 'tf') {
              out.text = q.text;
              if (graded) {
                out.correct = q.correct;
                out.given = savedAnswers ? (savedAnswers[`${si}:${qi}`] ?? '') : '';
              }
              if (savedAnswers && !graded) out.given = savedAnswers[`${si}:${qi}`] ?? '';
            } else if (q.type === 'short') {
              out.text = q.text;
              out.given = savedAnswers ? (savedAnswers[`${si}:${qi}`] ?? '') : '';
            }
            return out;
          }),
        })),
      };
    } catch { item.worksheetData = null; }
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
  const item = db.prepare(`SELECT type FROM items WHERE id = ?`).get(req.params.id);
  const questions = db.prepare(`SELECT * FROM quiz_questions WHERE item_id = ?`).all(req.params.id);
  if (questions.length === 0) return res.status(404).json({ error: 'No such quiz' });

  // For matching: build letter→word map from alphabetically sorted correct_answers
  let letterToWord = null;
  if (item && item.type === 'matching') {
    const words = [...new Set(questions.map(q => q.correct_answer))].sort((a, b) => a.localeCompare(b));
    letterToWord = Object.fromEntries(words.map((w, i) => [String.fromCharCode(65 + i), w]));
  }

  let earned = 0, possible = 0;
  const record = {};
  for (const q of questions) {
    possible += q.points;
    const given = answers ? answers[q.id] : undefined;
    let correct;
    if (letterToWord) {
      const mappedWord = given ? (letterToWord[String(given).trim().toUpperCase()] || '') : '';
      correct = given !== undefined && normalize(mappedWord) === normalize(q.correct_answer);
    } else {
      correct = given !== undefined && normalize(given) === normalize(q.correct_answer);
    }
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

// Auto-graded crossword submission
app.post('/api/items/:id/crossword-submit', (req, res) => {
  const { studentId, answers, date } = req.body; // answers: {'r,c': 'LETTER'}
  const item = db.prepare(`SELECT body, points FROM items WHERE id = ?`).get(req.params.id);
  if (!item || !item.body) return res.status(404).json({ error: 'No such crossword' });
  let cw;
  try { cw = JSON.parse(item.body); } catch { return res.status(400).json({ error: 'Invalid crossword data' }); }

  const allWords = [...(cw.across || []), ...(cw.down || [])];

  let earned = 0;
  const possible = allWords.length;
  for (const w of allWords) {
    const dir = cw.across.includes(w) ? 'across' : 'down';
    let wordCorrect = true;
    for (let i = 0; i < w.len; i++) {
      const r = w.row + (dir === 'down' ? i : 0);
      const c = w.col + (dir === 'across' ? i : 0);
      const given = (answers && answers[`${r},${c}`]) ? String(answers[`${r},${c}`]).toUpperCase() : '';
      if (given !== w.answer[i]) { wordCorrect = false; break; }
    }
    if (wordCorrect) earned++;
  }

  db.prepare(`
    INSERT INTO submissions (student_id, item_id, status, score, points_possible, answers, completed_at, graded_at)
    VALUES (?, ?, 'graded', ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT (student_id, item_id) DO UPDATE SET
      status = 'graded', score = excluded.score, points_possible = excluded.points_possible,
      answers = excluded.answers, completed_at = datetime('now'), graded_at = datetime('now')
  `).run(studentId, req.params.id, earned, possible, JSON.stringify(answers || {}));

  db.prepare(`INSERT INTO submission_history (student_id, item_id, score, points_possible, answers) VALUES (?, ?, ?, ?, ?)`)
    .run(studentId, req.params.id, earned, possible, JSON.stringify(answers || {}));

  markScheduleDone.run(studentId, req.params.id, isDateStr(date) ? date : today());
  res.json({ score: earned, total: possible });
});

// Auto-grade T/F and FITB; queue short answers for parent grading
app.post('/api/items/:id/worksheet-submit', (req, res) => {
  const { studentId, answers, date } = req.body;
  const item = db.prepare(`SELECT body FROM items WHERE id = ?`).get(req.params.id);
  if (!item || !item.body) return res.status(404).json({ error: 'No such worksheet' });
  let wd;
  try { wd = JSON.parse(item.body); } catch { return res.status(400).json({ error: 'Invalid worksheet data' }); }

  let earned = 0, possible = 0, hasShort = false;
  wd.sections.forEach((section, si) => {
    (section.questions || []).forEach((q, qi) => {
      const pts = Number(q.points) || 1;
      possible += pts;
      if (q.type === 'tf') {
        const given = answers ? answers[`${si}:${qi}`] : undefined;
        if (given !== undefined && normalize(given) === normalize(q.correct || '')) earned += pts;
      } else if (q.type === 'fitb') {
        const blanks = Array.isArray(q.blanks) ? q.blanks : [];
        const perBlank = blanks.length > 0 ? pts / blanks.length : 0;
        blanks.forEach((correct, bi) => {
          const given = answers ? answers[`${si}:${qi}:${bi}`] : undefined;
          if (given !== undefined && normalize(given) === normalize(correct || '')) earned += perBlank;
        });
      } else if (q.type === 'short') {
        hasShort = true;
      }
    });
  });

  if (hasShort) {
    db.prepare(`
      INSERT INTO submissions (student_id, item_id, status, score, points_possible, answers, completed_at)
      VALUES (?, ?, 'done', ?, ?, ?, datetime('now'))
      ON CONFLICT (student_id, item_id) DO UPDATE SET
        status = 'done', score = excluded.score, points_possible = excluded.points_possible,
        answers = excluded.answers, completed_at = datetime('now'), graded_at = NULL
    `).run(studentId, req.params.id, earned, possible, JSON.stringify(answers || {}));
  } else {
    db.prepare(`
      INSERT INTO submissions (student_id, item_id, status, score, points_possible, answers, completed_at, graded_at)
      VALUES (?, ?, 'graded', ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT (student_id, item_id) DO UPDATE SET
        status = 'graded', score = excluded.score, points_possible = excluded.points_possible,
        answers = excluded.answers, completed_at = datetime('now'), graded_at = datetime('now')
    `).run(studentId, req.params.id, earned, possible, JSON.stringify(answers || {}));
  }

  db.prepare(`INSERT INTO submission_history (student_id, item_id, score, points_possible, answers) VALUES (?, ?, ?, ?, ?)`)
    .run(studentId, req.params.id, earned, possible, JSON.stringify(answers || {}));

  markScheduleDone.run(studentId, req.params.id, isDateStr(date) ? date : today());
  res.json({ score: earned, total: possible, needsGrading: hasShort });
});

// ---------- grading (parent) ----------

app.get('/api/grading-queue/count', requirePin, (req, res) => {
  const { n } = db.prepare(`
    SELECT COUNT(*) AS n FROM submissions sub
    JOIN items i ON i.id = sub.item_id
    WHERE sub.status = 'done' AND i.type IN ('assignment', 'lesson', 'spelling_practice', 'flashcards', 'worksheet')
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
    WHERE sub.status = 'done' AND i.type IN ('assignment', 'lesson', 'spelling_practice', 'flashcards', 'worksheet')
    ORDER BY sub.completed_at
  `).all());
});

app.put('/api/submissions/:id/grade', requirePin, (req, res) => {
  const score = Number(req.body.score);
  if (Number.isNaN(score)) return res.status(400).json({ error: 'Score must be a number' });
  const comment = req.body.parentComment !== undefined ? String(req.body.parentComment).trim() || null : undefined;
  const pp = req.body.pointsPossible !== undefined ? Number(req.body.pointsPossible) : null;
  const sets = [`score = ?`, `status = 'graded'`, `graded_at = datetime('now')`];
  const vals = [score];
  if (comment !== undefined) { sets.push('parent_comment = ?'); vals.push(comment); }
  if (pp && pp > 0) { sets.push('points_possible = CASE WHEN COALESCE(points_possible, 0) = 0 THEN ? ELSE points_possible END'); vals.push(pp); }
  vals.push(req.params.id);
  db.prepare(`UPDATE submissions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// ---------- gradebook (parent) ----------

app.get('/api/gradebook/:courseId', requirePin, (req, res) => {
  const course = db.prepare(`SELECT id, name FROM courses WHERE id = ?`).get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'No such course' });

  const gradableItems = db.prepare(`
    SELECT i.id, i.title, i.type, i.points, i.due_date, i.retake_policy,
           u.id AS unit_id, u.name AS unit_name, u.sort AS unit_sort
    FROM items i JOIN units u ON u.id = i.unit_id
    WHERE u.course_id = ? AND i.type IN (${GRADABLE_TYPES.map(() => '?').join(',')})
    ORDER BY u.sort, i.sort, i.id
  `).all(req.params.courseId, ...GRADABLE_TYPES);

  const students = db.prepare(`
    SELECT s.id, s.name, s.emoji FROM students s
    JOIN enrollments e ON e.student_id = s.id WHERE e.course_id = ? ORDER BY s.name
  `).all(req.params.courseId);

  const studentIds = students.map((s) => s.id);
  const itemIds = gradableItems.map((i) => i.id);
  const ph = (arr) => arr.map(() => '?').join(',');

  const allSubs = studentIds.length && itemIds.length
    ? db.prepare(`
        SELECT student_id, item_id, score, points_possible, status, parent_comment
        FROM submissions
        WHERE student_id IN (${ph(studentIds)}) AND item_id IN (${ph(itemIds)})
      `).all(...studentIds, ...itemIds)
    : [];
  const allHist = studentIds.length && itemIds.length
    ? db.prepare(`
        SELECT student_id, item_id,
               MAX(score) AS best_score, AVG(score) AS avg_score, COUNT(*) AS cnt
        FROM submission_history
        WHERE student_id IN (${ph(studentIds)}) AND item_id IN (${ph(itemIds)})
          AND points_possible > 0
        GROUP BY student_id, item_id
      `).all(...studentIds, ...itemIds)
    : [];

  const subMap = new Map(allSubs.map((r) => [`${r.student_id}:${r.item_id}`, r]));
  const histMap = new Map(allHist.map((r) => [`${r.student_id}:${r.item_id}`, r]));

  const now = today();
  for (const s of students) {
    s.scores = {};
    let earned = 0, possible = 0;
    for (const item of gradableItems) {
      const row = subMap.get(`${s.id}:${item.id}`) || null;
      const overdue = !!(item.due_date && item.due_date < now && (!row || row.status !== 'graded'));
      let effectiveScore = row?.score;
      if (row?.status === 'graded') {
        const hist = histMap.get(`${s.id}:${item.id}`);
        if (item.retake_policy === 'highest' && hist?.best_score != null) {
          effectiveScore = hist.best_score;
        } else if (item.retake_policy === 'average' && hist?.cnt > 0) {
          effectiveScore = Math.round(hist.avg_score * 10) / 10;
        }
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

// All standalone spelling test results grouped by student
app.get('/api/spelling-tests', requirePin, (req, res) => {
  const days = parseInt(req.query.since) || null;
  const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : null;
  const students = db.prepare(`SELECT id, name, emoji FROM students ORDER BY name`).all();
  for (const s of students) {
    s.tests = cutoff
      ? db.prepare(`SELECT t.id, t.score, t.total, t.at, l.name AS list FROM tests t JOIN lists l ON l.id = t.list_id WHERE t.student_id = ? AND date(t.at) >= ? ORDER BY t.at DESC LIMIT 20`).all(s.id, cutoff)
      : db.prepare(`SELECT t.id, t.score, t.total, t.at, l.name AS list FROM tests t JOIN lists l ON l.id = t.list_id WHERE t.student_id = ? ORDER BY t.at DESC LIMIT 20`).all(s.id);
  }
  res.json({ students });
});

app.get('/api/spelling-tests/csv', requirePin, (req, res) => {
  const days = parseInt(req.query.since) || null;
  const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : null;
  const rows = db.prepare(`
    SELECT s.emoji, s.name AS student, l.name AS list, t.score, t.total, t.at
    FROM tests t JOIN students s ON s.id = t.student_id JOIN lists l ON l.id = t.list_id
    ${cutoff ? 'WHERE date(t.at) >= ?' : ''} ORDER BY t.at DESC
  `).all(...(cutoff ? [cutoff] : []));
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'Date,Student,List,Score,Total,%';
  const data = rows.map((r) => [
    q(new Date(r.at + 'Z').toLocaleDateString()),
    q(`${r.emoji} ${r.student}`),
    q(r.list), r.score, r.total,
    Math.round((r.score / r.total) * 100) + '%',
  ].join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="spelling-test-history.csv"');
  res.send(header + '\n' + data);
});

// Student-facing: recent tests for the spelling tab (no PIN — student portal)
app.get('/api/students/:id/tests', (req, res) => {
  const tests = db.prepare(`
    SELECT t.id, t.score, t.total, t.at, l.name AS list
    FROM tests t JOIN lists l ON l.id = t.list_id
    WHERE t.student_id = ? ORDER BY t.at DESC LIMIT 10
  `).all(req.params.id);
  res.json({ tests });
});

// Admin: tests within a date range for a single student (used by planner)
app.get('/api/admin/students/:id/tests-range', requirePin, (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const tests = db.prepare(`
    SELECT t.id, t.score, t.total, t.at, date(t.at) AS date, l.name AS list
    FROM tests t JOIN lists l ON l.id = t.list_id
    WHERE t.student_id = ? AND date(t.at) BETWEEN ? AND ?
    ORDER BY t.at
  `).all(req.params.id, from, to);
  res.json({ tests });
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
    LEFT JOIN submissions sub ON sub.item_id = i.id AND sub.student_id = ?
    WHERE u.course_id = ? AND sub.id IS NULL
    ORDER BY u.sort, i.sort
  `).all(studentId, courseId);
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
  const { date, done } = req.body;
  if (date !== undefined) {
    if (!isDateStr(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
    db.prepare(`UPDATE schedule SET date = ? WHERE id = ?`).run(date, req.params.id);
  }
  if (done !== undefined) {
    const d = done ? 1 : 0;
    db.prepare(`UPDATE schedule SET done = ?, done_at = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?`).run(d, d, req.params.id);
  }
  res.json({ ok: true });
});

app.post('/api/schedule/reorder', requirePin, (req, res) => {
  const stmt = db.prepare(`UPDATE schedule SET sort = ? WHERE id = ?`);
  const run = db.transaction((tasks) => { for (const t of tasks) stmt.run(t.sort, t.id); });
  run(req.body.tasks || []);
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
           i.id AS itemId, i.type, i.title AS itemTitle, c.name AS courseName, c.color AS courseColor
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
           i.id AS itemId, i.type, i.title AS itemTitle, i.body, c.name AS courseName, c.color AS courseColor
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
    SELECT sc.date, sc.title AS offlineTitle, sc.done, i.title AS itemTitle, i.type, i.body, c.name AS courseName
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

const HOMESCHOOL_DIR = process.env.HOMESCHOOL_DIR || "/Users/nateemmert/Library/CloudStorage/SeaDrive-NateEmmert(seafile.necloud.us)/My Libraries/Homeschool";

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


// Public: students need to open attachments without a PIN
app.get('/api/attachments/:filename', (req, res) => {
  const filename = req.params.filename;
  // Only allow safe filenames (UUID + extension)
  if (!/^[\w-]+\.\w+$/.test(filename)) return res.status(400).json({ error: 'Invalid filename' });
  const filePath = join(ATTACHMENTS_DIR, filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filePath);
});

app.post('/api/admin/upload-attachment', requirePin, async (req, res) => {
  const { base64: b64, originalName } = req.body;
  if (!b64 || !originalName) return res.status(400).json({ error: 'base64 and originalName required' });

  let buffer;
  try { buffer = Buffer.from(b64, 'base64'); }
  catch (err) { return res.status(400).json({ error: 'Invalid base64' }); }

  const ext = extname(originalName).toLowerCase() || '.docx';
  const uuid = randomUUID();
  const filename = `${uuid}${ext}`;
  try {
    await writeFile(join(ATTACHMENTS_DIR, filename), buffer);
  } catch (err) {
    return res.status(500).json({ error: `Could not save file: ${err.message}` });
  }

  // Convert to HTML for inline editing in the RTE
  let htmlBody = null;
  try {
    const { value } = await mammoth.convertToHtml({ buffer });
    htmlBody = value || null;
  } catch (_) {
    // conversion failed — download link still available
  }

  return res.json({ url: `/api/attachments/${filename}`, htmlBody, originalName });
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Spelling v2 running on http://localhost:${PORT}`));
