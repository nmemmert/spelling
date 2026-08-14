// ---------- tiny helpers ----------

const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function show(name) {
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  $(`#view-${name}`).hidden = false;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const todayStr = () => new Date().toISOString().slice(0, 10);

const TYPE_ICON = {
  lesson: '📖', assignment: '📝', quiz: '❓', matching: '🔤', crossword: '⬛',
  spelling_practice: '✏️', spelling_test: '⭐', flashcards: '🗂️', worksheet: '📋',
};
const TYPE_LABEL = {
  lesson: 'Lesson', assignment: 'Assignment', quiz: 'Quiz', matching: 'Matching', crossword: 'Crossword',
  spelling_practice: 'Spelling Practice', spelling_test: 'Spelling Test', flashcards: 'Flashcards',
  worksheet: 'Worksheet',
};

document.querySelectorAll('[data-nav]').forEach((btn) =>
  btn.addEventListener('click', () => {
    speechSynthesis.cancel();
    if (btn.dataset.nav === 'home') {
      loadHome();
      show('home');
    }
  })
);

// Sub-views set this before opening so their back/stop button knows where to return
let backTarget = () => openKid(currentStudent.id);
document.querySelectorAll('[data-back]').forEach((btn) =>
  btn.addEventListener('click', () => {
    speechSynthesis.cancel();
    backTarget();
  })
);

// ---------- evidence photo helpers ----------

let evidencePhotoBase64 = null;

function compressPhoto(file, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('#assignment-photo-btn').addEventListener('click', () => $('#assignment-photo-input').click());
$('#assignment-photo-input').addEventListener('change', async () => {
  const file = $('#assignment-photo-input').files[0];
  if (!file) return;
  try {
    const dataUrl = await compressPhoto(file);
    evidencePhotoBase64 = dataUrl;
    $('#assignment-photo-status').textContent = '✅ Photo ready';
  } catch { $('#assignment-photo-status').textContent = '❌ Could not load photo'; }
});

// ---------- text to speech (spelling module) ----------

// piperAvailable: null = not yet checked, true/false after first /api/tts/status call
let piperAvailable = null;
let ttsQueue = [];
let ttsCurrentAudio = null;

async function checkPiper() {
  if (piperAvailable !== null) return piperAvailable;
  try {
    const { available } = await api('/api/tts/status');
    piperAvailable = available;
  } catch {
    piperAvailable = false;
  }
  return piperAvailable;
}

function ttsCancel() {
  ttsQueue = [];
  if (ttsCurrentAudio) { ttsCurrentAudio.pause(); ttsCurrentAudio = null; }
  speechSynthesis.cancel();
}

async function ttsDrain() {
  if (!ttsQueue.length) { ttsCurrentAudio = null; return; }
  const text = ttsQueue.shift();

  if (piperAvailable) {
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`);
    ttsCurrentAudio = audio;
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve);
    });
  } else {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85; u.lang = 'en-US';
    speechSynthesis.cancel();
    await new Promise((resolve) => {
      u.onend = resolve;
      u.onerror = resolve;
      // some browsers need a short delay after cancel() before speak() works
      setTimeout(() => speechSynthesis.speak(u), 50);
    });
  }
  ttsDrain();
}

async function speakWord(w) {
  ttsCancel();
  await checkPiper();
  ttsQueue.push(w.word);
  if (w.definition) ttsQueue.push(w.definition);
  if (w.sentence) ttsQueue.push(w.sentence);
  ttsDrain();
}

// ---------- letter diff (LCS alignment, spelling module) ----------

function diffLetters(typed, correct) {
  const a = typed.toLowerCase(), b = correct.toLowerCase();
  const m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);

  const typedParts = [], correctParts = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      typedParts.push(`<span class="ltr-ok">${esc(typed[i])}</span>`);
      correctParts.push(`<span class="ltr-ok">${esc(correct[j])}</span>`);
      i++; j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      typedParts.push(`<span class="ltr-bad">${esc(typed[i])}</span>`);
      i++;
    } else {
      correctParts.push(`<span class="ltr-fix">${esc(correct[j])}</span>`);
      j++;
    }
  }
  while (i < m) typedParts.push(`<span class="ltr-bad">${esc(typed[i++])}</span>`);
  while (j < n) correctParts.push(`<span class="ltr-fix">${esc(correct[j++])}</span>`);
  return { typedHtml: typedParts.join(''), correctHtml: correctParts.join('') };
}

// ---------- themes ----------

const THEMES = {
  blue:   {},
  green:  { '--accent': '#2e9e5b', '--accent-dark': '#247a47', '--bg': '#f0faf4' },
  purple: { '--accent': '#7c5cbf', '--accent-dark': '#6245a0', '--bg': '#f8f4ff' },
  orange: { '--accent': '#e8802a', '--accent-dark': '#c96a1a', '--bg': '#fff8f0' },
  pink:   { '--accent': '#d45d8a', '--accent-dark': '#b4487a', '--bg': '#fff0f5' },
  red:    { '--accent': '#e84040', '--accent-dark': '#c42828', '--bg': '#fff5f5' },
  teal:   { '--accent': '#20a8a0', '--accent-dark': '#178880', '--bg': '#f0faf9' },
  yellow: { '--accent': '#c8960c', '--accent-dark': '#a87a06', '--bg': '#fffbf0' },
  indigo: { '--accent': '#5b6abf', '--accent-dark': '#4a57a0', '--bg': '#f4f5ff' },
};

const ANIMAL_EMOJIS = [
  '🐶','🐱','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🦆',
  '🦉','🦋','🐢','🦄','🐬','🦈','🦖','🦕',
  '🐺','🦝','🦔','🐿️','🦜','🦩','🦚','🐙',
];
const THEME_NAMES = Object.keys(THEMES);
const DEFAULT_VARS = { '--accent': '#4f86f7', '--accent-dark': '#3a6fd8', '--bg': '#fdf6e3' };

function applyTheme(theme) {
  const vars = THEMES[theme] || {};
  for (const [k, v] of Object.entries(DEFAULT_VARS))
    document.documentElement.style.setProperty(k, vars[k] || v);
  const bgClass = [...document.body.classList].find(c => c.startsWith('bg-'));
  document.body.className = theme && theme !== 'blue' ? `theme-${theme}` : '';
  if (bgClass) document.body.classList.add(bgClass);
}

const BG_PATTERNS = ['none','dots','stripes','grid','stars','bubbles'];

function applyBgPattern(pattern) {
  BG_PATTERNS.forEach(p => document.body.classList.remove(`bg-${p}`));
  if (pattern && pattern !== 'none') document.body.classList.add(`bg-${pattern}`);
  document.querySelectorAll('.bg-pattern-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.pattern === (pattern || 'none'))
  );
}

function resetTheme() {
  for (const k of Object.keys(DEFAULT_VARS)) document.documentElement.style.removeProperty(k);
  document.body.className = '';
}

// ---------- home (kid picker) ----------

let currentStudent = null;

async function loadHome() {
  resetTheme();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning! ☀️'
                 : hour < 17 ? 'Good afternoon! 🌤️'
                 : 'Good evening! 🌙';
  document.querySelector('.subtitle').textContent = greeting;

  const pubSettings = await fetch('/api/public-settings').then((r) => r.json()).catch(() => ({}));
  document.querySelector('.page-confetti').style.display =
    pubSettings.show_home_emoji === false ? 'none' : '';

  const nameTitle = document.getElementById('school-name-title');
  if (pubSettings.school_name) {
    nameTitle.textContent = pubSettings.school_name;
    document.title = pubSettings.school_name;
  }
  const logoEl = document.getElementById('school-logo');
  if (pubSettings.has_logo) {
    logoEl.src = `/api/logo?v=${Date.now()}`;
    logoEl.hidden = false;
    nameTitle.hidden = true;
  } else {
    logoEl.hidden = true;
    nameTitle.hidden = false;
  }

  const students = await api('/api/students');
  $('#no-kids').hidden = students.length > 0;
  $('#kid-cards').innerHTML = students
    .map((s, i) => {
      const accent = (THEMES[s.theme || 'blue'] || {})['--accent'] || DEFAULT_VARS['--accent'];
      return `<button class="kid-card" data-id="${s.id}" data-theme="${esc(s.theme || 'blue')}" style="--kid-accent:${accent};animation-delay:${i * 100}ms">
        <span class="avatar">${esc(s.emoji)}</span>${esc(s.name)}</button>`;
    })
    .join('');
  document.querySelectorAll('.kid-card').forEach((card) =>
    card.addEventListener('click', () => openKid(Number(card.dataset.id), 'today', true))
  );
}

// ---------- kid home: Today / Courses / Spelling ----------

let currentCourseItems = []; // flat [{id, type, title}] from most-recently opened course

function findNextCourseItem(currentId) {
  const idx = currentCourseItems.findIndex((it) => it.id === currentId);
  if (idx === -1 || idx >= currentCourseItems.length - 1) return null;
  return currentCourseItems[idx + 1];
}

function showNextActions(containerId, currentItemId) {
  const next = findNextCourseItem(currentItemId);
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!next) { backTarget(); return; }
  el.hidden = false;
  el.innerHTML = `
    <button class="check-btn" id="next-item-btn">Next: ${esc(next.title)} →</button>
    <button class="check-btn secondary" id="back-course-btn">← Back to course</button>
  `;
  document.getElementById('next-item-btn').addEventListener('click', () => { el.hidden = true; openItem(next.id, next.type); });
  document.getElementById('back-course-btn').addEventListener('click', () => { el.hidden = true; backTarget(); });
}

document.querySelectorAll('.nav-pill').forEach((pill) =>
  pill.addEventListener('click', () => switchTab(pill.dataset.tab))
);

const TAB_ORDER = ['today', 'courses', 'spelling'];
let currentTab = 'today';

function switchTab(name) {
  const animate = name !== currentTab;
  const dir = TAB_ORDER.indexOf(name) > TAB_ORDER.indexOf(currentTab) ? 'right' : 'left';
  currentTab = name;
  document.querySelectorAll('.nav-pill').forEach((p) => p.classList.toggle('active', p.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const isTarget = panel.id === `tab-${name}`;
    panel.hidden = !isTarget;
    if (isTarget && animate) {
      panel.classList.remove('sliding-right', 'sliding-left');
      void panel.offsetWidth;
      panel.classList.add(dir === 'right' ? 'sliding-right' : 'sliding-left');
    }
  });
}

async function openKid(id, tab = 'today', welcome = false) {
  const [state, agenda, courses, { tests: recentTests }] = await Promise.all([
    api(`/api/state/${id}`),
    api(`/api/schedule/${id}?date=${todayStr()}`),
    api(`/api/courses/mine/${id}`),
    api(`/api/students/${id}/tests`),
  ]);
  currentStudent = state.student;
  youngLearnerMode = !!currentStudent.young_learner;
  applyTheme(currentStudent.theme || 'blue');
  applyBgPattern(currentStudent.bg_pattern || 'none');
  updateThemeDots(currentStudent.theme || 'blue');

  $('#kid-greeting').textContent = `${state.student.emoji} Hi, ${state.student.name}!`;

  // Show streak pill if kid has a streak
  const existingPill = document.querySelector('.streak-pill');
  if (existingPill) existingPill.remove();
  if (state.student.streak_count >= 2) {
    const pill = document.createElement('div');
    pill.className = 'streak-pill';
    pill.textContent = `🔥 ${state.student.streak_count} day streak!`;
    $('#kid-greeting').insertAdjacentElement('afterend', pill);
  }

  renderToday(agenda.tasks);
  renderCourseCards(courses);
  renderSpellingTab(state, recentTests);

  show('kid');
  currentTab = tab;
  switchTab(tab);
  if (welcome) showWelcomeToast(currentStudent.emoji, currentStudent.name);

  // Birthday celebration — show once per day when it's the student's birthday week
  if (state.student.isBirthdayWeek) showBirthdayCelebration(state.student.name);

  // Celebrate if all today's tasks are done
  if (agenda.tasks.length > 0) {
    const allDone = agenda.tasks.every((t) =>
      t.done || t.offlineStatus === 'done' || t.subStatus === 'graded' || t.subStatus === 'done'
    );
    if (allDone) {
      const result = await api(`/api/students/${id}/complete-day`, { method: 'POST' });
      if (!result.alreadyCounted) showCelebration(result);
    }
  }
}

function updateThemeDots(active) {
  document.querySelectorAll('.theme-dot').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.theme === active)
  );
}

function showCelebration({ streak, best }) {
  playFanfare();
  const isRecord = streak > 1 && streak === best;
  let streakHtml = '';
  if (streak >= 2) {
    streakHtml = `<div class="streak-badge">🔥 ${streak} days in a row!</div>
      ${isRecord ? `<div class="best-streak-label">🏆 New record!</div>` : `<div class="streak-label">Best: ${best} days</div>`}`;
  } else {
    streakHtml = `<div class="streak-label" style="margin-bottom:1rem">Keep it up — come back tomorrow for a streak!</div>`;
  }
  $('#streak-display').innerHTML = streakHtml;
  $('#celebration-overlay').hidden = false;
}

$('#celebration-close').addEventListener('click', () => {
  $('#celebration-overlay').hidden = true;
});

// ---------- birthday celebration ----------

function showBirthdayCelebration(name) {
  const key = `bday_shown_${name}_${todayStr()}`;
  if (sessionStorage.getItem(key)) return; // only once per session per day
  sessionStorage.setItem(key, '1');
  $('#birthday-heading').textContent = `Happy Birthday, ${name}! 🎉`;
  $('#birthday-message').textContent = 'Wishing you an amazing day full of fun and joy!';
  $('#birthday-overlay').hidden = false;
  playFanfare();
  popConfetti();
}

$('#birthday-close').addEventListener('click', () => {
  $('#birthday-overlay').hidden = true;
});

// ---------- mini celebration (confetti + toast) ----------

let pendingMiniCelebration = false;

function popConfetti() {
  const colors = ['#4f86f7','#e84040','#2e9e5b','#e8802a','#7c5cbf','#d45d8a','#c8960c','#20a8a0','#f7c948','#ff6b6b','#48dbfb'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999;overflow:hidden';
  document.body.appendChild(container);
  for (let i = 0; i < 160; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const x = Math.random() * 110 - 5;
    const delay = Math.random() * 1.2;
    const dur = 1.8 + Math.random() * 1.4;
    const size = 10 + Math.random() * 18;
    const shape = Math.random();
    let borderRadius = '2px';
    if (shape > 0.66) borderRadius = '50%';
    else if (shape > 0.33) borderRadius = '0';
    piece.style.cssText = `position:absolute;left:${x}%;top:-30px;width:${size}px;height:${size * (0.4 + Math.random() * 0.8)}px;`
      + `background:${color};border-radius:${borderRadius};`
      + `animation:confetti-fall ${dur}s ${delay}s ease-in forwards;transform:rotate(${Math.random()*360}deg)`;
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 4000);
}

function playFlip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.14);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.start(t); osc.stop(t + 0.16);
    setTimeout(() => ctx.close(), 400);
  } catch(e) {}
}

function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.35);
    setTimeout(() => ctx.close(), 600);
  } catch(e) {}
}

function playBuzz() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t); osc.stop(t + 0.22);
    setTimeout(() => ctx.close(), 400);
  } catch(e) {}
}

function playFanfare() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    // Rising arpeggio
    [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.39]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      const s = t + delay;
      g.gain.setValueAtTime(0.38, s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.28);
      osc.start(s); osc.stop(s + 0.28);
    });
    // Final sustained chord
    [523, 659, 784, 1047].forEach((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      const s = t + 0.55;
      g.gain.setValueAtTime(0.22, s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 1.1);
      osc.start(s); osc.stop(s + 1.15);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch(e) {}
}

function animateScore(el, score, total) {
  if (!el) return;
  const duration = 650;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${Math.round(eased * score)} / ${total}`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function playPopSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Thump: short pitch-sweep down like a party popper
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.13);
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.start(t); osc.stop(t + 0.13);

    // Sparkle: quick ascending arpeggio C-E-G-C
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      const s = t + 0.06 + i * 0.075;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.28, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.13);
      o.start(s); o.stop(s + 0.15);
    });

    setTimeout(() => ctx.close(), 1200);
  } catch (e) {}
}

