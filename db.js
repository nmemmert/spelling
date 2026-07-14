import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'spelling.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🙂',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    builtin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    sentence TEXT NOT NULL DEFAULT ''
  );

  -- one active weekly assignment per student
  CREATE TABLE IF NOT EXISTS assignments (
    student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Leitner state per student per word. box 0 = new, 5 = mastered.
  CREATE TABLE IF NOT EXISTS progress (
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    box INTEGER NOT NULL DEFAULT 0,
    due TEXT NOT NULL DEFAULT (date('now')),
    attempts INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (student_id, word_id)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    typed TEXT NOT NULL,
    correct INTEGER NOT NULL,
    mode TEXT NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS test_answers (
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    typed TEXT NOT NULL,
    correct INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- flashcards module
  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    builtin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS card_progress (
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    box INTEGER NOT NULL DEFAULT 0,
    due TEXT NOT NULL DEFAULT (date('now')),
    attempts INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (student_id, card_id)
  );

  -- ---------- LMS layer ----------

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#4f86f7',
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  -- type: lesson | assignment | quiz | spelling_practice | spelling_test | flashcards
  -- ref_id: list_id for spelling_*, deck_id for flashcards. points: max score for assignment/quiz.
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL DEFAULT 0,
    ref_id INTEGER,
    sort INTEGER NOT NULL DEFAULT 0
  );

  -- type: mc | tf | short
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    choices TEXT NOT NULL DEFAULT '[]',
    correct_answer TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );

  -- one row per student per item. status: done (ungraded) | graded
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'done',
    score REAL,
    points_possible REAL,
    answers TEXT,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    graded_at TEXT,
    UNIQUE(student_id, item_id)
  );

  -- daily agenda. item_id set = a scheduled course item; null = a standalone offline task (title used)
  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule(student_id, date);

  CREATE TABLE IF NOT EXISTS quiz_templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS quiz_template_questions (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES quiz_templates(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    choices TEXT NOT NULL DEFAULT '[]',
    correct_answer TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS submission_history (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    score REAL,
    points_possible REAL,
    answers TEXT,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function tryAlter(sql) {
  try { db.exec(sql); } catch { /* column already exists */ }
}
tryAlter(`ALTER TABLE items ADD COLUMN due_date TEXT`);
tryAlter(`ALTER TABLE items ADD COLUMN allow_retakes INTEGER NOT NULL DEFAULT 0`);
tryAlter(`ALTER TABLE items ADD COLUMN prereq_item_id INTEGER`);
tryAlter(`ALTER TABLE items ADD COLUMN evidence_mode TEXT NOT NULL DEFAULT 'none'`);
tryAlter(`ALTER TABLE items ADD COLUMN retake_policy TEXT NOT NULL DEFAULT 'latest'`);
tryAlter(`ALTER TABLE submissions ADD COLUMN evidence_notes TEXT`);
tryAlter(`ALTER TABLE submissions ADD COLUMN evidence_photo TEXT`);
tryAlter(`ALTER TABLE submissions ADD COLUMN student_note TEXT`);
tryAlter(`ALTER TABLE submissions ADD COLUMN parent_comment TEXT`);
tryAlter(`ALTER TABLE schedule ADD COLUMN status TEXT NOT NULL DEFAULT 'not_started'`);
tryAlter(`ALTER TABLE schedule ADD COLUMN evidence_notes TEXT`);
tryAlter(`ALTER TABLE schedule ADD COLUMN evidence_photo TEXT`);

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

// Default parent PIN on first run
if (!db.prepare(`SELECT value FROM settings WHERE key = 'pin'`).get()) {
  db.prepare(`INSERT INTO settings (key, value) VALUES ('pin', ?)`).run(sha256('1234'));
}

// Default scan config (local Ollama primary, no cloud key yet)
const seedSetting = (key, val) => {
  if (!db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key))
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(key, val);
};
seedSetting('scan_primary', 'local');
seedSetting('ollama_host', 'http://localhost:11434');
seedSetting('ollama_model', 'llava');
seedSetting('cloud_endpoint', 'https://api.openai.com/v1');
seedSetting('cloud_model', 'gpt-4o');

// Seed bundled word lists on first run
if (db.prepare(`SELECT COUNT(*) AS n FROM lists`).get().n === 0) {
  const seed = JSON.parse(readFileSync(join(ROOT, 'seed-lists.json'), 'utf8'));
  const insList = db.prepare(`INSERT INTO lists (name, builtin) VALUES (?, 1)`);
  const insWord = db.prepare(`INSERT INTO words (list_id, word, sentence) VALUES (?, ?, ?)`);
  for (const list of seed) {
    const listId = insList.run(list.name).lastInsertRowid;
    for (const entry of list.words) {
      const { word, sentence = '' } = typeof entry === 'string' ? { word: entry } : entry;
      insWord.run(listId, word, sentence);
    }
  }
}

// Seed bundled flashcard decks on first run
if (db.prepare(`SELECT COUNT(*) AS n FROM decks`).get().n === 0) {
  const seed = JSON.parse(readFileSync(join(ROOT, 'seed-decks.json'), 'utf8'));
  const insDeck = db.prepare(`INSERT INTO decks (name, builtin) VALUES (?, 1)`);
  const insCard = db.prepare(`INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)`);
  for (const deck of seed) {
    const deckId = insDeck.run(deck.name).lastInsertRowid;
    for (const c of deck.cards) insCard.run(deckId, c.front, c.back);
  }
}
