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
  lesson: '📖', assignment: '📝', quiz: '❓',
  spelling_practice: '✏️', spelling_test: '⭐', flashcards: '🗂️',
};
const TYPE_LABEL = {
  lesson: 'Lesson', assignment: 'Assignment', quiz: 'Quiz',
  spelling_practice: 'Spelling Practice', spelling_test: 'Spelling Test', flashcards: 'Flashcards',
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

function speak(text, rate = 0.85) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.lang = 'en-US';
  speechSynthesis.speak(u);
}

function speakWord(w) {
  speechSynthesis.cancel();
  speak(w.word);
  if (w.sentence) speak(w.sentence, 0.95);
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

// ---------- home (kid picker) ----------

let currentStudent = null;

async function loadHome() {
  const students = await api('/api/students');
  $('#no-kids').hidden = students.length > 0;
  $('#kid-cards').innerHTML = students
    .map(
      (s) => `<button class="kid-card" data-id="${s.id}">
        <span class="avatar">${esc(s.emoji)}</span>${esc(s.name)}</button>`
    )
    .join('');
  document.querySelectorAll('.kid-card').forEach((card) =>
    card.addEventListener('click', () => openKid(Number(card.dataset.id)))
  );
}

// ---------- kid home: Today / Courses / Spelling ----------

document.querySelectorAll('.nav-pill').forEach((pill) =>
  pill.addEventListener('click', () => switchTab(pill.dataset.tab))
);

function switchTab(name) {
  document.querySelectorAll('.nav-pill').forEach((p) => p.classList.toggle('active', p.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((panel) => (panel.hidden = panel.id !== `tab-${name}`));
}

async function openKid(id, tab = 'today') {
  const [state, agenda, courses] = await Promise.all([
    api(`/api/state/${id}`),
    api(`/api/schedule/${id}?date=${todayStr()}`),
    api(`/api/courses/mine/${id}`),
  ]);
  currentStudent = state.student;
  $('#kid-greeting').textContent = `${state.student.emoji} Hi, ${state.student.name}!`;

  renderToday(agenda.tasks);
  renderCourseCards(courses);
  renderSpellingTab(state);

  show('kid');
  switchTab(tab);
}

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
      return `<button class="today-row" data-item-id="${t.itemId}" data-item-type="${t.type}">
        <span class="row-check">${t.done ? '✅' : TYPE_ICON[t.type]}</span>
        <span class="row-title">${esc(t.itemTitle)}<small>${esc(t.courseName)}</small></span>
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

function renderSpellingTab(state) {
  let html;
  if (state.assignment) {
    const { mastered, total } = state.listProgress;
    html = `<strong>This week: ${esc(state.assignment.name)}</strong>
      <div class="mastery-dots">${'🌟'.repeat(mastered)}${'⚪'.repeat(Math.max(0, total - mastered))}</div>
      <div>${mastered} of ${total} words mastered</div>`;
  } else {
    html = `No list assigned yet — ask a parent to pick one!`;
  }
  if (state.dueReviews > 0) {
    html += `<div>🔁 ${state.dueReviews} old ${state.dueReviews === 1 ? 'word' : 'words'} due for review</div>`;
  }
  $('#kid-week').innerHTML = html;
  $('#btn-test').disabled = !state.assignment;
}

// ---------- course detail ----------

async function openCourse(courseId) {
  const course = await api(`/api/courses/${courseId}/detail?studentId=${currentStudent.id}`);
  $('#course-title').textContent = course.name;
  $('#course-units').innerHTML = course.units
    .map(
      (u) => `<div class="unit-block">
        <h2>${esc(u.name)}</h2>
        ${u.items
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
          .join('')}
      </div>`
    )
    .join('');
  document.querySelectorAll('#course-units .today-row:not(.locked)').forEach((row) =>
    row.addEventListener('click', () => {
      backTarget = () => openCourse(courseId);
      openItem(Number(row.dataset.itemId), row.dataset.itemType);
    })
  );
  show('course');
}

// ---------- item dispatch ----------

async function openItem(itemId, type) {
  if (type === 'lesson') return openLesson(itemId);
  if (type === 'assignment') return openAssignment(itemId);
  if (type === 'quiz') return openQuiz(itemId, false);
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
  btn.textContent = item.submission ? '✅ Read' : 'Done reading ✓';
  btn.onclick = async () => {
    await api(`/api/items/${itemId}/complete`, { method: 'POST', body: { studentId: currentStudent.id, date: todayStr() } });
    backTarget();
  };
}

// ---------- assignment ----------

async function openAssignment(itemId) {
  evidencePhotoBase64 = null;
  $('#assignment-photo-status').textContent = '';
  $('#assignment-photo-input').value = '';
  $('#assignment-evidence-notes').value = '';
  $('#assignment-student-note').value = '';

  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  $('#assignment-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#assignment-title').textContent = item.title;
  $('#assignment-points').textContent = item.points ? `Worth ${item.points} points` : '';
  $('#assignment-body').innerHTML = esc(item.body).replace(/\n/g, '<br>');

  const btn = $('#assignment-done-btn');
  const status = $('#assignment-status');
  const commentEl = $('#assignment-comment');
  const evidenceSection = $('#assignment-evidence-section');
  const needsEvidence = item.evidence_mode === 'required' || item.evidence_mode === 'optional';

  // Show parent comment if graded
  if (item.submission?.parent_comment) {
    commentEl.hidden = false;
    commentEl.innerHTML = `<strong>Parent feedback:</strong> ${esc(item.submission.parent_comment)}`;
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
      openAssignment(itemId);
    };
  }
  show('assignment');
}

// ---------- quiz ----------

async function openQuiz(itemId, forceRetake = false) {
  const item = await api(`/api/items/${itemId}?studentId=${currentStudent.id}`);
  $('#quiz-kicker').textContent = `${item.course_name} · ${item.unit_name}`;
  $('#quiz-title').textContent = item.title;
  const graded = !forceRetake && item.submission && item.submission.status === 'graded';
  const result = $('#quiz-result');

  if (graded) {
    result.hidden = false;
    result.className = 'status-banner good';
    const pct = item.submission.points_possible ? Math.round((item.submission.score / item.submission.points_possible) * 100) : 0;
    result.innerHTML = `🌟 Score: ${item.submission.score} / ${item.submission.points_possible} (${pct}%)`;

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
      openQuiz(itemId, false);
    };
  }
  show('quiz');
}

const normalizeAnswer = (s) => String(s ?? '').trim().toLowerCase();

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
  $('#flash-back').hidden = false;
  $('#flash-reveal').hidden = true;
  $('#flash-grade-buttons').hidden = false;
});

let flashGrading = false;

async function gradeFlashcard(gotIt) {
  if (flashGrading) return; // guard against a rapid double-tap misgrading two cards
  flashGrading = true;
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

// ---------- spelling: practice ----------

const practice = { words: [], i: 0, missed: [], firstTryCorrect: 0, awaitingRetype: false, itemId: null };

async function startPractice({ listId, itemId } = {}) {
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
  Object.assign(practice, { words, i: 0, missed: [], firstTryCorrect: 0, awaitingRetype: false, itemId: itemId || null });
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
  $('#practice-prompt').textContent = 'Listen, then type the word:';
  $('#feedback').innerHTML = '';
  const input = $('#practice-input');
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
    if (!practice.awaitingRetype) practice.firstTryCorrect++;
    $('#feedback').innerHTML = `<div class="banner good">✅ ${practice.awaitingRetype ? 'You got it!' : 'Correct!'}</div>`;
    input.disabled = true;
    setTimeout(nextPracticeWord, 900);
  } else {
    if (!practice.awaitingRetype) practice.missed.push(w.word);
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
  let secs = 4;

  const render = () => {
    fb.innerHTML = `
      <div class="banner bad">Not quite — study it!</div>
      <div class="diff-line"><span class="label">You typed</span>${d.typedHtml}</div>
      <div class="diff-line"><span class="label">Correct</span>${d.correctHtml}</div>
      <div class="study-word">${esc(w.word)}</div>
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
    await api(`/api/items/${practice.itemId}/complete`, { method: 'POST', body: { studentId: currentStudent.id, date: todayStr() } });
  }
  const missedHtml = practice.missed.length
    ? `<p>Words to keep working on:</p><ul>${practice.missed.map((m) => `<li>📌 ${esc(m)}</li>`).join('')}</ul>`
    : `<p>Perfect round — every word right on the first try! 🏆</p>`;
  $('#practice-done').innerHTML = `
    <div>🎉 Practice complete!</div>
    <div class="big-score">${practice.firstTryCorrect} / ${practice.words.length}</div>
    <p>right on the first try</p>
    ${missedHtml}
    <button id="practice-home">Back</button>`;
  $('#practice-done').hidden = false;
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
  input.focus();
  speakWord(w);
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

  $('#test-done').innerHTML = `
    <div>⭐ Test complete!</div>
    <div class="big-score">${result.score} / ${result.total}</div>
    <ul>${rows}</ul>
    ${retakeBtn}
    <button id="test-home">Back</button>`;
  $('#test-done').hidden = false;
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