const CHEERS = [
  '🎉 Nailed it!', '⭐ Star student!', '💪 You\'re crushing it!',
  '🔥 On fire!', '🎯 Spot on!', '✨ Brilliant!',
  '🚀 Killing it!', '🏅 Awesome work!', '💫 You rock!', '🦾 Unstoppable!',
];
function randomCheer() { return CHEERS[Math.floor(Math.random() * CHEERS.length)]; }

function showMiniCelebration(msg = '🎉 Great job!') {
  playPopSound();
  popConfetti();
  const toast = document.createElement('div');
  toast.className = 'mini-celebration-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'mini-toast-out 0.5s ease forwards'; }, 1800);
  setTimeout(() => toast.remove(), 2400);
}

function showWelcomeToast(emoji, name) {
  const toast = document.createElement('div');
  toast.className = 'welcome-toast';
  toast.innerHTML = `<span class="welcome-emoji">${emoji}</span><div class="welcome-name">Hi, ${esc(name)}! 👋</div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('welcome-toast-out'), 1700);
  setTimeout(() => toast.remove(), 2150);
}

function showDoneStamp() {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'done-stamp-wrap';
    const stamp = document.createElement('div');
    stamp.className = 'done-stamp';
    stamp.textContent = '✅';
    wrap.appendChild(stamp);
    document.body.appendChild(wrap);
    setTimeout(() => {
      stamp.classList.add('done-stamp-out');
      setTimeout(() => { wrap.remove(); resolve(); }, 380);
    }, 750);
  });
}

// Theme picker toggle
$('#theme-picker-btn').addEventListener('click', () => {
  $('#theme-dots').hidden = !$('#theme-dots').hidden;
  $('#icon-grid').hidden = true;
  $('#bg-pattern-panel').hidden = true;
});

// BG pattern picker toggle
$('#bg-picker-btn').addEventListener('click', () => {
  $('#bg-pattern-panel').hidden = !$('#bg-pattern-panel').hidden;
  $('#theme-dots').hidden = true;
  $('#icon-grid').hidden = true;
});

document.querySelectorAll('.bg-pattern-btn').forEach(btn =>
  btn.addEventListener('click', async () => {
    const pattern = btn.dataset.pattern;
    applyBgPattern(pattern);
    currentStudent.bg_pattern = pattern;
    await api(`/api/students/${currentStudent.id}/bg-pattern`, { method: 'PATCH', body: { pattern } });
    $('#bg-pattern-panel').hidden = true;
  })
);

document.querySelectorAll('.theme-dot').forEach((btn) =>
  btn.addEventListener('click', async () => {
    const theme = btn.dataset.theme;
    applyTheme(theme);
    updateThemeDots(theme);
    currentStudent.theme = theme;
    await api(`/api/students/${currentStudent.id}/theme`, { method: 'PATCH', body: { theme } });
    $('#theme-dots').hidden = true;
  })
);

// ---------- animal / icon picker ----------

$('#icon-picker-btn').addEventListener('click', () => {
  const grid = $('#icon-grid');
  if (grid.hidden) {
    grid.innerHTML = ANIMAL_EMOJIS.map((e) =>
      `<button class="icon-choice${currentStudent && currentStudent.emoji === e ? ' active' : ''}" data-emoji="${e}">${e}</button>`
    ).join('');
    grid.querySelectorAll('.icon-choice').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const emoji = btn.dataset.emoji;
        currentStudent.emoji = emoji;
        $('#kid-greeting').textContent = `${emoji} Hi, ${currentStudent.name}!`;
        grid.querySelectorAll('.icon-choice').forEach((b) => b.classList.toggle('active', b.dataset.emoji === emoji));
        await api(`/api/students/${currentStudent.id}/emoji`, { method: 'PATCH', body: { emoji } });
        grid.hidden = true;
      })
    );
  }
  grid.hidden = !grid.hidden;
  $('#theme-dots').hidden = true;
  $('#bg-pattern-panel').hidden = true;
});

const OFFLINE_STATUS_ICON = { not_started: '⬜', in_progress: '🔄', done: '✅' };

function renderToday(tasks) {
  $('#today-empty').hidden = tasks.length > 0;
  $('#today-list').innerHTML = tasks
    .map((t) => {
      if (!t.itemId) {
        const st = t.offlineStatus || (t.done ? 'done' : 'not_started');
        return `<div class="today-row-offline" data-schedule-id="${t.id}">
          <div class="offline-main">
            <span class="row-check">${OFFLINE_STATUS_ICON[st] || '⬜'}</span>
            <span class="row-title">${esc(t.offlineTitle)}</span>
            <span class="row-badge">📌${t.hasEvidence ? ' 📎' : ''}</span>
          </div>
          <div class="offline-controls">
            <button class="offline-status-btn ${st === 'not_started' ? 'active' : ''}" data-sid="${t.id}" data-status="not_started">Not started</button>
            <button class="offline-status-btn ${st === 'in_progress' ? 'active' : ''}" data-sid="${t.id}" data-status="in_progress">In progress</button>
            <button class="offline-status-btn ${st === 'done' ? 'active' : ''}" data-sid="${t.id}" data-status="done">Done ✓</button>
          </div>
          <details class="offline-evidence-form">
            <summary>📎 Add notes / photo</summary>
            <div class="evidence-inner">
              <textarea class="offline-notes" placeholder="Notes…" rows="2"></textarea>
              <div class="evidence-photo-row">
                <button type="button" class="secondary small offline-photo-btn">📷 Photo</button>
                <input type="file" class="offline-photo-input" accept="image/*" capture="environment" hidden>
                <span class="offline-photo-status hint"></span>
              </div>
              <button type="button" class="secondary small offline-evidence-save" data-sid="${t.id}">Save evidence</button>
            </div>
          </details>
        </div>`;
      }
      const badge = statusBadge(t.type, t.subStatus, t.score, t.points_possible, t.done);
      const feedbackBadge = t.parentComment ? `<span class="feedback-badge">💬 feedback</span>` : '';
      return `<button class="today-row" data-item-id="${t.itemId}" data-item-type="${t.type}">
        <span class="row-check">${t.done ? '✅' : TYPE_ICON[t.type]}</span>
        <span class="row-title">${esc(t.itemTitle)}${feedbackBadge}<small>${esc(t.courseName)}</small></span>
        <span class="row-badge">${badge}</span>
      </button>`;
    })
    .join('');

  // Offline status buttons
  document.querySelectorAll('.offline-status-btn').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await api(`/api/schedule/${btn.dataset.sid}/done`, { method: 'POST', body: { status: btn.dataset.status } });
      openKid(currentStudent.id, 'today');
    })
  );

  // Offline evidence photo picker
  document.querySelectorAll('.today-row-offline').forEach((row) => {
    const photoBtn = row.querySelector('.offline-photo-btn');
    const photoInput = row.querySelector('.offline-photo-input');
    const photoStatus = row.querySelector('.offline-photo-status');
    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      try {
        photoInput._dataUrl = await compressPhoto(file);
        photoStatus.textContent = '✅ Ready';
      } catch { photoStatus.textContent = '❌ Error'; }
    });
  });

  // Offline evidence save
  document.querySelectorAll('.offline-evidence-save').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const row = btn.closest('.today-row-offline');
      const notes = row.querySelector('.offline-notes').value || null;
      const photoInput = row.querySelector('.offline-photo-input');
      const photo = photoInput._dataUrl || null;
      await api(`/api/schedule/${btn.dataset.sid}/done`, { method: 'POST', body: { evidenceNotes: notes, evidencePhoto: photo } });
      btn.textContent = '✅ Saved';
      setTimeout(() => openKid(currentStudent.id, 'today'), 600);
    })
  );

  document.querySelectorAll('.today-row:not(.offline)').forEach((row) =>
    row.addEventListener('click', () => {
      backTarget = () => openKid(currentStudent.id, 'today');
      openItem(Number(row.dataset.itemId), row.dataset.itemType);
    })
  );
}

function statusBadge(type, status, score, pointsPossible, done) {
  if (status === 'graded') return `🌟 ${score}/${pointsPossible}`;
  if (status === 'done') return type === 'assignment' ? '⏳ grading' : '✅ done';
  if (done) return '✅ done';
  return '';
}

function renderCourseCards(courses) {
  $('#courses-empty').hidden = courses.length > 0;
  $('#course-cards').innerHTML = courses
    .map((c) => {
      const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
      return `<button class="course-card" style="border-left-color:${esc(c.color)}" data-course-id="${c.id}">
        <strong>${esc(c.name)}</strong>
        <span class="course-subject">${esc(c.subject || '')}</span>
        <div class="progress-track small"><div class="progress-fill" style="width:${pct}%;background:${esc(c.color)}"></div></div>
        <span class="course-pct">${c.done} / ${c.total} complete</span>
      </button>`;
    })
    .join('');
  document.querySelectorAll('.course-card').forEach((card) =>
    card.addEventListener('click', () => openCourse(Number(card.dataset.courseId)))
  );
}

let currentSpellingListId = null;
let currentSpellingListName = '';

function renderSpellingTab(state, tests = []) {
  let html;
  if (state.assignment) {
    const { mastered, total } = state.listProgress;
    html = `<strong>This week: ${esc(state.assignment.name)}</strong>
      <div class="mastery-dots">${'🌟'.repeat(mastered)}${'⚪'.repeat(Math.max(0, total - mastered))}</div>
      <div>${mastered} of ${total} words mastered</div>`;
    currentSpellingListId = state.assignment.id;
    currentSpellingListName = state.assignment.name;
  } else {
    html = `No list assigned yet — ask a parent to pick one!`;
    currentSpellingListId = null;
  }
  if (state.dueReviews > 0) {
    html += `<div>🔁 ${state.dueReviews} old ${state.dueReviews === 1 ? 'word' : 'words'} due for review</div>`;
  }
  $('#kid-week').innerHTML = html;
  $('#btn-test').disabled = !state.assignment;
  $('#btn-print-list').disabled = !state.assignment;

  const histEl = $('#kid-test-history');
  if (!tests.length) {
    histEl.innerHTML = '';
  } else {
    const rows = tests.map((t) => {
      const pct = Math.round((t.score / t.total) * 100);
      return `<div class="test-history-row">
        <span class="thr-date">${new Date(t.at + 'Z').toLocaleDateString()}</span>
        <span class="thr-list">${esc(t.list)}</span>
        <span class="thr-score ${pct >= 80 ? 'score-good' : 'score-bad'}">${t.score}/${t.total} (${pct}%)</span>
      </div>`;
    }).join('');
    histEl.innerHTML = `<h3 class="thr-heading">Recent Tests</h3>${rows}`;
  }
}

$('#btn-print-list').addEventListener('click', async () => {
  if (!currentSpellingListId) return;
  const list = await api(`/api/lists/${currentSpellingListId}`);
  printSpellingWorksheet(list.name, list.words);
});

function printSpellingWorksheet(name, words) {
  const practiceRows = words.map((w, i) => {
    const sentence = w.sentence
      ? `<div class="sentence">${esc(w.sentence)}</div>`
      : '';
    return `<tr>
      <td class="word-cell"><span class="num">${i + 1}.</span> <strong>${esc(w.word)}</strong>${sentence}</td>
      <td class="write-cell"><div class="write-slot"></div></td>
      <td class="write-cell"><div class="write-slot"></div></td>
    </tr>`;
  }).join('');

  const dictRows = words.map((w, i) =>
    `<div class="dict-row"><span class="num">${i + 1}.</span><div class="write-slot"></div></div>`
  ).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Spelling: ${esc(name)}</title>
<style>
* { box-sizing: border-box; }
body { font-family: Georgia, serif; max-width: 700px; margin: 2rem auto; color: #222; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
h1 { font-size: 1.35rem; margin: 0 0 .75rem; }
.name-date { display: flex; gap: 3rem; margin-bottom: 1.5rem; }
.nd-field { display: flex; align-items: flex-end; gap: .4rem; flex: 1; }
.nd-field label { font-size: .85rem; white-space: nowrap; color: #444; }
.nd-line { flex: 1; border-bottom: 1.5px solid #444; height: 1.4rem; }
.directions { font-size: .88rem; color: #555; margin-bottom: .75rem; }
.picker { display: flex; gap: .6rem; align-items: center; padding: .55rem .75rem; background: #f0f0f0; border-radius: 6px; margin-bottom: 1.25rem; }
.picker button { padding: .28rem .85rem; border: 1.5px solid #bbb; border-radius: 4px; background: #fff; cursor: pointer; font-size: .88rem; }
.picker button.active { background: #222; color: #fff; border-color: #222; }
.picker .print-btn { margin-left: auto; background: #4f86f7; color: #fff; border-color: #4f86f7; font-weight: 600; }
@media print { .picker { display: none; } }
table { width: 100%; border-collapse: collapse; }
th { font-size: .8rem; font-weight: 600; color: #666; text-align: left; padding: .25rem .5rem .4rem; border-bottom: 2px solid #222; }
td { vertical-align: top; padding: .4rem .5rem; border-bottom: 1px solid #ebebeb; }
.word-cell { width: 28%; padding-top: .55rem; }
.num { color: #999; font-size: .82rem; font-style: normal; }
.sentence { color: #888; font-size: .8em; font-style: italic; margin-top: .15rem; }
.write-cell { width: 36%; }
.write-slot { height: 44px; border-bottom: 1.5px solid #888; background: linear-gradient(transparent calc(50% - 0.5px), #d4d4d4 calc(50% - 0.5px), #d4d4d4 calc(50% + 0.5px), transparent calc(50% + 0.5px)); }
.dict-section { margin-top: .25rem; }
.dict-row { display: flex; align-items: flex-end; gap: .6rem; margin-bottom: .55rem; }
.dict-row .num { min-width: 1.6rem; text-align: right; margin-bottom: 5px; white-space: nowrap; }
.dict-row .write-slot { flex: 1; }
.dict-section { display: none; }
body.dictation .practice-section { display: none; }
body.dictation .dict-section { display: block; }
</style>
</head><body>
<div class="picker">
  <button class="active" id="btn-p" onclick="setMode('practice')">✏️ Practice</button>
  <button id="btn-d" onclick="setMode('dictation')">📝 Dictation / Test</button>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>
</div>
<h1>Spelling: ${esc(name)}</h1>
<div class="name-date">
  <div class="nd-field"><label>Name</label><div class="nd-line"></div></div>
  <div class="nd-field"><label>Date</label><div class="nd-line"></div></div>
</div>
<div class="practice-section">
  <p class="directions">Write each word twice — once to practice, once from memory.</p>
  <table>
    <tr><th style="width:28%">Word</th><th style="width:36%">Practice</th><th style="width:36%">From memory</th></tr>
    ${practiceRows}
  </table>
</div>
<div class="dict-section">
  <p class="directions">Write each spelling word as it is called out.</p>
  ${dictRows}
</div>
<script>
function setMode(m) {
  document.body.classList.toggle('dictation', m === 'dictation');
  document.getElementById('btn-p').classList.toggle('active', m === 'practice');
  document.getElementById('btn-d').classList.toggle('active', m === 'dictation');
}
<\/script>
</body></html>`);
  win.document.close();
}

