#!/usr/bin/env node
// Converts "Kitchen, Tools & Electrical Skills" docx files into a homeschool-lms-course JSON bundle.
// Usage: node scripts/import-kitchen-course.js > kitchen-course.json
// Then import the JSON via the admin "Import course" UI.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const BASE = "/Users/nateemmert/Library/CloudStorage/SeaDrive-NateEmmert(seafile.necloud.us)/My Libraries/Homeschool/Kitchen, Tools, & Electrical Skills";

const UNIT_FILES = [
  { letter: 'A', file: 'Unit_A_Kitchen_Safety_Foundations.docx',  title: 'Kitchen Safety & Foundations' },
  { letter: 'B', file: 'Unit_B_Baking_Fundamentals.docx',         title: 'Baking Fundamentals' },
  { letter: 'C', file: 'Unit_C_Everyday_Cooking_Skills.docx',     title: 'Everyday Cooking Skills' },
  { letter: 'D', file: 'Unit_D_Cooking_Baking_Capstone.docx',     title: 'Cooking & Baking Capstone' },
  { letter: 'E', file: 'Unit_E_Shop_Safety_Hand_Tools.docx',      title: 'Shop Safety & Hand Tools' },
  { letter: 'F', file: 'Unit_F_Power_Tools_Framing.docx',         title: 'Power Tools & Framing Basics' },
  { letter: 'G', file: 'Unit_G_Electrical_Fundamentals.docx',     title: 'Electrical Fundamentals' },
  { letter: 'H', file: 'Unit_H_Wired_Wall_Capstone.docx',         title: 'Wired Wall Capstone' },
];

function toMd(filePath) {
  return execFileSync('pandoc', ['-t', 'markdown', filePath], { encoding: 'utf8' });
}

function clean(s) {
  return s
    .replace(/\n\s{4,}/g, ' ')   // unwrap indented continuation lines
    .replace(/\\'/g, "'")
    .replace(/\\"/, '"')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\\_/g, '_')
    .replace(/\\-/g, '-')
    .replace(/\\\./g, '.')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\*/g, '*')
    .replace(/\\!/g, '!')
    .replace(/\\#/g, '#')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripBold(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').trim();
}

// Returns the text inside **...** if the entire block is a bold paragraph, else null.
function getBoldContent(block) {
  const m = block.match(/^\*\*(.+)\*\*$/s);
  return m ? m[1].trim() : null;
}

const SECTION_LABELS = {
  'Objective': 'OBJECTIVE',
  'Materials Needed': 'MATERIALS NEEDED',
  'Lesson & Activity Steps': 'LESSON STEPS',
  'Safety Notes': 'SAFETY NOTES',
  'Wrap-Up Discussion': 'WRAP-UP DISCUSSION',
};

function formatBodyBlock(block) {
  // Bold heading → section label
  const bold = getBoldContent(block);
  if (bold) {
    const text = clean(stripBold(bold));
    return SECTION_LABELS[text] ? `\n${SECTION_LABELS[text]}` : null;
  }

  // Bullet: "- text"
  if (/^-\s+/.test(block)) {
    return '• ' + clean(block.replace(/^-\s+/, ''));
  }

  // Numbered list item: "1.  text..."
  const numMatch = block.match(/^(\d+)\.\s{1,2}(.+)$/s);
  if (numMatch) {
    return `${numMatch[1]}. ${clean(numMatch[2])}`;
  }

  // Regular paragraph
  return clean(block.replace(/\n/g, ' '));
}

function parseUnit(letter, md) {
  const blocks = md.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);

  const weeks = [];
  let current = null;
  let inQuiz = false;
  let inAnswers = false;
  const quizQuestions = [];
  const quizAnswers = [];

  for (const block of blocks) {
    const bold = getBoldContent(block);

    // Week heading: **Week N: Title**
    if (bold) {
      const weekMatch = bold.match(/^Week (\d+):\s*(.+)$/i);
      if (weekMatch) {
        if (current) weeks.push(current);
        inQuiz = false;
        inAnswers = false;
        current = { title: `Week ${weekMatch[1]}: ${clean(stripBold(weekMatch[2]))}`, bodyBlocks: [] };
        continue;
      }

      // Worksheet heading: skip it and its table content
      if (/^Week \d+ Worksheet:/i.test(bold)) { current = current ? { ...current, skipTable: true } : null; continue; }

      // Quiz heading
      if (/^Unit [A-H] Quiz:/i.test(bold)) {
        if (current) { weeks.push(current); current = null; }
        inQuiz = true; inAnswers = false;
        continue;
      }

      // Answer key
      if (/^Answer Key$/i.test(bold)) { inAnswers = true; inQuiz = false; continue; }
    }

    // Skip table rows (worksheet content)
    if (block.startsWith('+') || block.startsWith('|')) continue;

    // Skip horizontal rules
    if (/^[\\-]{10,}$/.test(block)) continue;

    // Skip "Name: ___ Date: ___" lines
    if (/^Name:\s*\\?_/.test(block)) continue;

    if (inAnswers) {
      const m = block.match(/^(\d+)[\\.]+\s+(.+)$/s);
      if (m) quizAnswers.push(clean(m[2]));
      continue;
    }

    if (inQuiz) {
      const m = block.match(/^(\d+)[\\.]+\s+(.+)$/s);
      if (m) quizQuestions.push(clean(m[2]));
      continue;
    }

    // Pre-week boilerplate (current === null) — skip
    if (!current) continue;

    // Skip worksheet heading we already consumed; reset flag after the table clears
    if (current.skipTable) {
      if (block.startsWith('+') || block.startsWith('|')) continue;
      current.skipTable = false;
      continue;
    }

    current.bodyBlocks.push(block);
  }
  if (current) weeks.push(current);

  // Build lesson items
  const items = weeks.map((w, i) => {
    const lines = w.bodyBlocks.map(formatBodyBlock).filter(Boolean);
    return {
      type: 'lesson',
      title: w.title,
      body: lines.join('\n'),
      points: 0,
      sort: i,
      allow_retakes: 0,
      evidence_mode: 'none',
      retake_policy: 'latest',
    };
  });

  // Build quiz item
  if (quizQuestions.length) {
    const questions = quizQuestions.map((q, i) => ({
      type: /^True or False/i.test(q) ? 'tf' : 'short',
      prompt: q,
      choices: [],
      correct_answer: quizAnswers[i] || '',
      points: 1,
      sort: i,
    }));
    items.push({
      type: 'quiz',
      title: `Unit ${letter} Quiz`,
      body: '',
      points: questions.length,
      sort: items.length,
      allow_retakes: 1,
      evidence_mode: 'none',
      retake_policy: 'latest',
      questions,
    });
  }

  return items;
}

const bundle = {
  format: 'homeschool-lms-course',
  version: 1,
  course: {
    name: 'Kitchen, Tools & Electrical Skills',
    subject: 'Life Skills',
    color: '#e87c2e',
  },
  units: [],
};

for (const u of UNIT_FILES) {
  const filePath = join(BASE, 'Units', u.file);
  process.stderr.write(`Unit ${u.letter}: ${u.title}…\n`);
  const md = toMd(filePath);
  const items = parseUnit(u.letter, md);
  const lessons = items.filter(i => i.type === 'lesson').length;
  const quizzes = items.filter(i => i.type === 'quiz').length;
  process.stderr.write(`  → ${lessons} lessons, ${quizzes} quiz\n`);
  bundle.units.push({ name: `Unit ${u.letter}: ${u.title}`, sort: bundle.units.length, items });
}

process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
process.stderr.write('Done.\n');
