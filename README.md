# 🎓 Homeschool

A self-hosted homeschool learning platform — courses, lessons, assignments, quizzes, and a gradebook — with spelling practice and flashcards built in as first-class activity types. Two apps share one server: a kid-facing app (`index.html`) and a PIN-protected parent console (`admin.html`).

## How it's organized

- **Courses → Units → Items.** A parent builds courses (e.g. "Science 3"), each broken into units (e.g. "Week 1: Weather"), each holding items: lessons, assignments, quizzes, or an embedded spelling/flashcards activity.
- **Lessons** are parent-authored content (text, images, YouTube embeds) the kid marks as read.
- **Assignments** are turned in with a tap ("Mark as done") and graded by a parent from a grading queue.
- **Quizzes** (multiple choice, true/false, short answer) are auto-graded on submission, with a right/wrong review shown immediately.
- **Spelling and flashcards** activities reuse the same engines described below, and their results flow into the same gradebook.
- **Daily agenda.** A parent schedules items (or free-text offline tasks like "Read Ch. 3") onto specific days in the weekly planner; the kid's home screen shows "Today's work" as a checklist that fills in as they go.
- **Gradebook.** Every graded item (assignments, quizzes, spelling tests) rolls up per course into a percentage, with a printable weekly report for homeschool portfolio records.

## How the spelling module works

- **Dictation practice** — the browser speaks each word (and an example sentence if the list has one); the kid types it. No internet or API keys needed — it uses the browser's built-in speech synthesis.
- **Letter-diff feedback** — a wrong answer shows exactly which letters were wrong, then the correct word appears for a few seconds, hides, and the kid retypes it from memory (look–cover–write–check).
- **Leitner spaced repetition** — every word has a box (0–5). Right on the first try moves it up a box and pushes the next review out (1 → 2 → 4 → 7 → 14 days). A miss sends it back to box 1. Box 5 = mastered. Daily practice mixes the current list with whatever old words are due.
- **Spelling test** — every word on the list, dictation only, no hints or retries. Scores are saved, and missed words automatically re-enter the practice rotation.

## How the flashcards module works

Classic flip-cards (front → reveal → "Got it!" / "Study more") using the same Leitner scheduler as spelling, so a deck's due cards resurface on the right day automatically. Works standalone or as a course item.

## Running it

```bash
npm install
npm start          # http://localhost:3000
```

Or with Docker:

```bash
docker compose up -d
```

The SQLite database lives in `./data/` (mounted as a volume in Docker).

Requires Node 24+ (uses the built-in `node:sqlite` module — no native dependencies).

## First-time setup

1. Open the app → **Parent dashboard** (`/admin.html`) → PIN `1234` (change it in Settings).
2. Add your kids.
3. Build a course: add units, then add items (lessons, assignments, quizzes, or a spelling/flashcards activity pointing at a list or deck).
4. Enroll kids in the course, from the course's Roster section.
5. Use the Weekly Planner to schedule items onto specific days — or let kids browse everything anytime from **My Courses**.
6. For spelling specifically: pick a built-in Dolch list or create your own (one word per line, optional `word | example sentence`), then assign each kid a weekly list from the Spelling panel.

Kids just tap their name — no passwords. Everything they do (course work or spelling) reports back into the parent console automatically.