function printMatchingWorksheet(title, wordBank, questions) {
  const bankHtml = wordBank
    .map((w, i) => `<span class="bank-item"><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(w)}</span>`)
    .join('');
  const clueRows = questions
    .map((q, i) => `<tr>
      <td class="blank-cell">___</td>
      <td class="num-cell">${i + 1}.</td>
      <td class="clue-cell">${esc(q.prompt)}</td>
    </tr>`)
    .join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Matching: ${esc(title)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 700px; margin: 2rem auto; color: #222; }
      h1 { font-size: 1.4rem; border-bottom: 2px solid #222; padding-bottom: .4rem; margin-bottom: 1rem; }
      .word-bank { border: 1.5px solid #555; border-radius: 8px; padding: .6rem 1rem; margin-bottom: 1.25rem; }
      .word-bank strong { display: block; font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; color: #555; margin-bottom: .4rem; }
      .bank-item { display: inline-block; margin: .15rem .6rem .15rem 0; font-size: .95rem; }
      table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
      tr { border-bottom: 1px solid #ddd; }
      td { padding: .55rem .4rem; vertical-align: top; }
      .blank-cell { width: 2rem; font-size: 1.1rem; font-weight: 700; text-align: center; padding-top: .6rem; }
      .num-cell { width: 1.5rem; color: #555; padding-top: .6rem; }
      .clue-cell { font-size: .97rem; line-height: 1.4; }
      p.directions { color: #555; font-size: .9em; margin-bottom: .75rem; }
    </style></head><body>
    <h1>🔤 Matching: ${esc(title)}</h1>
    <div class="word-bank"><strong>Word Bank</strong>${bankHtml}</div>
    <p class="directions">Directions: Write the letter of the matching word from the word bank on the blank next to each clue.</p>
    <table>${clueRows}</table>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ---------- course detail ----------

function activeUnitIndex(units) {
  const today = new Date().toISOString().slice(0, 10);
  const dated = units.map((u, i) => {
    const dates = u.items.map((it) => it.due_date).filter(Boolean).sort();
    return { i, earliest: dates[0] || null, latest: dates[dates.length - 1] || null };
  }).filter((x) => x.earliest);

  if (dated.length) {
    const spanning = dated.find((x) => x.earliest <= today && x.latest >= today);
    if (spanning) return spanning.i;
    const past = dated.filter((x) => x.latest < today).sort((a, b) => b.latest.localeCompare(a.latest));
    if (past.length) return past[0].i;
    const future = dated.filter((x) => x.earliest > today).sort((a, b) => a.earliest.localeCompare(b.earliest));
    if (future.length) return future[0].i;
  }
  const fallback = units.findIndex((u) => u.items.some((it) => it.status === 'not_started' && !it.locked));
  return fallback >= 0 ? fallback : 0;
}

async function openCourse(courseId) {
  const course = await api(`/api/courses/${courseId}/detail?studentId=${currentStudent.id}`);
  currentCourseItems = course.units.flatMap((u) => u.items.map((it) => ({ id: it.id, type: it.type, title: it.title })));
  $('#course-title').textContent = course.name;
  const activeIdx = activeUnitIndex(course.units);
  $('#course-units').innerHTML = course.units
    .map((u, uIdx) => {
      const total = u.items.length;
      const done = u.items.filter((it) => it.status !== 'not_started').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const isOpen = uIdx === activeIdx;

      const itemsHtml = u.items
        .map((it) => {
          if (it.locked) {
            return `<div class="today-row locked">
              <span class="row-check">🔒</span>
              <span class="row-title">${esc(it.title)}<small>${TYPE_LABEL[it.type]}</small></span>
              <span class="row-badge hint">Complete previous item first</span>
            </div>`;
          }
          const badge = statusBadge(it.type, it.status, it.score, it.points_possible, it.status !== 'not_started');
          const due = it.due_date ? `<small class="due-date">Due ${it.due_date}</small>` : '';
          return `<button class="today-row" data-item-id="${it.id}" data-item-type="${it.type}">
            <span class="row-check">${it.status === 'not_started' ? TYPE_ICON[it.type] : '✅'}</span>
            <span class="row-title">${esc(it.title)}${due}<small>${TYPE_LABEL[it.type]}</small></span>
            <span class="row-badge">${badge}</span>
          </button>`;
        })
        .join('');

      return `<div class="unit-block${isOpen ? ' open' : ''}">
        <button class="unit-toggle" type="button" aria-expanded="${isOpen}">
          <div class="unit-toggle-left">
            <span class="unit-num-badge">Unit ${uIdx + 1}</span>
            <span class="unit-title-text">${esc(u.name)}</span>
          </div>
          <div class="unit-toggle-right">
            <span class="unit-done-count">${done}/${total}</span>
            <div class="progress-track small unit-mini-progress">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="unit-chevron" aria-hidden="true">▾</span>
          </div>
        </button>
        <div class="unit-items-list">${itemsHtml}</div>
      </div>`;
    })
    .join('');

  document.querySelectorAll('#course-units .unit-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.unit-block');
      const nowOpen = block.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(nowOpen));
    });
  });

  document.querySelectorAll('#course-units .today-row:not(.locked)').forEach((row) =>
    row.addEventListener('click', () => {
      backTarget = () => openCourse(courseId);
      openItem(Number(row.dataset.itemId), row.dataset.itemType);
    })
  );
  backTarget = () => openKid(currentStudent.id, 'courses');
  show('course');
}

// ---------- item dispatch ----------

async function openItem(itemId, type) {
  if (type === 'lesson') return openLesson(itemId);
  if (type === 'assignment') return openAssignment(itemId);
  if (type === 'quiz') return openQuiz(itemId, false);
  if (type === 'matching') return openMatching(itemId, false);
  if (type === 'crossword') return openCrossword(itemId);
  if (type === 'worksheet') return openWorksheet(itemId);
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  if (type === 'spelling_practice') return startPractice({ listId: item.list.id, itemId });
  if (type === 'spelling_test') return startTest({ listId: item.list.id, itemId, allowRetakes: item.allow_retakes });
  if (type === 'flashcards') return startFlashcards({ deckId: item.deck.id, deckName: item.deck.name, itemId });
}

// ---------- lesson ----------

async function openLesson(itemId) {
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  $('#lesson-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#lesson-title').textContent = item.title;
  $('#lesson-body').innerHTML = item.body;
  show('lesson');

  const btn = $('#lesson-done-btn');
  const nextActions = $('#lesson-next-actions');
  nextActions.hidden = true;
  btn.textContent = item.submission ? '✅ Read' : 'Done reading ✓';
  btn.onclick = async () => {
    await api(`/api/items/${itemId}/complete`, { method: 'POST', body: { studentId: currentStudent.id, date: todayStr() } });
    showMiniCelebration('📖 Lesson complete!');
    await showDoneStamp();
    btn.disabled = true;
    showNextActions('lesson-next-actions', itemId);
  };
}

// ---------- assignment ----------

async function openAssignment(itemId) {
  evidencePhotoBase64 = null;
  $('#assignment-photo-status').textContent = '';
  $('#assignment-photo-input').value = '';
  $('#assignment-evidence-notes').value = '';
  $('#assignment-student-note').value = '';
  $('#assignment-next-actions').hidden = true;

  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  $('#assignment-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#assignment-title').textContent = item.title;
  $('#assignment-points').textContent = item.points ? `Worth ${item.points} points` : '';
  $('#assignment-body').innerHTML = item.body || '';

  const btn = $('#assignment-done-btn');
  const status = $('#assignment-status');
  const commentEl = $('#assignment-comment');
  const evidenceSection = $('#assignment-evidence-section');
  const needsEvidence = item.evidence_mode === 'required' || item.evidence_mode === 'optional';

  // Show parent comment if graded
  if (item.submission?.parent_comment) {
    commentEl.hidden = false;
    commentEl.innerHTML = `<strong>💬 Feedback from your parent:</strong><br>${esc(item.submission.parent_comment)}`;
  } else {
    commentEl.hidden = true;
  }

  if (item.submission && item.submission.status === 'graded') {
    status.hidden = false;
    status.className = 'status-banner good';
    status.textContent = `🌟 Graded: ${item.submission.score} / ${item.submission.points_possible}`;
    evidenceSection.hidden = !needsEvidence || !item.allow_retakes;
    if (item.allow_retakes) {
      btn.hidden = false;
      btn.textContent = '🔁 Retake';
      btn.onclick = async () => {
        const body = { studentId: currentStudent.id, date: todayStr() };
        if (needsEvidence) { body.evidenceNotes = $('#assignment-evidence-notes').value || null; body.evidencePhoto = evidencePhotoBase64; body.studentNote = $('#assignment-student-note').value || null; }
        await api(`/api/items/${itemId}/complete`, { method: 'POST', body });
        openAssignment(itemId);
      };
    } else {
      btn.hidden = true;
    }
  } else if (item.submission && item.submission.status === 'done') {
    btn.hidden = true;
    evidenceSection.hidden = true;
    status.hidden = false;
    status.className = 'status-banner';
    status.textContent = `⏳ Turned in — waiting for a parent to grade it.`;
  } else {
    btn.hidden = false;
    btn.textContent = item.evidence_mode === 'required' ? 'Submit with evidence ✓' : 'Mark as done ✓';
    status.hidden = true;
    evidenceSection.hidden = !needsEvidence;
    btn.onclick = async () => {
      if (item.evidence_mode === 'required' && !$('#assignment-evidence-notes').value && !evidencePhotoBase64) {
        status.hidden = false; status.className = 'status-banner bad'; status.textContent = 'Evidence required — add notes or a photo first.';
        return;
      }
      const body = { studentId: currentStudent.id, date: todayStr() };
      if (needsEvidence) { body.evidenceNotes = $('#assignment-evidence-notes').value || null; body.evidencePhoto = evidencePhotoBase64; body.studentNote = $('#assignment-student-note').value || null; }
      await api(`/api/items/${itemId}/complete`, { method: 'POST', body });
      showMiniCelebration('📝 Turned in!');
      await showDoneStamp();
      btn.hidden = true;
      status.hidden = false;
      status.className = 'status-banner';
      status.textContent = '⏳ Turned in — waiting for a parent to grade it.';
      showNextActions('assignment-next-actions', itemId);
    };
  }
  show('assignment');
}

// ---------- worksheet ----------

const wsNormalize = (s) => String(s).trim().toLowerCase();

async function openWorksheet(itemId) {
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  if (!item.worksheetData) return;

  const wd = item.worksheetData;
  const sub = item.submission;
  const graded = sub && sub.status === 'graded';
  const submitted = sub && (sub.status === 'done' || sub.status === 'graded');

  backTarget = () => openKid(currentStudent.id);

  $('#ws-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#ws-title').textContent = item.title;

  const headerEl = $('#ws-header');
  if (wd.hasHeader) {
    headerEl.hidden = false;
    $('#ws-date').value = new Date().toLocaleDateString();
    $('#ws-name').value = '';
  } else {
    headerEl.hidden = true;
  }

  // Build question form
  const form = $('#ws-form');
  form.innerHTML = '';

  wd.sections.forEach((section, si) => {
    if (section.title) {
      const h = document.createElement('h3');
      h.className = 'ws-section-title';
      h.textContent = section.title;
      form.appendChild(h);
    }
    (section.questions || []).forEach((q, qi) => {
      const div = document.createElement('div');
      div.className = 'ws-question';

      if (q.type === 'fitb') {
        const parts = q.template.split('___');
        const numBlanks = q.blankCount || (parts.length - 1);
        const p = document.createElement('p');
        p.className = 'ws-fitb';
        if (q.num !== undefined) {
          const numSpan = document.createElement('span');
          numSpan.className = 'ws-qnum';
          numSpan.textContent = `${q.num}. `;
          p.appendChild(numSpan);
        }
        parts.forEach((part, pi) => {
          if (part) p.appendChild(document.createTextNode(part));
          if (pi < numBlanks) {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'ws-blank-input';
            inp.name = `${si}:${qi}:${pi}`;
            inp.autocomplete = 'off';
            inp.setAttribute('autocapitalize', 'off');
            inp.setAttribute('autocorrect', 'off');
            inp.spellcheck = false;
            if (submitted) inp.disabled = true;
            if (graded && q.givenBlanks) {
              inp.value = q.givenBlanks[pi] ?? '';
              const correct = wsNormalize(q.givenBlanks[pi] ?? '') === wsNormalize((q.blanks || [])[pi] ?? '');
              inp.classList.add(correct ? 'ws-correct' : 'ws-wrong');
            }
            p.appendChild(inp);
            if (graded && q.blanks && q.blanks[pi]) {
              const ans = document.createElement('span');
              ans.className = 'ws-correct-answer';
              ans.textContent = ` (${q.blanks[pi]})`;
              p.appendChild(ans);
            }
          }
        });
        div.appendChild(p);

      } else if (q.type === 'tf') {
        const p = document.createElement('p');
        p.className = 'ws-tf';
        const key = `${si}:${qi}`;
        ['T', 'F'].forEach(val => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ws-tf-btn';
          btn.dataset.val = val;
          btn.dataset.key = key;
          btn.textContent = val;
          if (submitted) btn.disabled = true;
          if (q.given === val) {
            btn.classList.add('selected');
            if (graded) btn.classList.add(q.given === q.correct ? 'ws-correct' : 'ws-wrong');
          }
          p.appendChild(btn);
        });
        const stmt = document.createElement('span');
        stmt.className = 'ws-tf-stmt';
        stmt.textContent = q.text;
        p.appendChild(stmt);
        div.appendChild(p);

      } else if (q.type === 'short') {
        const label = document.createElement('label');
        label.className = 'ws-short';
        if (q.num !== undefined) {
          const numSpan = document.createElement('span');
          numSpan.className = 'ws-qnum';
          numSpan.textContent = `${q.num}. `;
          label.appendChild(numSpan);
        }
        label.appendChild(document.createTextNode(q.text));
        const ta = document.createElement('textarea');
        ta.name = `${si}:${qi}`;
        ta.className = 'ws-short-answer';
        ta.rows = 3;
        ta.placeholder = 'Write your answer here…';
        if (submitted) ta.disabled = true;
        if (q.given) ta.value = q.given;
        label.appendChild(ta);
        div.appendChild(label);
      }

      form.appendChild(div);
    });
  });

  // T/F toggle (only active when not submitted)
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('.ws-tf-btn');
    if (!btn || btn.disabled) return;
    const key = btn.dataset.key;
    form.querySelectorAll(`.ws-tf-btn[data-key="${key}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Actions
  const actions = $('#ws-actions');
  const result = $('#ws-result');
  const submitBtn = $('#ws-submit-btn');
  const printBtn = $('#ws-print-btn');
  const paperBtn = $('#ws-paper-btn');

  actions.hidden = false;
  result.hidden = true;
  paperBtn.hidden = submitted; // hide once any submission exists

  if (submitted && !graded) {
    result.hidden = false;
    result.className = 'status-banner';
    result.textContent = '⏳ Turned in — waiting for a parent to grade it.';
    submitBtn.hidden = true;
    if (pendingMiniCelebration) { pendingMiniCelebration = false; showMiniCelebration('📋 Turned in!'); }
  } else if (graded) {
    result.hidden = false;
    result.className = 'status-banner good';
    const hasShort = wd.sections.some(s => (s.questions || []).some(q => q.type === 'short'));
    result.textContent = hasShort
      ? `🌟 Score: ${sub.score} / ${sub.points_possible} (short answers parent-graded)`
      : `🌟 Score: ${sub.score} / ${sub.points_possible}`;
    if (pendingMiniCelebration) {
      pendingMiniCelebration = false;
      const wsPct = sub.points_possible ? Math.round((sub.score / sub.points_possible) * 100) : 100;
      showMiniCelebration(wsPct >= 70 ? `🌟 ${wsPct}% — Great!` : randomCheer());
    }
    if (item.allow_retakes) {
      submitBtn.hidden = false;
      submitBtn.textContent = '🔁 Retake';
    } else {
      submitBtn.hidden = true;
    }
  } else {
    submitBtn.hidden = false;
    submitBtn.textContent = 'Submit ✓';
  }

  submitBtn.onclick = async () => {
    const answers = {};
    form.querySelectorAll('.ws-blank-input').forEach(inp => { answers[inp.name] = inp.value.trim(); });
    form.querySelectorAll('.ws-tf-btn.selected').forEach(btn => { answers[btn.dataset.key] = btn.dataset.val; });
    form.querySelectorAll('.ws-short-answer').forEach(ta => { answers[ta.name] = ta.value.trim(); });
    try {
      await api(`/api/items/${itemId}/worksheet-submit`, {
        method: 'POST',
        body: { studentId: currentStudent.id, answers, date: todayStr() },
      });
      pendingMiniCelebration = true;
      openWorksheet(itemId);
    } catch (err) {
      result.hidden = false;
      result.className = 'status-banner bad';
      result.textContent = err.message;
    }
  };

  printBtn.onclick = () => printWorksheetBlank(item);

  paperBtn.onclick = async () => {
    try {
      await api(`/api/items/${itemId}/complete`, {
        method: 'POST',
        body: { studentId: currentStudent.id, date: todayStr() },
      });
      openWorksheet(itemId);
    } catch (err) {
      result.hidden = false;
      result.className = 'status-banner bad';
      result.textContent = err.message;
    }
  };

  show('worksheet');
}

function printWorksheetBlank(item) {
  const wd = item.worksheetData;
  if (!wd) return;

  const escHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${escHtml(item.title)}</title>
<style>
  body{font-family:Georgia,serif;max-width:7in;margin:.75in auto;font-size:12pt;line-height:1.5}
  h1{text-align:center;font-size:16pt;margin-bottom:.4in}
  .ws-hdr{display:flex;justify-content:space-between;margin-bottom:.5in;font-size:11pt}
  .ws-hdr-line{border-bottom:1px solid #000;display:inline-block;width:2.8in}
  h3{margin:.35in 0 .1in;font-size:12pt;border-bottom:1px solid #000;padding-bottom:2pt}
  .q{margin:.18in 0}
  p{margin:.1in 0}
  .blank{display:inline-block;border-bottom:1px solid #000;width:1.4in;margin:0 3pt;vertical-align:baseline}
  .tf-circle{display:inline-block;border:1px solid #000;border-radius:50%;width:1.1em;height:1.1em;
    text-align:center;line-height:1.1em;margin-right:.4em;font-size:11pt}
  .sa-line{border-bottom:1px solid #bbb;height:1.5em;margin:.08in 0}
  @media print{body{margin:0}}
</style></head><body>`;

  html += `<h1>${escHtml(item.title)}</h1>`;

  if (wd.hasHeader) {
    html += `<div class="ws-hdr">
      <div>Name:&nbsp;<span class="ws-hdr-line">&nbsp;</span></div>
      <div>Date:&nbsp;<span class="ws-hdr-line" style="width:1.8in">&nbsp;</span></div>
    </div>`;
  }

  wd.sections.forEach(section => {
    if (section.title) html += `<h3>${escHtml(section.title)}</h3>`;
    (section.questions || []).forEach(q => {
      html += `<div class="q">`;
      if (q.type === 'fitb') {
        const parts = q.template.split('___');
        let line = q.num !== undefined ? `${q.num}.&nbsp;` : '';
        parts.forEach((part, pi) => {
          line += escHtml(part);
          if (pi < parts.length - 1) line += `<span class="blank">&nbsp;</span>`;
        });
        html += `<p>${line}</p>`;
      } else if (q.type === 'tf') {
        html += `<p><span class="tf-circle">T</span><span class="tf-circle">F</span>&nbsp;&nbsp;${escHtml(q.text)}</p>`;
      } else if (q.type === 'short') {
        html += `<p>${q.num !== undefined ? `${q.num}.&nbsp;` : ''}${escHtml(q.text)}</p>`;
        html += `<div class="sa-line"></div><div class="sa-line"></div><div class="sa-line"></div>`;
      }
      html += `</div>`;
    });
  });

  html += `</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

// ---------- quiz ----------

async function openQuiz(itemId, forceRetake = false) {
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  $('#quiz-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#quiz-title').textContent = item.title;
  const instrEl = $('#quiz-instructions');
  if (item.body) { instrEl.textContent = item.body; instrEl.hidden = false; }
  else instrEl.hidden = true;
  const graded = !forceRetake && item.submission && item.submission.status === 'graded';
  const result = $('#quiz-result');

  if (graded) {
    result.hidden = false;
    result.className = 'status-banner good';
    const pct = item.submission.points_possible ? Math.round((item.submission.score / item.submission.points_possible) * 100) : 0;
    result.innerHTML = `🌟 Score: ${item.submission.score} / ${item.submission.points_possible} (${pct}%)`;

    if (pendingMiniCelebration) {
      pendingMiniCelebration = false;
      showMiniCelebration(pct >= 70 ? `🌟 ${pct}% — Nice!` : randomCheer());
    }

    // Attempt history
    const { history } = await api(`/api/items/${itemId}/history?studentId=${currentStudent.id}`);
    let historyHtml = '';
    if (history.length > 1) {
      const histRows = history.map((h) => {
        const hp = h.points_possible ? Math.round((h.score / h.points_possible) * 100) : 0;
        return `<tr><td>${new Date(h.completed_at + 'Z').toLocaleString()}</td><td>${h.score}/${h.points_possible} (${hp}%)</td></tr>`;
      }).join('');
      historyHtml = `<details class="attempt-history"><summary>All attempts (${history.length})</summary><table>${histRows}</table></details>`;
    }

    let retakeBtn = '';
    if (item.allow_retakes) retakeBtn = `<button id="quiz-retake-btn" class="check-btn secondary">🔁 Retake Quiz</button>`;

    $('#quiz-form').innerHTML = historyHtml + retakeBtn + item.questions
      .map((q) => {
        const correct = normalizeAnswer(q.given) === normalizeAnswer(q.correct_answer);
        return `<div class="quiz-question review">
          <p class="q-prompt">${correct ? '✅' : '❌'} ${esc(q.prompt)}</p>
          <p class="q-your-answer">Your answer: ${esc(q.given || '(blank)')}</p>
          ${correct ? '' : `<p class="q-correct-answer">Correct answer: ${esc(q.correct_answer)}</p>`}
        </div>`;
      })
      .join('');

    if (item.allow_retakes) {
      $('#quiz-retake-btn').addEventListener('click', () => openQuiz(itemId, true));
    }
  } else {
    result.hidden = true;
    $('#quiz-form').innerHTML =
      item.questions
        .map((q, i) => {
          if (q.type === 'mc') {
            return `<div class="quiz-question">
              <p class="q-prompt">${i + 1}. ${esc(q.prompt)}</p>
              ${q.choices
                .map(
                  (c) => `<label class="quiz-choice"><input type="radio" name="q${q.id}" value="${esc(c)}"> ${esc(c)}</label>`
                )
                .join('')}
            </div>`;
          }
          if (q.type === 'tf') {
            return `<div class="quiz-question">
              <p class="q-prompt">${i + 1}. ${esc(q.prompt)}</p>
              <label class="quiz-choice"><input type="radio" name="q${q.id}" value="true"> True</label>
              <label class="quiz-choice"><input type="radio" name="q${q.id}" value="false"> False</label>
            </div>`;
          }
          return `<div class="quiz-question">
            <p class="q-prompt">${i + 1}. ${esc(q.prompt)}</p>
            <input type="text" class="quiz-short-input" name="q${q.id}" autocomplete="off">
          </div>`;
        })
        .join('') + `<button type="submit" class="check-btn">Submit Quiz</button>`;

    $('#quiz-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = $('#quiz-form button[type=submit]');
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      const answers = {};
      for (const q of item.questions) {
        const field = $('#quiz-form').elements[`q${q.id}`];
        answers[q.id] = field ? (field.value !== undefined ? field.value : '') : '';
      }
      await api(`/api/items/${itemId}/quiz-submit`, {
        method: 'POST',
        body: { studentId: currentStudent.id, answers, date: todayStr() },
      });
      pendingMiniCelebration = true;
      openQuiz(itemId, false);
    };
  }
  show('quiz');
}

const normalizeAnswer = (s) => String(s ?? '').trim().toLowerCase();

// ---------- matching ----------

async function openMatching(itemId, forceRetake = false) {
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  $('#quiz-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#quiz-title').textContent = item.title;
  const instrEl = $('#quiz-instructions');
  if (item.body) { instrEl.textContent = item.body; instrEl.hidden = false; }
  else instrEl.hidden = true;
  const graded = !forceRetake && item.submission && item.submission.status === 'graded';
  const result = $('#quiz-result');

  const wordBankHtml = (wb) => `
    <div class="match-word-bank">
      <strong>Word Bank</strong>
      <div class="match-bank-list">
        ${wb.map((w, i) => `<span class="match-bank-item"><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(w)}</span>`).join('')}
      </div>
    </div>`;

  if (graded) {
    result.hidden = false;
    result.className = 'status-banner good';
    const pct = item.submission.points_possible
      ? Math.round((item.submission.score / item.submission.points_possible) * 100) : 0;
    result.innerHTML = `🌟 Score: ${item.submission.score} / ${item.submission.points_possible} (${pct}%)`;

    if (pendingMiniCelebration) {
      pendingMiniCelebration = false;
      showMiniCelebration(pct >= 70 ? `🌟 ${pct}% — Nice!` : randomCheer());
    }

    let retakeBtn = '';
    if (item.allow_retakes) retakeBtn = `<button id="quiz-retake-btn" class="check-btn secondary">🔁 Retake</button>`;

    $('#quiz-form').innerHTML = wordBankHtml(item.wordBank) + retakeBtn +
      item.questions.map((q) => {
        const correct = q.given && q.given.toUpperCase() === q.correctLetter;
        return `<div class="quiz-question review match-review-row">
          <span class="match-blank-badge ${correct ? 'correct' : 'wrong'}">${esc(q.given || '?')}</span>
          <span class="match-clue">${correct ? '✅' : '❌'} ${esc(q.prompt)}</span>
          ${correct ? '' : `<span class="q-correct-answer">→ ${esc(q.correctLetter)} (${esc(q.correctWord)})</span>`}
        </div>`;
      }).join('');

    if (item.allow_retakes) {
      $('#quiz-retake-btn').addEventListener('click', () => openMatching(itemId, true));
    }
  } else {
    result.hidden = true;
    $('#quiz-form').innerHTML = wordBankHtml(item.wordBank) +
      `<p class="match-instructions">Write the letter from the word bank that matches each clue.
        <button type="button" class="print-match-btn secondary small" style="margin-left:.75rem">🖨 Print worksheet</button>
      </p>` +
      item.questions.map((q, i) =>
        `<div class="quiz-question match-row">
          <input type="text" class="match-input" name="q${q.id}" maxlength="2"
            placeholder="?" autocomplete="off" autocapitalize="characters">
          <span class="match-clue">${i + 1}. ${esc(q.prompt)}</span>
        </div>`
      ).join('') +
      `<button type="submit" class="check-btn" disabled>Submit ✓</button>`;

    const submitBtn = $('#quiz-form button[type=submit]');
    const inputs = Array.from($('#quiz-form').querySelectorAll('.match-input'));
    const checkAllFilled = () => {
      submitBtn.disabled = !inputs.every((inp) => inp.value.trim().length > 0);
    };
    inputs.forEach((inp) => inp.addEventListener('input', checkAllFilled));

    $('#quiz-form').querySelector('.print-match-btn').addEventListener('click', () =>
      printMatchingWorksheet(item.title, item.wordBank, item.questions)
    );

    $('#quiz-form').onsubmit = async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      const answers = {};
      for (const q of item.questions) {
        const field = $('#quiz-form').elements[`q${q.id}`];
        answers[q.id] = field ? field.value.trim().toUpperCase() : '';
      }
      await api(`/api/items/${itemId}/quiz-submit`, {
        method: 'POST',
        body: { studentId: currentStudent.id, answers, date: todayStr() },
      });
      pendingMiniCelebration = true;
      openMatching(itemId, false);
    };
  }
  show('quiz');
}

// ---------- crossword ----------

async function openCrossword(itemId) {
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  const cw = item.crosswordData;
  if (!cw) return;

  const view = $('#view-crossword');
  view.querySelector('.cw-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  view.querySelector('.cw-title').textContent = item.title;

  const graded = item.submission && item.submission.status === 'graded';
  const CELL = 34;

  // Clue number map: 'r,c' -> num
  const numMap = {};
  for (const w of [...(cw.across||[]), ...(cw.down||[])]) if (w.num) numMap[`${w.row},${w.col}`] = w.num;

  // Word membership map: 'r,c' -> {across: wordObj|null, down: wordObj|null}
  const wordMap = {};
  for (let r = 0; r < cw.rows; r++)
    for (let c = 0; c < cw.cols; c++)
      if (cw.grid[r][c] !== null) wordMap[`${r},${c}`] = { across: null, down: null };
  for (const w of (cw.across||[])) for (let i = 0; i < w.len; i++) wordMap[`${w.row},${w.col+i}`].across = w;
  for (const w of (cw.down||[]))   for (let i = 0; i < w.len; i++) wordMap[`${w.row+i},${w.col}`].down = w;

  // Build grid DOM
  const gridEl = view.querySelector('.cw-grid');
  gridEl.style.gridTemplateColumns = `repeat(${cw.cols}, ${CELL}px)`;
  gridEl.style.gridTemplateRows    = `repeat(${cw.rows}, ${CELL}px)`;
  gridEl.innerHTML = '';

  const cells = {};
  for (let r = 0; r < cw.rows; r++) {
    for (let c = 0; c < cw.cols; c++) {
      const key = `${r},${c}`;
      const div = document.createElement('div');
      div.className = cw.grid[r][c] === null ? 'cw-cell black' : 'cw-cell';
      div.dataset.r = r; div.dataset.c = c;
      if (cw.grid[r][c] !== null) {
        if (numMap[key]) {
          const span = document.createElement('span');
          span.className = 'cw-num';
          span.textContent = numMap[key];
          div.appendChild(span);
        }
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'cw-input';
        inp.maxLength = 1; inp.readOnly = graded;
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocapitalize', 'characters');
        if (graded && cw.savedAnswers && cw.savedAnswers[key]) inp.value = cw.savedAnswers[key];
        div.appendChild(inp);
        cells[key] = { el: div, input: inp };
      }
      gridEl.appendChild(div);
    }
  }

  // Build clue lists
  const acrossListEl = $('#cw-across-list');
  const downListEl   = $('#cw-down-list');
  acrossListEl.innerHTML = '';
  downListEl.innerHTML   = '';
  for (const w of (cw.across||[])) {
    const li = document.createElement('li');
    li.dataset.num = w.num; li.dataset.dir = 'across';
    li.textContent = `${w.num}. ${w.clue}`;
    acrossListEl.appendChild(li);
  }
  for (const w of (cw.down||[])) {
    const li = document.createElement('li');
    li.dataset.num = w.num; li.dataset.dir = 'down';
    li.textContent = `${w.num}. ${w.clue}`;
    downListEl.appendChild(li);
  }

  const resultEl = $('#cw-result');

  if (graded) {
    // Color cells by word correctness
    const cellStatus = {};
    for (const key of Object.keys(cells)) cellStatus[key] = 'correct';
    for (const [words, dir] of [[(cw.across||[]), 'across'], [(cw.down||[]), 'down']]) {
      for (const w of words) {
        let ok = !!(w.answer);
        for (let i = 0; i < w.len; i++) {
          const r = w.row + (dir === 'down' ? i : 0);
          const c = w.col + (dir === 'across' ? i : 0);
          const given = (cw.savedAnswers || {})[`${r},${c}`] || '';
          if (!given || given !== (w.answer||'')[i]) ok = false;
        }
        if (!ok) for (let i = 0; i < w.len; i++) {
          const r = w.row + (dir === 'down' ? i : 0);
          const c = w.col + (dir === 'across' ? i : 0);
          cellStatus[`${r},${c}`] = 'wrong';
        }
      }
    }
    for (const [key, status] of Object.entries(cellStatus)) {
      if (cells[key]) cells[key].el.classList.add(status === 'correct' ? 'correct-word' : 'wrong-word');
    }
    const score = item.submission.score, total = item.submission.points_possible;
    const pct = total ? Math.round((score / total) * 100) : 0;
    resultEl.className = 'status-banner good';
    resultEl.textContent = `🌟 Score: ${score} / ${total} (${pct}%)`;
    resultEl.hidden = false;
    $('#cw-actions').hidden = true;
    $('#cw-hint').hidden = true;
    backTarget = () => openKid(currentStudent.id);
    show('crossword');
    return;
  }

  // Interactive (unanswered) mode
  resultEl.hidden = true;
  $('#cw-actions').hidden = false;
  $('#cw-hint').hidden = false;

  let selectedDir = 'across';

  function clearHighlights() {
    for (const { el } of Object.values(cells)) el.classList.remove('selected', 'word-hi');
    acrossListEl.querySelectorAll('li').forEach((li) => li.classList.remove('selected-clue', 'word-hi'));
    downListEl.querySelectorAll('li').forEach((li)   => li.classList.remove('selected-clue', 'word-hi'));
  }

  let selectedWord = null;
  function selectWord(word, dir) {
    clearHighlights();
    selectedWord = word;
    if (!word) return;
    for (let i = 0; i < word.len; i++) {
      const r = word.row + (dir === 'down' ? i : 0);
      const c = word.col + (dir === 'across' ? i : 0);
      if (cells[`${r},${c}`]) cells[`${r},${c}`].el.classList.add('word-hi');
    }
    const listEl = dir === 'across' ? acrossListEl : downListEl;
    const li = listEl.querySelector(`[data-num="${word.num}"]`);
    if (li) {
      li.classList.add('selected-clue');
      const liTop = li.offsetTop;
      const liBottom = liTop + li.offsetHeight;
      if (liBottom > listEl.scrollTop + listEl.clientHeight) {
        listEl.scrollTop = liBottom - listEl.clientHeight;
      } else if (liTop < listEl.scrollTop) {
        listEl.scrollTop = liTop;
      }
    }
  }

  function pickWord(key) {
    const wm = wordMap[key];
    if (!wm) return null;
    return wm[selectedDir] || wm.across || wm.down;
  }

  function selectCell(key) {
    const { el } = cells[key] || {};
    if (!el) return;
    clearHighlights();
    const word = pickWord(key);
    if (word) {
      const dir = wordMap[key][selectedDir] === word ? selectedDir : (wordMap[key].across === word ? 'across' : 'down');
      selectedDir = dir;
      selectWord(word, dir);
      el.classList.remove('word-hi');
    }
    el.classList.add('selected');
  }

  function selectAndFocus(r, c) {
    const key = `${r},${c}`;
    if (!cells[key]) return;
    selectCell(key);
    cells[key].input.focus();
  }

  // Wire up cells
  for (const [key, { el, input }] of Object.entries(cells)) {
    const [r, c] = key.split(',').map(Number);

    input.addEventListener('focus', () => selectCell(key));

    input.addEventListener('click', () => {
      if (el.classList.contains('selected')) {
        const wm = wordMap[key];
        if (wm && wm.across && wm.down) {
          selectedDir = selectedDir === 'across' ? 'down' : 'across';
          selectCell(key);
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (input.value) { input.value = ''; return; }
        if (selectedDir === 'across' && c > 0) selectAndFocus(r, c - 1);
        else if (selectedDir === 'down'  && r > 0) selectAndFocus(r - 1, c);
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); selectAndFocus(r, c + 1); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); selectAndFocus(r, c - 1); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); selectAndFocus(r + 1, c); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); selectAndFocus(r - 1, c); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const words = [...(cw.across||[]), ...(cw.down||[])];
        const cur = words.indexOf(selectedWord);
        const next = words[(cur + 1) % words.length];
        if (next) {
          selectedDir = (cw.across||[]).includes(next) ? 'across' : 'down';
          selectAndFocus(next.row, next.col);
        }
      }
    });

    input.addEventListener('input', () => {
      const v = input.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      input.value = v.slice(-1);
      if (!input.value) return;
      if (selectedDir === 'across') {
        const nk = `${r},${c + 1}`;
        if (cells[nk] && wordMap[key]?.across && wordMap[nk]?.across === wordMap[key]?.across)
          selectAndFocus(r, c + 1);
      } else {
        const nk = `${r + 1},${c}`;
        if (cells[nk] && wordMap[key]?.down && wordMap[nk]?.down === wordMap[key]?.down)
          selectAndFocus(r + 1, c);
      }
    });
  }

  // Clue list clicks
  for (const w of (cw.across||[])) {
    const li = acrossListEl.querySelector(`[data-num="${w.num}"]`);
    if (li) li.addEventListener('click', () => { selectedDir = 'across'; selectAndFocus(w.row, w.col); });
  }
  for (const w of (cw.down||[])) {
    const li = downListEl.querySelector(`[data-num="${w.num}"]`);
    if (li) li.addEventListener('click', () => { selectedDir = 'down'; selectAndFocus(w.row, w.col); });
  }

  // Submit
  $('#cw-check-btn').onclick = async () => {
    const answers = {};
    for (const [key, { input }] of Object.entries(cells)) {
      if (input.value) answers[key] = input.value.toUpperCase();
    }
    await api(`/api/items/${itemId}/crossword-submit`, {
      method: 'POST',
      body: { studentId: currentStudent.id, answers, date: todayStr() },
    });
    openCrossword(itemId);
  };

  $('#cw-print-btn').onclick = () => printCrosswordWorksheet(item.title, cw);

  backTarget = () => openKid(currentStudent.id);
  show('crossword');
}

function printCrosswordWorksheet(title, cw) {
  const CELL = 28;
  const numMap = {};
  for (const w of [...(cw.across||[]), ...(cw.down||[])]) if (w.num) numMap[`${w.row},${w.col}`] = w.num;
  let svg = `<svg width="${cw.cols * CELL}" height="${cw.rows * CELL}" style="display:block;margin-bottom:1.5rem">`;
  for (let r = 0; r < cw.rows; r++) {
    for (let c = 0; c < cw.cols; c++) {
      const x = c * CELL, y = r * CELL;
      if (cw.grid[r][c] === null) {
        svg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#222"/>`;
      } else {
        svg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#fff" stroke="#999" stroke-width="0.5"/>`;
        const key = `${r},${c}`;
        if (numMap[key]) svg += `<text x="${x+2}" y="${y+9}" font-size="6" font-family="sans-serif">${numMap[key]}</text>`;
      }
    }
  }
  svg += '</svg>';
  const acrossHtml = (cw.across||[]).map((w) => `<li><strong>${w.num}.</strong> ${esc(w.clue)}</li>`).join('');
  const downHtml   = (cw.down||[]).map((w)   => `<li><strong>${w.num}.</strong> ${esc(w.clue)}</li>`).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title>
<style>body{font-family:sans-serif;padding:1.5rem}h1{margin-bottom:1rem}.cols{display:flex;gap:2rem}ol{list-style:none;padding:0}li{margin:.2rem 0;font-size:.9rem}@media print{body{padding:.5rem}}</style>
</head><body>
<h1>${esc(title)}</h1>${svg}
<div class="cols">
  <div><h3>Across</h3><ol>${acrossHtml}</ol></div>
  <div><h3>Down</h3><ol>${downHtml}</ol></div>
</div>
<script>window.print();<\/script>
</body></html>`);
  win.document.close();
}

// ---------- flashcards ----------

const flash = { cards: [], i: 0, itemId: null, reviewed: 0 };

async function startFlashcards({ deckId, deckName, itemId }) {
  const { cards } = await api(`/api/flashcards/session/${currentStudent.id}?deckId=${deckId}`);
  Object.assign(flash, { cards, i: 0, itemId: itemId || null, reviewed: 0 });
  $('#flash-deck-name').textContent = deckName || '';
  $('#flash-card').hidden = false;
  $('#flash-done').hidden = true;
  show('flashcards');
  if (cards.length === 0) return finishFlashcards(true);
  presentFlashcard();
}

function presentFlashcard() {
  flashGrading = false;
  const c = flash.cards[flash.i];
  $('#flash-progress').textContent = `Card ${flash.i + 1} of ${flash.cards.length}`;
  $('#flash-bar').style.width = `${(flash.i / flash.cards.length) * 100}%`;
  $('#flash-front').textContent = c.front;
  $('#flash-front').hidden = false;
  $('#flash-back').hidden = true;
  $('#flash-back').textContent = c.back;
  $('#flash-reveal').hidden = false;
  $('#flash-grade-buttons').hidden = true;
}

$('#flash-reveal').addEventListener('click', () => {
  playFlip();
  const card = $('#flash-card');
  card.classList.remove('flip-in');
  card.classList.add('flip-out');
  setTimeout(() => {
    card.classList.remove('flip-out');
    $('#flash-back').hidden = false;
    $('#flash-reveal').hidden = true;
    $('#flash-grade-buttons').hidden = false;
    card.classList.add('flip-in');
    setTimeout(() => card.classList.remove('flip-in'), 200);
  }, 180);
});

let flashGrading = false;

async function gradeFlashcard(gotIt) {
  if (flashGrading) return; // guard against a rapid double-tap misgrading two cards
  flashGrading = true;
  if (gotIt) playDing(); else playBuzz();
  const c = flash.cards[flash.i];
  await api('/api/flashcards/grade', { method: 'POST', body: { studentId: currentStudent.id, cardId: c.id, gotIt } });
  flash.reviewed++;
  flash.i++;
  if (flash.i < flash.cards.length) return presentFlashcard();
  finishFlashcards(false);
}
$('#flash-again').addEventListener('click', () => gradeFlashcard(false));
$('#flash-got-it').addEventListener('click', () => gradeFlashcard(true));

async function finishFlashcards(nothingDue) {
  $('#flash-bar').style.width = '100%';
  $('#flash-progress').textContent = 'Done!';
  $('#flash-card').hidden = true;
  if (flash.itemId) {
    await api(`/api/items/${flash.itemId}/complete`, { method: 'POST', body: { studentId: currentStudent.id, date: todayStr() } });
  }
  $('#flash-done').innerHTML = nothingDue
    ? `<div>🎉 Nothing due on this deck right now!</div><button id="flash-home">Back</button>`
    : `<div>🎉 Reviewed ${flash.reviewed} card${flash.reviewed === 1 ? '' : 's'}!</div><button id="flash-home">Back</button>`;
  $('#flash-done').hidden = false;
  $('#flash-home').addEventListener('click', () => backTarget());
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- spelling: practice ----------

const practice = { words: [], i: 0, missed: [], missedWords: [], firstTryCorrect: 0, awaitingRetype: false, itemId: null, streak: 0 };

// Young learner mode: word stays visible while typing (set per-student by parent in admin)
let youngLearnerMode = false;

// Pending practice args stored while the word-list preview is showing
let pendingPractice = null;

async function startPractice({ listId, itemId } = {}) {
  const previewListId = listId || currentSpellingListId;
  if (previewListId) {
    pendingPractice = { listId, itemId };
    const list = await api(`/api/lists/${previewListId}`);
    $('#word-preview-title').textContent = list.name;
    $('#word-preview-list').innerHTML = list.words
      .map((w, i) => `<li><span class="word-num">${i + 1}.</span><span>${esc(w.word)}${w.sentence ? `<span class="word-sentence">${esc(w.sentence)}</span>` : ''}</span></li>`)
      .join('');
    show('word-preview');
    return;
  }
  await startPracticeNow({ listId, itemId });
}

$('#word-preview-start').addEventListener('click', () => {
  if (!pendingPractice) return;
  const args = pendingPractice;
  pendingPractice = null;
  startPracticeNow(args);
});

async function startPracticeNow({ listId, itemId } = {}) {
  const url = listId ? `/api/session/${currentStudent.id}?listId=${listId}` : `/api/session/${currentStudent.id}`;
  const { words } = await api(url);
  if (words.length === 0) {
    $('#practice-card').hidden = true;
    $('#practice-done').hidden = false;
    $('#practice-done').innerHTML = `<div>🎉 Nothing to practice right now — all caught up!</div><button id="practice-home">Back</button>`;
    $('#practice-home').addEventListener('click', () => backTarget());
    show('practice');
    return;
  }
  Object.assign(practice, { words, i: 0, missed: [], missedWords: [], firstTryCorrect: 0, awaitingRetype: false, itemId: itemId || null, streak: 0 });
  $('#practice-card').hidden = false;
  $('#practice-done').hidden = true;
  show('practice');
  presentPracticeWord();
}

function presentPracticeWord() {
  const w = practice.words[practice.i];
  practice.awaitingRetype = false;
  $('#practice-progress').textContent = `Word ${practice.i + 1} of ${practice.words.length}`;
  $('#practice-bar').style.width = `${(practice.i / practice.words.length) * 100}%`;
  $('#feedback').innerHTML = '';
  const input = $('#practice-input');
  input.value = '';

  if (youngLearnerMode) {
    showWordFirst(w);
  } else {
    $('#practice-prompt').textContent = 'Listen, then type the word:';
    input.disabled = false;
    input.focus();
    speakWord(w);
  }
}

function showWordFirst(w) {
  const input = $('#practice-input');
  $('#practice-prompt').textContent = 'Look at the word and type it:';
  $('#feedback').innerHTML = `<div class="study-word">${esc(w.word)}</div>`;
  input.value = '';
  input.disabled = false;
  input.focus();
  speakWord(w);
}

$('#btn-speak').addEventListener('click', () => speakWord(practice.words[practice.i]));

$('#practice-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#practice-input');
  const typed = input.value.trim();
  if (!typed || input.disabled) return;
  const w = practice.words[practice.i];

  const result = await api('/api/attempt', {
    method: 'POST',
    body: { studentId: currentStudent.id, wordId: w.id, typed, firstTry: !practice.awaitingRetype },
  });

  if (result.correct) {
    playDing();
    const card = $('#practice-card');
    card.classList.remove('flash-correct', 'flash-wrong');
    void card.offsetWidth;
    card.classList.add('flash-correct');
    if (!practice.awaitingRetype) {
      practice.firstTryCorrect++;
      practice.streak++;
      if ([3, 5, 7, 10].includes(practice.streak)) showMiniCelebration(`🔥 ${practice.streak} in a row!`);
    }
    const streakMsg = (!practice.awaitingRetype && practice.streak >= 2)
      ? ` <span class="streak-badge">🔥 ${practice.streak} in a row!</span>` : '';
    $('#feedback').innerHTML = `<div class="banner good">✅ ${practice.awaitingRetype ? 'You got it!' : 'Correct!'}${streakMsg}</div>`;
    input.disabled = true;
    setTimeout(nextPracticeWord, practice.streak >= 2 ? 1300 : 900);
  } else {
    if (!practice.awaitingRetype) {
      playBuzz();
      const card = $('#practice-card');
      card.classList.remove('flash-correct', 'flash-wrong');
      void card.offsetWidth;
      card.classList.add('flash-wrong');
      practice.missed.push(w.word);
      practice.missedWords.push(w);
      practice.streak = 0;
    }
    showStudyThenRetype(typed, w);
  }
});

// look–cover–write–check: show the diff and the correct word, then hide it and retype
function showStudyThenRetype(typed, w) {
  practice.awaitingRetype = true;
  const input = $('#practice-input');
  input.disabled = true;
  const d = diffLetters(typed, w.word);
  const fb = $('#feedback');
  let secs = 8;

  const hint = `Hint: starts with <strong>${esc(w.word[0].toUpperCase())}</strong>`;
  const render = () => {
    fb.innerHTML = `
      <div class="banner bad">Not quite — study it!</div>
      <div class="diff-line"><span class="label">You typed</span>${d.typedHtml}</div>
      <div class="diff-line"><span class="label">Correct</span>${d.correctHtml}</div>
      <div class="study-word">${esc(w.word)}</div>
      <div class="hint-badge">${hint}</div>
      <div class="countdown">Memorize it… ${secs}</div>`;
  };
  render();

  const timer = setInterval(() => {
    secs--;
    if (secs > 0) return render();
    clearInterval(timer);
    fb.innerHTML = `<div class="banner bad">🙈 Word hidden — now type it from memory!</div>`;
    $('#practice-prompt').textContent = 'Type it from memory:';
    input.value = '';
    input.disabled = false;
    input.focus();
  }, 1000);
}

async function nextPracticeWord() {
  practice.i++;
  if (practice.i < practice.words.length) return presentPracticeWord();
  $('#practice-bar').style.width = '100%';
  $('#practice-progress').textContent = 'Done!';
  $('#practice-card').hidden = true;
  if (practice.itemId) {
    await api(`/api/items/${practice.itemId}/complete`, {
      method: 'POST',
      body: {
        studentId: currentStudent.id,
        date: todayStr(),
        sessionAttempted: practice.words.length,
        sessionCorrect: practice.firstTryCorrect,
      },
    });
  }
  const missedWords = practice.missedWords.slice();
  const missedHtml = practice.missed.length
    ? `<p>Words to keep working on:</p><ul>${practice.missed.map((m) => `<li>📌 ${esc(m)}</li>`).join('')}</ul>`
    : `<p>Perfect round — every word right on the first try! 🏆</p>`;
  const drillBtn = missedWords.length
    ? `<button id="practice-drill-missed" class="check-btn secondary">🔁 Drill missed words</button>` : '';
  $('#practice-done').innerHTML = `
    <div>🎉 Practice complete!</div>
    <div class="big-score">${practice.firstTryCorrect} / ${practice.words.length}</div>
    <p>right on the first try</p>
    ${missedHtml}
    ${drillBtn}
    <button id="practice-home">Back</button>`;
  $('#practice-done').hidden = false;
  animateScore($('#practice-done .big-score'), practice.firstTryCorrect, practice.words.length);
  if (practice.missed.length === 0) showMiniCelebration('🏆 Perfect round!');
  else showMiniCelebration(randomCheer());
  if (missedWords.length) {
    $('#practice-drill-missed').addEventListener('click', () => {
      Object.assign(practice, { words: shuffle(missedWords), i: 0, missed: [], missedWords: [], firstTryCorrect: 0, awaitingRetype: false, streak: 0 });
      $('#practice-card').hidden = false;
      $('#practice-done').hidden = true;
      presentPracticeWord();
    });
  }
  $('#practice-home').addEventListener('click', () => backTarget());
}

// ---------- spelling: test ----------

const test = { list: null, words: [], i: 0, answers: [], itemId: null, allowRetakes: false };

async function startTest({ listId, itemId, allowRetakes = false } = {}) {
  const url = listId ? `/api/test/${currentStudent.id}?listId=${listId}` : `/api/test/${currentStudent.id}`;
  const data = await api(url);
  Object.assign(test, { list: data.list, words: data.words, i: 0, answers: [], itemId: itemId || null, allowRetakes: !!allowRetakes });
  $('#test-card').hidden = false;
  $('#test-done').hidden = true;
  show('test');
  presentTestWord();
}

function presentTestWord() {
  const w = test.words[test.i];
  $('#test-progress').textContent = `Word ${test.i + 1} of ${test.words.length}`;
  $('#test-bar').style.width = `${(test.i / test.words.length) * 100}%`;
  const input = $('#test-input');
  input.value = '';
  input.disabled = true;
  $('#test-listening').hidden = false;
  $('#test-form-row').hidden = true;
  speakWord(w);
  // Enable input after TTS has had time to start (rough estimate: 1.5s per word)
  const delay = 1500 + (w.definition ? 1500 : 0) + (w.sentence ? 1500 : 0);
  setTimeout(() => {
    $('#test-listening').hidden = true;
    $('#test-form-row').hidden = false;
    input.disabled = false;
    input.focus();
  }, delay);
}

$('#btn-test-speak').addEventListener('click', () => speakWord(test.words[test.i]));

$('#test-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const typed = $('#test-input').value.trim();
  if (!typed) return;
  test.answers.push({ wordId: test.words[test.i].id, typed });
  test.i++;
  if (test.i < test.words.length) return presentTestWord();
  await finishTest();
});

async function finishTest() {
  speechSynthesis.cancel();
  const result = await api(`/api/test/${currentStudent.id}`, {
    method: 'POST',
    body: { listId: test.list.id, answers: test.answers, itemId: test.itemId, date: todayStr() },
  });
  $('#test-bar').style.width = '100%';
  $('#test-progress').textContent = 'Test finished!';
  $('#test-card').hidden = true;
  const rows = result.graded
    .map((g) =>
      g.correct
        ? `<li>✅ ${esc(g.word)}</li>`
        : `<li>❌ ${esc(g.word)} <small>(you wrote "${esc(g.typed)}")</small></li>`
    )
    .join('');

  let retakeBtn = '';
  if (test.itemId && test.allowRetakes) retakeBtn = `<button id="test-retake-btn" class="check-btn secondary">🔁 Retake Test</button>`;

  const testPct = result.total ? Math.round((result.score / result.total) * 100) : 100;
  $('#test-done').innerHTML = `
    <div>⭐ Test complete!</div>
    <div class="big-score">${result.score} / ${result.total}</div>
    <ul>${rows}</ul>
    ${retakeBtn}
    <button id="test-home">Back</button>`;
  $('#test-done').hidden = false;
  animateScore($('#test-done .big-score'), result.score, result.total);
  if (testPct === 100) showMiniCelebration('🏆 Perfect score!');
  else if (testPct >= 80) showMiniCelebration(`⭐ ${result.score}/${result.total} — Amazing!`);
  else if (testPct >= 60) showMiniCelebration(`✅ ${result.score}/${result.total} — Nice work!`);
  else showMiniCelebration(randomCheer());
  $('#test-home').addEventListener('click', () => backTarget());
  if (test.itemId && test.allowRetakes) {
    $('#test-retake-btn').addEventListener('click', () => {
      openItem(test.itemId, 'spelling_test');
    });
  }
}

$('#btn-practice').addEventListener('click', () => {
  backTarget = () => openKid(currentStudent.id, 'spelling');
  startPractice();
});
$('#btn-test').addEventListener('click', () => {
  backTarget = () => openKid(currentStudent.id, 'spelling');
  startTest();
});

// ---------- boot ----------

loadHome();
