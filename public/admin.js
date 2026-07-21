// ---------- tiny helpers ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

let parentPin = sessionStorage.getItem('pin') || null;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (parentPin) headers['x-pin'] = parentPin;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function msg(text) {
  $('#admin-msg').textContent = text;
  setTimeout(() => ($('#admin-msg').textContent = ''), 4000);
}

const TYPE_ICON = {
  lesson: '📖', assignment: '📝', quiz: '❓',
  spelling_practice: '✏️', spelling_test: '⭐', flashcards: '🗂️',
};
const TYPE_LABEL = {
  lesson: 'Lesson', assignment: 'Assignment', quiz: 'Quiz',
  spelling_practice: 'Spelling Practice', spelling_test: 'Spelling Test', flashcards: 'Flashcards',
};

// ---------- PIN gate ----------

$('#pin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $('#pin-input').value;
  const { ok } = await api('/api/parent/verify', { method: 'POST', body: { pin } });
  if (!ok) return ($('#pin-error').hidden = false);
  parentPin = pin;
  sessionStorage.setItem('pin', pin);
  $('#pin-error').hidden = true;
  unlock();
});

async function unlock() {
  $('#pin-gate').hidden = true;
  $('#console').hidden = false;
  showPanel('kids');
  loadGradingBadge();
}

async function loadGradingBadge() {
  try {
    const { count } = await api('/api/grading-queue/count');
    const pill = document.querySelector('.nav-pill[data-panel="grading"]');
    if (count > 0) {
      pill.textContent = `✅ Grading (${count})`;
      pill.classList.add('grading-pending');
    } else {
      pill.textContent = '✅ Grading';
      pill.classList.remove('grading-pending');
    }
  } catch {}
}

if (parentPin) unlock();

// ---------- navigation ----------

document.querySelectorAll('.admin-nav .nav-pill').forEach((pill) =>
  pill.addEventListener('click', () => showPanel(pill.dataset.panel))
);
document.querySelectorAll('[data-nav]').forEach((btn) =>
  btn.addEventListener('click', () => showPanel(btn.dataset.nav))
);

function showPanel(name) {
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== `panel-${name}`));
  document.querySelectorAll('.admin-nav .nav-pill').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  const loaders = {
    kids: loadKids, courses: loadCourses, planner: loadPlannerPanel,
    grading: loadGrading, gradebook: loadGradebookPanel, spelling: loadSpelling, decks: loadDecks,
    settings: loadOllamaConfig,
  };
  if (loaders[name]) loaders[name]();
  if (name === 'course-detail') openCourseDetail(currentCourseId);
}

// ============================================================
// Kids
// ============================================================

const THEME_COLORS = { blue: '#4f86f7', green: '#2e9e5b', purple: '#7c5cbf', orange: '#e8802a', pink: '#d45d8a' };

async function loadKids() {
  const students = await api('/api/students');
  $('#student-rows').innerHTML = students.length
    ? students
        .map((s) => {
          const theme = s.theme || 'blue';
          const swatches = Object.entries(THEME_COLORS)
            .map(([t, c]) => `<button class="theme-swatch theme-${t} ${t === theme ? 'selected' : ''}" data-student-theme="${s.id}" data-theme="${t}" title="${t}" style="background:${c}"></button>`)
            .join('');
          const streak = s.streak_count >= 2 ? `<span style="color:#e8802a;font-size:.85rem">🔥 ${s.streak_count} day streak</span>` : '';
          return `<div class="item-row">
            <span style="font-size:1.5rem">${esc(s.emoji)}</span>
            <strong class="grow">${esc(s.name)}</strong>
            ${streak}
            <div class="theme-swatch-row" title="Kid's color theme">${swatches}</div>
            <button class="danger" data-del-student="${s.id}">Remove</button>
          </div>`;
        })
        .join('')
    : `<p class="hint">No kids yet — add one below.</p>`;

  document.querySelectorAll('[data-student-theme]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const studentId = btn.dataset.studentTheme;
      const theme = btn.dataset.theme;
      await api(`/api/students/${studentId}`, { method: 'PUT', body: { theme } });
      // Update selected state without full reload
      document.querySelectorAll(`[data-student-theme="${studentId}"]`).forEach((b) =>
        b.classList.toggle('selected', b.dataset.theme === theme)
      );
    })
  );

  document.querySelectorAll('[data-del-student]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this kid and all their progress? This cannot be undone.')) return;
      await api(`/api/students/${btn.dataset.delStudent}`, { method: 'DELETE' });
      loadKids();
    })
  );
}

$('#add-student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#new-student-name').value.trim();
  if (!name) return;
  await api('/api/students', { method: 'POST', body: { name, emoji: $('#new-student-emoji').value } });
  $('#new-student-name').value = '';
  loadKids();
});

// ============================================================
// Courses list + detail (units, items, roster)
// ============================================================

let currentCourseId = null;
let cachedLists = [];
let cachedDecks = [];

async function loadCourses() {
  const courses = await api('/api/admin/courses');
  $('#course-rows').innerHTML = courses.length
    ? courses
        .map(
          (c) => `<div class="item-row">
            <span class="color-dot" style="background:${esc(c.color)}"></span>
            <strong class="grow">${esc(c.name)}</strong>
            <span>${esc(c.subject || '')}</span>
            <span>${c.unitCount} unit${c.unitCount === 1 ? '' : 's'}, ${c.itemCount} item${c.itemCount === 1 ? '' : 's'}</span>
            ${c.archived ? '<span class="archived-badge">archived</span>' : ''}
            <button data-open-course="${c.id}">Open</button>
          </div>`
        )
        .join('')
    : `<p class="hint">No courses yet — add one below.</p>`;

  document.querySelectorAll('[data-open-course]').forEach((btn) =>
    btn.addEventListener('click', () => {
      currentCourseId = Number(btn.dataset.openCourse);
      showPanel('course-detail');
    })
  );
}

$('#add-course-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#new-course-name').value.trim();
  if (!name) return;
  const { id } = await api('/api/courses', {
    method: 'POST',
    body: { name, subject: $('#new-course-subject').value.trim(), color: $('#new-course-color').value },
  });
  $('#new-course-name').value = '';
  $('#new-course-subject').value = '';
  currentCourseId = id;
  showPanel('course-detail');
});

async function openCourseDetail(id) {
  if (!id) return showPanel('courses');
  const [course, roster] = await Promise.all([
    api(`/api/admin/courses/${id}`),
    api(`/api/courses/${id}/roster`),
  ]);
  $('#cd-name').textContent = course.name;
  $('#cd-name-input').value = course.name;
  $('#cd-subject-input').value = course.subject || '';
  $('#cd-color-input').value = course.color;
  $('#cd-archived').checked = !!course.archived;

  $('#cd-roster').innerHTML = roster
    .map(
      (s) => `<label class="checkbox-label">
        <input type="checkbox" data-roster-student="${s.id}" ${s.enrolled ? 'checked' : ''}>
        ${esc(s.emoji)} ${esc(s.name)}
      </label>`
    )
    .join('');
  document.querySelectorAll('[data-roster-student]').forEach((box) =>
    box.addEventListener('change', async () => {
      if (box.checked) await api(`/api/courses/${id}/enroll`, { method: 'POST', body: { studentId: box.dataset.rosterStudent } });
      else await api(`/api/courses/${id}/enroll/${box.dataset.rosterStudent}`, { method: 'DELETE' });
    })
  );

  $('#cd-units').innerHTML = course.units
    .map(
      (u) => `<div class="unit-block">
        <div class="unit-header">
          <h3>${esc(u.name)}</h3>
          <button class="danger small" data-del-unit="${u.id}">Delete unit</button>
        </div>
        ${u.items
          .map(
            (it) => `<div class="item-row">
              <span>${TYPE_ICON[it.type]}</span>
              <span class="grow">${esc(it.title)}</span>
              <span>${TYPE_LABEL[it.type]}</span>
              <button data-edit-item="${it.id}" data-unit-id="${u.id}">Edit</button>
            </div>`
          )
          .join('')}
        <button class="secondary small" data-add-item="${u.id}">+ Add item to this unit</button>
      </div>`
    )
    .join('') || `<p class="hint">No units yet — add one below.</p>`;

  document.querySelectorAll('[data-del-unit]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this unit and everything in it?')) return;
      await api(`/api/units/${btn.dataset.delUnit}`, { method: 'DELETE' });
      openCourseDetail(id);
    })
  );
  document.querySelectorAll('[data-add-item]').forEach((btn) =>
    btn.addEventListener('click', () => openItemEditor(btn.dataset.addItem, null))
  );
  document.querySelectorAll('[data-edit-item]').forEach((btn) =>
    btn.addEventListener('click', () => openItemEditor(btn.dataset.unitId, btn.dataset.editItem))
  );

  $('#cd-print').onclick = () => printCourse(id);

  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== 'panel-course-detail'));
  document.querySelectorAll('.admin-nav .nav-pill').forEach((p) => p.classList.remove('active'));
}

$('#course-meta-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api(`/api/courses/${currentCourseId}`, {
    method: 'PUT',
    body: {
      name: $('#cd-name-input').value.trim(),
      subject: $('#cd-subject-input').value.trim(),
      color: $('#cd-color-input').value,
      archived: $('#cd-archived').checked,
    },
  });
  msg('Course saved.');
  openCourseDetail(currentCourseId);
});

$('#cd-delete').addEventListener('click', async () => {
  if (!confirm('Delete this whole course, including all units, items, and grades?')) return;
  await api(`/api/courses/${currentCourseId}`, { method: 'DELETE' });
  currentCourseId = null;
  showPanel('courses');
});

$('#add-unit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#new-unit-name').value.trim();
  if (!name) return;
  await api('/api/units', { method: 'POST', body: { courseId: currentCourseId, name } });
  $('#new-unit-name').value = '';
  openCourseDetail(currentCourseId);
});

// ============================================================
// Item editor
// ============================================================

let questionCount = 0;
let cachedQuizTemplates = [];

async function openItemEditor(unitId, itemId) {
  let courseDetail;
  [cachedLists, cachedDecks, cachedQuizTemplates, courseDetail] = await Promise.all([
    api('/api/lists'),
    api('/api/decks'),
    api('/api/quiz-templates'),
    api(`/api/admin/courses/${currentCourseId}`),
  ]);
  $('#ie-list').innerHTML = cachedLists.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
  $('#ie-deck').innerHTML = cachedDecks.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

  // Populate template select
  $('#ie-template-select').innerHTML = `<option value="">— load from template —</option>` +
    cachedQuizTemplates.map((t) => `<option value="${t.id}">${esc(t.name)} (${t.questionCount}q)</option>`).join('');

  // Populate prereq select (all items in course except this one)
  const allCourseItems = courseDetail.units.flatMap((u) => u.items);
  $('#ie-prereq').innerHTML = `<option value="">None</option>` +
    allCourseItems
      .filter((it) => it.id !== Number(itemId))
      .map((it) => `<option value="${it.id}">${esc(it.title)}</option>`)
      .join('');

  $('#ie-id').value = itemId || '';
  $('#ie-unit-id').value = unitId;
  $('#ie-error').hidden = true;
  $('#ie-questions').innerHTML = '';
  questionCount = 0;

  if (itemId) {
    const item = await api(`/api/admin/items/${itemId}`);
    $('#ie-heading').textContent = `Edit: ${item.title}`;
    $('#ie-type').value = item.type;
    $('#ie-title').value = item.title;
    $('#ie-body-lesson').value = item.body;
    $('#ie-body-assignment').value = item.body;
    $('#ie-points').value = item.points || 10;
    $('#ie-due-date').value = item.due_date || '';
    $('#ie-allow-retakes').checked = !!item.allow_retakes;
    $('#ie-prereq').value = item.prereq_item_id || '';
    $('#ie-evidence-mode').value = item.evidence_mode || 'none';
    $('#ie-retake-policy').value = item.retake_policy || 'latest';
    if (item.type === 'spelling_practice' || item.type === 'spelling_test') $('#ie-list').value = item.ref_id;
    if (item.type === 'flashcards') $('#ie-deck').value = item.ref_id;
    if (item.type === 'quiz') (item.questions || []).forEach(addQuestionRow);
    $('#ie-delete').hidden = false;
    $('#ie-delete').onclick = async () => {
      if (!confirm('Delete this item and any grades for it?')) return;
      await api(`/api/items/${itemId}`, { method: 'DELETE' });
      showPanel('course-detail');
    };
  } else {
    $('#ie-heading').textContent = 'New item';
    $('#ie-type').value = 'lesson';
    $('#ie-title').value = '';
    $('#ie-body-lesson').value = '';
    $('#ie-body-assignment').value = '';
    $('#ie-points').value = 10;
    $('#ie-due-date').value = '';
    $('#ie-allow-retakes').checked = false;
    $('#ie-prereq').value = '';
    $('#ie-evidence-mode').value = 'none';
    $('#ie-retake-policy').value = 'latest';
    $('#ie-delete').hidden = true;
  }
  updateItemFieldVisibility();
  resetScanSection();
  resetImportSection();
  showPanel('item-editor');
}

function updateItemFieldVisibility() {
  const type = $('#ie-type').value;
  $('#ie-field-lesson').hidden = type !== 'lesson';
  $('#ie-field-assignment').hidden = type !== 'assignment';
  $('#ie-field-quiz').hidden = type !== 'quiz';
  $('#ie-field-spelling').hidden = type !== 'spelling_practice' && type !== 'spelling_test';
  $('#ie-field-flashcards').hidden = type !== 'flashcards';
  $('#ie-scan-section').hidden = type !== 'lesson' && type !== 'quiz';
  $('#ie-import-section').hidden = type === 'spelling_practice' || type === 'spelling_test' || type === 'flashcards';
}
$('#ie-type').addEventListener('change', updateItemFieldVisibility);

// ---------- scan a page (photo -> lesson/quiz content via local Ollama) ----------

let scanImageBase64 = null;

function resetImportSection() {
  $('#import-file-select').innerHTML = '<option value="">— choose a file —</option>';
  $('#import-go-btn').disabled = true;
  $('#import-status').textContent = '';
}

function resetScanSection() {
  scanImageBase64 = null;
  $('#scan-file-input').value = '';
  $('#scan-preview').hidden = true;
  $('#scan-preview').src = '';
  $('#scan-go-btn').disabled = true;
  $('#scan-status').textContent = '';
}

function fileToScanImage(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('#scan-pick-btn').addEventListener('click', () => $('#scan-file-input').click());

$('#scan-file-input').addEventListener('change', async () => {
  const file = $('#scan-file-input').files[0];
  if (!file) return;
  try {
    const dataUrl = await fileToScanImage(file);
    scanImageBase64 = dataUrl.split(',')[1];
    $('#scan-preview').src = dataUrl;
    $('#scan-preview').hidden = false;
    $('#scan-go-btn').disabled = false;
    $('#scan-status').textContent = '';
  } catch (err) {
    $('#scan-status').textContent = `❌ ${err.message}`;
  }
});

$('#scan-go-btn').addEventListener('click', async () => {
  if (!scanImageBase64) return;
  const mode = $('#ie-type').value === 'quiz' ? 'quiz' : 'lesson';
  $('#scan-go-btn').disabled = true;
  $('#scan-status').textContent = '🔍 Reading the page… this can take a minute or two on local hardware.';
  try {
    const result = await api('/api/admin/scan', { method: 'POST', body: { image: scanImageBase64, mode } });
    if (result.title) $('#ie-title').value = result.title;
    const providerLabel = result._provider === 'cloud' ? 'cloud API' : 'local Ollama';
    const fallbackNote = result._fallback ? ` (primary failed — used ${providerLabel} as fallback: ${result._primaryError})` : ` via ${providerLabel}`;
    if (mode === 'lesson') {
      $('#ie-body-lesson').value = result.body || '';
      $('#scan-status').textContent = `✅ Scanned${fallbackNote}. Review the text below before saving.`;
    } else {
      $('#ie-questions').innerHTML = '';
      questionCount = 0;
      // addQuestionRow expects correct_answer (snake_case); scan returns correctAnswer (camelCase) — normalize here.
      (result.questions || []).forEach((q) => addQuestionRow({ ...q, correct_answer: q.correctAnswer }));
      const blanks = (result.questions || []).filter((q) => !q.correctAnswer).length;
      $('#scan-status').textContent = `✅ Found ${result.questions?.length || 0} question(s)${fallbackNote}` +
        (blanks ? ` — ${blanks} need${blanks === 1 ? 's' : ''} a correct answer` : '') + '. Review before saving.';
    }
  } catch (err) {
    $('#scan-status').textContent = `❌ ${err.message}`;
  } finally {
    $('#scan-go-btn').disabled = false;
  }
});

// ---------- import from Homeschool folder ----------

$('#import-load-btn').addEventListener('click', async () => {
  $('#import-status').textContent = 'Loading files…';
  $('#import-file-select').innerHTML = '<option value="">— loading… —</option>';
  try {
    const { files } = await api('/api/admin/homeschool-files');
    if (!files.length) {
      $('#import-file-select').innerHTML = '<option value="">No .docx files found</option>';
      $('#import-status').textContent = '';
      return;
    }
    $('#import-file-select').innerHTML =
      '<option value="">— choose a file —</option>' +
      files.map((f) => `<option value="${esc(f.path)}">${esc(f.path)}</option>`).join('');
    $('#import-go-btn').disabled = false;
    $('#import-status').textContent = `${files.length} file(s) found.`;
  } catch (err) {
    $('#import-status').textContent = `❌ ${err.message}`;
  }
});

$('#import-file-select').addEventListener('change', () => {
  $('#import-go-btn').disabled = !$('#import-file-select').value;
});

$('#import-go-btn').addEventListener('click', async () => {
  const path = $('#import-file-select').value;
  if (!path) return;
  const type = $('#ie-type').value;
  const mode = type === 'quiz' ? 'quiz' : type === 'lesson' ? 'lesson' : 'lesson';
  $('#import-go-btn').disabled = true;
  $('#import-status').textContent = '🔍 Extracting content… this may take a minute.';
  try {
    const result = await api('/api/admin/import-docx', { method: 'POST', body: { path, mode } });
    if (!$('#ie-title').value && result.title) $('#ie-title').value = result.title;
    if (mode === 'quiz' && result.questions) {
      $('#ie-questions').innerHTML = '';
      questionCount = 0;
      const normalized = result.questions.map((q) => ({
        ...q,
        correct_answer: q.correctAnswer ?? q.correct_answer ?? '',
      }));
      normalized.forEach(addQuestionRow);
      $('#import-status').textContent = `✅ Imported ${result.questions.length} question(s). Review before saving.`;
    } else if (result.body) {
      const bodyField = type === 'assignment' ? '#ie-body-assignment' : '#ie-body-lesson';
      $(bodyField).value = result.body;
      $('#import-status').textContent = '✅ Content imported. Review before saving.';
    } else {
      $('#import-status').textContent = '⚠️ File imported but no content was found.';
    }
  } catch (err) {
    $('#import-status').textContent = `❌ ${err.message}`;
  } finally {
    $('#import-go-btn').disabled = false;
  }
});

function addQuestionRow(q = {}) {
  const n = questionCount++;
  const div = document.createElement('div');
  div.className = 'quiz-q-row';
  div.dataset.qn = n;
  div.innerHTML = `
    <select class="qn-type">
      <option value="mc" ${q.type === 'mc' ? 'selected' : ''}>Multiple choice</option>
      <option value="tf" ${q.type === 'tf' ? 'selected' : ''}>True / False</option>
      <option value="short" ${q.type === 'short' ? 'selected' : ''}>Short answer</option>
    </select>
    <input class="qn-prompt" placeholder="Question" value="${esc(q.prompt || '')}">
    <input class="qn-choices" placeholder="Choices, comma separated (multiple choice only)" value="${esc((q.choices || []).join(', '))}">
    <input class="qn-correct" placeholder="Correct answer" value="${esc(q.correct_answer || '')}">
    <input class="qn-points" type="number" min="1" value="${q.points || 1}" style="width:4rem">
    <button type="button" class="danger small qn-remove">✕</button>`;
  div.querySelector('.qn-remove').addEventListener('click', () => div.remove());
  $('#ie-questions').appendChild(div);
}
$('#ie-add-question').addEventListener('click', () => addQuestionRow());

$('#ie-load-template').addEventListener('click', async () => {
  const tid = $('#ie-template-select').value;
  if (!tid) return msg('Pick a template first.');
  const t = await api(`/api/quiz-templates/${tid}`);
  $('#ie-questions').innerHTML = '';
  questionCount = 0;
  t.questions.forEach((q) => addQuestionRow({ ...q, correct_answer: q.correct_answer }));
  msg(`Loaded "${t.name}" — ${t.questions.length} question(s).`);
});

$('#ie-save-template').addEventListener('click', async () => {
  const itemId = $('#ie-id').value;
  if (!itemId) return msg('Save the item first, then save as template.');
  const name = prompt('Template name:');
  if (!name) return;
  try {
    await api('/api/quiz-templates', { method: 'POST', body: { name, itemId: Number(itemId) } });
    msg(`Template "${name}" saved.`);
    cachedQuizTemplates = await api('/api/quiz-templates');
    $('#ie-template-select').innerHTML = `<option value="">— load from template —</option>` +
      cachedQuizTemplates.map((t) => `<option value="${t.id}">${esc(t.name)} (${t.questionCount}q)</option>`).join('');
  } catch (err) { msg(err.message); }
});

$('#item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = $('#ie-type').value;
  const title = $('#ie-title').value.trim();
  const prereqVal = $('#ie-prereq').value;
  const body = {
    unitId: Number($('#ie-unit-id').value),
    type,
    title,
    body: type === 'lesson' ? $('#ie-body-lesson').value : type === 'assignment' ? $('#ie-body-assignment').value : '',
    points: type === 'assignment' ? Number($('#ie-points').value) || 0 : 0,
    refId: type === 'spelling_practice' || type === 'spelling_test' ? Number($('#ie-list').value)
         : type === 'flashcards' ? Number($('#ie-deck').value) : null,
    dueDate: $('#ie-due-date').value || null,
    allowRetakes: $('#ie-allow-retakes').checked,
    prereqItemId: prereqVal ? Number(prereqVal) : null,
    evidenceMode: $('#ie-evidence-mode').value,
    retakePolicy: $('#ie-retake-policy').value,
  };
  if (type === 'quiz') {
    body.questions = Array.from(document.querySelectorAll('.quiz-q-row')).map((row) => ({
      type: row.querySelector('.qn-type').value,
      prompt: row.querySelector('.qn-prompt').value.trim(),
      choices: row.querySelector('.qn-choices').value.split(',').map((c) => c.trim()).filter(Boolean),
      correctAnswer: row.querySelector('.qn-correct').value.trim(),
      points: Number(row.querySelector('.qn-points').value) || 1,
    }));
  }

  const id = $('#ie-id').value;
  try {
    if (id) await api(`/api/items/${id}`, { method: 'PUT', body });
    else await api('/api/items', { method: 'POST', body });
    msg('Item saved.');
    showPanel('course-detail');
  } catch (err) {
    $('#ie-error').textContent = err.message;
    $('#ie-error').hidden = false;
  }
});

// ============================================================
// Planner
// ============================================================

function mondayOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let plannerWeekStart = mondayOf(new Date());
let plannerStudentId = null;
let plannerCoursesCache = [];
let plannerMode = 'week'; // 'week' | 'month'
let plannerMonthRef = null; // YYYY-MM-01 of the month being viewed

function firstMondayOfMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(1);
  return mondayOf(d);
}
function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function monthLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleString('default', { month: 'long', year: 'numeric' });
}

async function loadPlannerPanel() {
  const [students, courses] = await Promise.all([api('/api/students'), api('/api/admin/courses')]);
  if (students.length === 0) {
    $('#planner-grid').innerHTML = `<p class="hint">Add a kid first.</p>`;
    return;
  }
  $('#planner-student').innerHTML = students.map((s) => `<option value="${s.id}">${esc(s.emoji)} ${esc(s.name)}</option>`).join('');
  if (!plannerStudentId || !students.some((s) => s.id === plannerStudentId)) plannerStudentId = students[0].id;
  $('#planner-student').value = plannerStudentId;
  $('#auto-course').innerHTML = courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if (!$('#auto-start-date').value) $('#auto-start-date').value = plannerWeekStart;
  await renderPlanner();
}

$('#auto-schedule-btn').addEventListener('click', async () => {
  const courseId = Number($('#auto-course').value);
  const startDate = $('#auto-start-date').value;
  const itemsPerDay = Number($('#auto-items-per-day').value) || 1;
  if (!courseId || !startDate) { $('#auto-schedule-msg').textContent = 'Pick a course and start date.'; return; }
  const { scheduled } = await api('/api/schedule/auto', {
    method: 'POST',
    body: { studentId: plannerStudentId, courseId, startDate, itemsPerDay },
  });
  $('#auto-schedule-msg').textContent = `Scheduled ${scheduled} item${scheduled === 1 ? '' : 's'} starting ${startDate}.`;
  plannerWeekStart = mondayOf(startDate + 'T12:00:00');
  renderPlanner();
});

$('#planner-student').addEventListener('change', () => {
  plannerStudentId = Number($('#planner-student').value);
  renderPlanner();
});
$('#planner-view-week').addEventListener('click', () => {
  plannerMode = 'week';
  $('#planner-view-week').classList.add('active-view');
  $('#planner-view-month').classList.remove('active-view');
  $('#planner-copy').hidden = false;
  renderPlanner();
});
$('#planner-view-month').addEventListener('click', () => {
  plannerMode = 'month';
  // derive the month from the current week view date
  const ref = new Date(plannerWeekStart + 'T00:00:00');
  plannerMonthRef = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`;
  plannerWeekStart = firstMondayOfMonth(plannerMonthRef);
  $('#planner-view-month').classList.add('active-view');
  $('#planner-view-week').classList.remove('active-view');
  $('#planner-copy').hidden = true;
  renderPlanner();
});
$('#planner-prev').addEventListener('click', () => {
  if (plannerMode === 'month') {
    plannerMonthRef = addMonths(plannerMonthRef, -1);
    plannerWeekStart = firstMondayOfMonth(plannerMonthRef);
  } else {
    plannerWeekStart = addDays(plannerWeekStart, -7);
  }
  renderPlanner();
});
$('#planner-next').addEventListener('click', () => {
  if (plannerMode === 'month') {
    plannerMonthRef = addMonths(plannerMonthRef, 1);
    plannerWeekStart = firstMondayOfMonth(plannerMonthRef);
  } else {
    plannerWeekStart = addDays(plannerWeekStart, 7);
  }
  renderPlanner();
});

$('#planner-copy').addEventListener('click', async () => {
  const from = addDays(plannerWeekStart, -7);
  const { copied } = await api('/api/schedule/copy', { method: 'POST', body: { studentId: plannerStudentId, from, to: plannerWeekStart } });
  msg(`Copied ${copied} task${copied === 1 ? '' : 's'} from last week.`);
  renderPlanner();
});

$('#planner-print').addEventListener('click', () => {
  if (plannerMode === 'month') printMonthReport(plannerStudentId, plannerWeekStart, plannerMonthRef);
  else printWeekReport(plannerStudentId, plannerWeekStart);
});

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function attachPlannerEvents() {
  let draggingId = null;
  document.querySelectorAll('.planner-task[draggable]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      draggingId = el.dataset.taskId;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      draggingId = null;
      el.classList.remove('dragging');
      document.querySelectorAll('.planner-tasks').forEach((col) => col.classList.remove('drop-target'));
    });
  });
  document.querySelectorAll('.planner-tasks').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drop-target');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drop-target');
      if (!draggingId) return;
      await api(`/api/schedule/${draggingId}`, { method: 'PATCH', body: { date: col.dataset.dropDate } });
      renderPlanner();
    });
  });
  document.querySelectorAll('[data-del-schedule]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await api(`/api/schedule/${btn.dataset.delSchedule}`, { method: 'DELETE' });
      renderPlanner();
    })
  );
  document.querySelectorAll('[data-add-task]').forEach((btn) =>
    btn.addEventListener('click', () => toggleAddTaskForm(btn.dataset.addTask))
  );
}

function renderDayCell(day, tasks, compact = false) {
  const dayTasks = tasks.filter((t) => t.date === day.date);
  return `<div class="planner-day${compact ? ' planner-day-compact' : ''}" data-drop-date="${day.date}">
    <h3>${compact ? day.name.slice(0,3) : day.name}<small>${compact ? day.date.slice(5) : day.date}</small></h3>
    <div class="planner-tasks" data-drop-date="${day.date}">
      ${dayTasks.map((t) => `<div class="planner-task ${t.done ? 'done' : ''}" draggable="true" data-task-id="${t.id}">
        <span>${t.itemId ? TYPE_ICON[t.type] : '📌'} ${esc(t.itemTitle || t.offlineTitle)}</span>
        <button class="danger tiny" data-del-schedule="${t.id}">✕</button>
      </div>`).join('') || `<p class="hint tiny">—</p>`}
    </div>
    <button class="secondary small" data-add-task="${day.date}">+ Add</button>
    <div class="add-task-form" data-form-for="${day.date}" hidden></div>
  </div>`;
}

async function renderPlanner() {
  const courses = await api(`/api/courses/mine/${plannerStudentId}`);
  plannerCoursesCache = courses;

  if (plannerMode === 'month') {
    // Build 4-5 week rows covering the month
    const month = new Date(plannerMonthRef + 'T00:00:00').getMonth();
    const weeks = [];
    let cursor = plannerWeekStart;
    for (let w = 0; w < 6; w++) {
      const weekDays = DAY_NAMES.map((name, i) => ({ name, date: addDays(cursor, i) }));
      const fridayMonth = new Date(weekDays[4].date + 'T00:00:00').getMonth();
      const mondayMonth = new Date(weekDays[0].date + 'T00:00:00').getMonth();
      if (w > 0 && mondayMonth !== month && fridayMonth !== month) break;
      weeks.push(weekDays);
      cursor = addDays(cursor, 7);
    }
    const rangeStart = weeks[0][0].date;
    const rangeEnd = weeks[weeks.length - 1][4].date;
    const { tasks } = await api(`/api/schedule-range/${plannerStudentId}?start=${rangeStart}&end=${rangeEnd}`);

    $('#planner-week-label').textContent = monthLabel(plannerMonthRef);
    $('#planner-grid').className = 'planner-grid planner-month';
    $('#planner-grid').innerHTML =
      `<div class="planner-month-header">${DAY_NAMES.map((d) => `<div>${d.slice(0,3)}</div>`).join('')}</div>` +
      weeks.map((week) =>
        `<div class="planner-month-row">${week.map((day) => renderDayCell(day, tasks, true)).join('')}</div>`
      ).join('');
  } else {
    const end = addDays(plannerWeekStart, 4);
    $('#planner-week-label').textContent = `${plannerWeekStart} → ${end}`;
    const { tasks } = await api(`/api/schedule-week/${plannerStudentId}?start=${plannerWeekStart}`);
    const days = DAY_NAMES.map((name, i) => ({ name, date: addDays(plannerWeekStart, i) }));
    $('#planner-grid').className = 'planner-grid';
    $('#planner-grid').innerHTML = days.map((day) => renderDayCell(day, tasks)).join('');
  }

  attachPlannerEvents();
}

function toggleAddTaskForm(date) {
  const box = document.querySelector(`[data-form-for="${date}"]`);
  if (!box.hidden) { box.hidden = true; return; }
  const itemOptions = plannerCoursesCache
    .map((c) => `<optgroup label="${esc(c.name)}"></optgroup>`)
    .join('');
  box.hidden = false;
  box.innerHTML = `
    <select class="task-course-select"><option value="">— pick a course item —</option></select>
    <div class="or-divider">or</div>
    <input class="task-offline-input" placeholder="Offline task, e.g. Read Ch. 3">
    <button type="button" class="task-save-btn">Add</button>`;

  const courseSelect = box.querySelector('.task-course-select');
  (async () => {
    for (const c of plannerCoursesCache) {
      const detail = await api(`/api/admin/courses/${c.id}`);
      const group = document.createElement('optgroup');
      group.label = c.name;
      for (const u of detail.units) {
        for (const it of u.items) {
          const opt = document.createElement('option');
          opt.value = it.id;
          opt.textContent = `${TYPE_ICON[it.type]} ${it.title}`;
          group.appendChild(opt);
        }
      }
      courseSelect.appendChild(group);
    }
  })();

  box.querySelector('.task-save-btn').addEventListener('click', async () => {
    const itemId = courseSelect.value;
    const title = box.querySelector('.task-offline-input').value.trim();
    if (!itemId && !title) return;
    await api('/api/schedule', {
      method: 'POST',
      body: { studentId: plannerStudentId, date, itemId: itemId || null, title },
    });
    renderPlanner();
  });
}

async function printWeekReport(studentId, start) {
  const r = await api(`/api/week-report/${studentId}?start=${start}`);
  const taskRows = r.tasks
    .map((t) => `<tr><td>${t.date}</td><td>${esc(t.itemTitle || t.offlineTitle)}</td><td>${esc(t.courseName || 'Offline')}</td><td>${t.done ? '✓ done' : '—'}</td></tr>`)
    .join('');
  const gradedRows = r.graded
    .map((g) => `<tr><td>${esc(g.itemTitle)}</td><td>${esc(g.courseName)}</td><td>${g.score}/${g.points_possible}</td></tr>`)
    .join('');
  const spellingRows = r.spellingTests
    .map((t) => `<tr><td>${esc(t.list)}</td><td>${t.score}/${t.total}</td></tr>`)
    .join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Weekly Report</title>
    <style>
      body { font-family: Georgia, serif; max-width: 640px; margin: 2rem auto; color: #222; }
      h1 { font-size: 1.4rem; border-bottom: 2px solid #222; padding-bottom: 0.4rem; }
      h2 { font-size: 1.1rem; margin-top: 1.5rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
      td, th { border: 1px solid #999; padding: 0.4rem 0.6rem; text-align: left; }
    </style></head><body>
    <h1>Weekly Report — ${esc(r.student)}</h1>
    <p>Week of ${r.start}</p>
    <h2>Schedule</h2>
    <table><tr><th>Date</th><th>Task</th><th>Course</th><th>Status</th></tr>${taskRows || '<tr><td colspan="4">Nothing scheduled</td></tr>'}</table>
    <h2>Graded work</h2>
    <table><tr><th>Item</th><th>Course</th><th>Score</th></tr>${gradedRows || '<tr><td colspan="3">Nothing graded this week</td></tr>'}</table>
    <h2>Spelling tests</h2>
    <table><tr><th>List</th><th>Score</th></tr>${spellingRows || '<tr><td colspan="2">No spelling tests this week</td></tr>'}</table>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

async function printMonthReport(studentId, monthMonday, monthRef) {
  const month = new Date(monthRef + 'T00:00:00').getMonth();
  const weeks = [];
  let cursor = monthMonday;
  for (let w = 0; w < 6; w++) {
    const weekDays = DAY_NAMES.map((name, i) => ({ name, date: addDays(cursor, i) }));
    const fridayMonth = new Date(weekDays[4].date + 'T00:00:00').getMonth();
    const mondayMonth = new Date(weekDays[0].date + 'T00:00:00').getMonth();
    if (w > 0 && mondayMonth !== month && fridayMonth !== month) break;
    weeks.push(weekDays);
    cursor = addDays(cursor, 7);
  }
  const rangeStart = weeks[0][0].date;
  const rangeEnd = weeks[weeks.length - 1][4].date;
  const student = (await api('/api/students')).find((s) => s.id === studentId);
  const { tasks } = await api(`/api/schedule-range/${studentId}?start=${rangeStart}&end=${rangeEnd}`);

  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const calRows = weeks.map((week) =>
    `<tr>${week.map((day) => {
      const dayTasks = tasks.filter((t) => t.date === day.date);
      const items = dayTasks.map((t) => `<div class="cell-task${t.done ? ' done' : ''}">${t.itemTitle || t.offlineTitle}</div>`).join('');
      return `<td><div class="date-num">${day.date.slice(5)}</div>${items || ''}</td>`;
    }).join('')}</tr>`
  ).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${monthLabel(monthRef)} — ${student?.name || ''}</title>
  <style>
    body { font-family: Georgia, serif; margin: 1.5cm; color: #222; }
    h1 { font-size: 1.4rem; border-bottom: 2px solid #222; padding-bottom: .4rem; margin-bottom: .75rem; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; padding: .4rem; font-size: .85rem; border: 1px solid #bbb; }
    td { vertical-align: top; border: 1px solid #bbb; padding: .4rem; min-height: 3.5rem; width: 20%; }
    .date-num { font-size: .75rem; color: #888; font-weight: 700; margin-bottom: .25rem; }
    .cell-task { font-size: .78rem; margin: .1rem 0; padding: .1rem .3rem; background: #e8f0ff; border-radius: 3px; }
    .cell-task.done { background: #e8f7ee; text-decoration: line-through; color: #666; }
    @media print { @page { size: landscape; margin: 1cm; } }
  </style></head><body>
  <h1>${monthLabel(monthRef)} — ${esc(student?.name || '')}</h1>
  <table><tr>${DAY_SHORT.map((d) => `<th>${d}</th>`).join('')}</tr>${calRows}</table>
  <script>window.print()<\/script></body></html>`);
  win.document.close();
}

async function printCourse(courseId) {
  const course = await api(`/api/admin/courses/${courseId}`);

  function renderItemBody(it) {
    let html = '';
    if (it.body) {
      html += `<div class="item-body">${it.body.split(/\n\n+/).map((p) => `<p>${esc(p.trim())}</p>`).join('')}</div>`;
    }
    if (it.type === 'quiz' && it.questions?.length) {
      html += `<ol class="quiz-qs">${it.questions.map((q, i) => {
        const choices = q.choices?.length
          ? `<ul>${q.choices.map((c) => `<li>${esc(c)}${q.correct_answer === c ? ' ✓' : ''}</li>`).join('')}</ul>`
          : '';
        return `<li><strong>${esc(q.prompt)}</strong>${choices}</li>`;
      }).join('')}</ol>`;
    }
    return html;
  }

  const unitBlocks = course.units.map((u) => {
    const items = u.items.map((it) => `
      <div class="item-block">
        <div class="item-header">${TYPE_ICON[it.type] || ''} <strong>${esc(it.title)}</strong> <span class="item-type">${TYPE_LABEL[it.type] || ''}</span>${it.points ? ` <span class="item-pts">${it.points} pts</span>` : ''}</div>
        ${renderItemBody(it)}
      </div>`).join('');
    return `<div class="unit-block"><h2>${esc(u.name)}</h2>${items || '<p class="empty">No items.</p>'}</div>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${esc(course.name)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 740px; margin: 2rem auto; color: #222; font-size: .95rem; }
    h1 { font-size: 1.6rem; border-bottom: 3px solid #222; padding-bottom: .4rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.1rem; background: #eee; padding: .4rem .7rem; border-radius: 4px; margin: 1.5rem 0 .5rem; }
    .unit-block { margin-bottom: 1rem; }
    .item-block { border-left: 3px solid #ccc; padding: .5rem .75rem; margin-bottom: .75rem; }
    .item-header { font-size: 1rem; margin-bottom: .3rem; }
    .item-type { color: #666; font-size: .85rem; font-style: italic; }
    .item-pts { color: #888; font-size: .8rem; margin-left: .4rem; }
    .item-body p { margin: .3rem 0; line-height: 1.5; }
    .quiz-qs { margin: .4rem 0 0 1.2rem; }
    .quiz-qs li { margin: .4rem 0; }
    .quiz-qs ul { margin: .2rem 0 .2rem 1rem; list-style: lower-alpha; }
    .empty { color: #888; font-style: italic; }
    @media print { body { margin: 1cm; } h2 { break-after: avoid; } .item-block { break-inside: avoid; } }
  </style></head><body>
  <h1>${esc(course.name)}${course.subject ? ` <small style="font-size:.75em;color:#666">— ${esc(course.subject)}</small>` : ''}</h1>
  ${unitBlocks || '<p>No units in this course.</p>'}
  <script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ============================================================
// Grading queue
// ============================================================

$('#evidence-lightbox-close').addEventListener('click', () => { $('#evidence-lightbox').hidden = true; });

function showEvidenceLightbox(notes, photo) {
  let html = '';
  if (photo) html += `<img src="${photo}" style="max-width:100%;border-radius:8px;margin-bottom:.75rem">`;
  if (notes) html += `<p style="white-space:pre-wrap">${esc(notes)}</p>`;
  $('#evidence-lightbox-body').innerHTML = html || '<p class="hint">No evidence content.</p>';
  $('#evidence-lightbox').hidden = false;
}

const STUDENT_NOTE_LABEL = { needs_help: '🙋 Needs help', not_sure: '🤔 Not sure' };

async function loadGrading() {
  const rows = await api('/api/grading-queue');
  $('#grading-empty').hidden = rows.length > 0;
  $('#grading-rows').innerHTML = rows
    .map((r) => {
      const hasEvidence = r.evidence_notes || r.evidence_photo;
      const noteTag = r.student_note ? `<span class="badge-tag">${STUDENT_NOTE_LABEL[r.student_note] || r.student_note}</span>` : '';
      const evidenceBtn = hasEvidence
        ? `<button class="secondary small" data-evidence-notes="${esc(r.evidence_notes || '')}" data-evidence-photo="${r.evidence_photo ? 'yes' : ''}" data-sub-id="${r.submissionId}">📎 Evidence</button>`
        : '';
      return `<div class="grading-card">
        <div class="grading-header">
          <span>${esc(r.emoji)}</span>
          <strong>${esc(r.studentName)}</strong>
          <span class="grow">${esc(r.itemTitle)}</span>
          <span class="hint">${esc(r.courseName)} · ${esc(r.unitName)}</span>
          ${noteTag}
        </div>
        ${evidenceBtn}
        <div class="grading-footer">
          <input type="number" class="grade-input" min="0" max="${r.points_possible}" placeholder="Score / ${r.points_possible || '?'}" data-sub="${r.submissionId}">
          <input type="text" class="comment-input" placeholder="Parent comment (optional)" data-comment-sub="${r.submissionId}">
          <button data-save-grade="${r.submissionId}">Save grade</button>
        </div>
      </div>`;
    })
    .join('');

  document.querySelectorAll('[data-evidence-notes]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // photo may be truncated in the attribute — fetch full evidence via API
      const subId = btn.dataset.subId;
      let photo = null;
      if (btn.dataset.evidencePhoto === 'yes') {
        const full = await fetch(`/api/grading-queue/${subId}/evidence`, { headers: { 'x-pin': parentPin } });
        if (full.ok) { const d = await full.json(); photo = d.evidence_photo; }
      }
      showEvidenceLightbox(btn.dataset.evidenceNotes || null, photo);
    });
  });

  document.querySelectorAll('[data-save-grade]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = document.querySelector(`.grade-input[data-sub="${btn.dataset.saveGrade}"]`);
      const commentInput = document.querySelector(`.comment-input[data-comment-sub="${btn.dataset.saveGrade}"]`);
      if (input.value === '') return;
      await api(`/api/submissions/${btn.dataset.saveGrade}/grade`, {
        method: 'PUT',
        body: { score: Number(input.value), parentComment: commentInput?.value || '' },
      });
      loadGrading();
      loadGradingBadge();
    });
  });
}

// ============================================================
// Gradebook
// ============================================================

let gradebookCourseId = null;

async function loadGradebookPanel() {
  const courses = await api('/api/admin/courses');
  $('#gradebook-course').innerHTML = courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if (courses.length) renderGradebook(courses[0].id);
}
$('#gradebook-course').addEventListener('change', () => renderGradebook($('#gradebook-course').value));
$('#gradebook-csv-btn').addEventListener('click', () => {
  if (!gradebookCourseId) return;
  window.location.href = `/api/gradebook/${gradebookCourseId}/csv`;
});
$('#history-modal-close').addEventListener('click', () => { $('#history-modal').hidden = true; });

async function showHistory(studentId, itemId, label) {
  const { history } = await api(`/api/items/${itemId}/history?studentId=${studentId}`);
  $('#history-modal-title').textContent = `Attempts: ${label}`;
  if (!history.length) {
    $('#history-modal-body').innerHTML = `<p class="hint">No recorded attempts yet.</p>`;
  } else {
    const rows = history.map((h) => {
      const pct = h.points_possible ? Math.round((h.score / h.points_possible) * 100) : null;
      const cls = pct !== null ? (pct >= 80 ? 'score-good' : 'score-bad') : '';
      return `<tr><td>${new Date(h.completed_at + 'Z').toLocaleString()}</td><td class="${cls}">${h.score}/${h.points_possible}${pct !== null ? ` (${pct}%)` : ''}</td></tr>`;
    }).join('');
    $('#history-modal-body').innerHTML = `<table class="results"><tr><th>Date</th><th>Score</th></tr>${rows}</table>`;
  }
  $('#history-modal').hidden = false;
}

async function renderGradebook(courseId) {
  gradebookCourseId = courseId || null;
  if (!courseId) return ($('#gradebook-table').innerHTML = '');
  const gb = await api(`/api/gradebook/${courseId}`);
  if (gb.gradableItems.length === 0 || gb.students.length === 0) {
    $('#gradebook-table').innerHTML = `<p class="hint">Need at least one enrolled kid and one graded item (assignment, quiz, or spelling test) to show a gradebook.</p>`;
    return;
  }
  const header = gb.gradableItems.map((it) => {
    const due = it.due_date ? `<br><small class="hint">due ${it.due_date}</small>` : '';
    return `<th>${esc(it.title)}<br><small>${it.points} pts</small>${due}</th>`;
  }).join('');
  const rows = gb.students
    .map((s) => {
      const cells = gb.gradableItems
        .map((it) => {
          const sc = s.scores[it.id];
          const overdueClass = sc?.overdue ? ' overdue' : '';
          if (!sc || (!sc.status && !sc.overdue)) return `<td class="hint">—</td>`;
          if (sc.overdue && !sc.status) return `<td class="hint overdue" title="Overdue">⚠️</td>`;
          if (sc.status !== 'graded') return `<td class="hint${overdueClass}">${sc.overdue ? '⚠️ ' : ''}⏳</td>`;
          return `<td class="${sc.score / sc.points_possible >= 0.8 ? 'score-good' : 'score-bad'}${overdueClass}" style="cursor:pointer" data-history-student="${s.id}" data-history-item="${it.id}" data-history-label="${esc(it.title)} — ${esc(s.name)}">${sc.score}/${sc.points_possible}</td>`;
        })
        .join('');
      const pctClass = s.percent === null ? '' : s.percent >= 80 ? 'score-good' : 'score-bad';
      return `<tr><td>${esc(s.emoji)} ${esc(s.name)}</td>${cells}<td class="${pctClass}">${s.percent === null ? '—' : s.percent + '%'}</td></tr>`;
    })
    .join('');
  $('#gradebook-table').innerHTML = `<table class="results"><tr><th>Kid</th>${header}<th>Overall</th></tr>${rows}</table>`;

  document.querySelectorAll('[data-history-student]').forEach((td) =>
    td.addEventListener('click', () => showHistory(td.dataset.historyStudent, td.dataset.historyItem, td.dataset.historyLabel))
  );
}

// ============================================================
// Spelling (word lists + weekly assignment + results)
// ============================================================

async function loadSpelling() {
  const [overview, lists] = await Promise.all([api('/api/overview'), api('/api/lists')]);
  cachedLists = lists;
  renderAssignRows(overview.students);
  renderLists(lists);
  renderResults(overview.students);
}

function renderAssignRows(students) {
  const options = (sel) =>
    `<option value="">— no list —</option>` +
    cachedLists.map((l) => `<option value="${l.id}" ${sel === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  $('#assign-rows').innerHTML = students.length
    ? students
        .map(
          (s) => `<div class="item-row">
            <span>${esc(s.emoji)}</span>
            <strong class="grow">${esc(s.name)}</strong>
            <span>🌟 ${s.mastered} mastered</span>
            <label>This week: <select data-assign="${s.id}">${options(s.assignment?.id)}</select></label>
          </div>`
        )
        .join('')
    : `<p class="hint">No kids yet.</p>`;

  document.querySelectorAll('[data-assign]').forEach((sel) =>
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      await api('/api/assign', { method: 'POST', body: { studentId: Number(sel.dataset.assign), listId: Number(sel.value) } });
      msg('List assigned.');
      loadSpelling();
    })
  );
}

function renderLists(lists) {
  $('#list-rows').innerHTML = lists
    .map(
      (l) => `<div class="item-row">
        <strong class="grow">${esc(l.name)}</strong>
        <span>${l.wordCount} words${l.builtin ? ' · built-in' : ''}</span>
        <button class="secondary small" data-print-list="${l.id}">🖨 Worksheet</button>
        <button data-edit-list="${l.id}">${l.builtin ? 'Copy & edit' : 'Edit'}</button>
        ${l.builtin ? '' : `<button class="danger" data-del-list="${l.id}">Delete</button>`}
      </div>`
    )
    .join('');

  document.querySelectorAll('[data-print-list]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const list = await api(`/api/lists/${btn.dataset.printList}`);
      printSpellingWorksheet(list.name, list.words);
    })
  );

  document.querySelectorAll('[data-edit-list]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const list = await api(`/api/lists/${btn.dataset.editList}`);
      $('#list-id').value = list.builtin ? '' : list.id;
      $('#list-name').value = list.builtin ? `${list.name} (copy)` : list.name;
      $('#list-words').value = list.words.map((w) => {
        if (w.definition) return `${w.word} | ${w.sentence} | ${w.definition}`;
        if (w.sentence) return `${w.word} | ${w.sentence}`;
        return w.word;
      }).join('\n');
      $('#list-editor-title').textContent = list.builtin ? 'New list (from copy)' : `Editing: ${list.name}`;
      $('#list-editor-details').open = true;
      $('#list-name').scrollIntoView({ behavior: 'smooth' });
    })
  );
  document.querySelectorAll('[data-del-list]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this list?')) return;
      await api(`/api/lists/${btn.dataset.delList}`, { method: 'DELETE' });
      loadSpelling();
    })
  );
}

$('#list-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#list-name').value.trim();
  const words = $('#list-words').value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [word, sentence = '', definition = ''] = line.split('|').map((p) => p.trim());
      return { word, sentence, definition };
    });
  if (!name || words.length === 0) return msg('Give the list a name and at least one word.');
  const id = $('#list-id').value;
  if (id) await api(`/api/lists/${id}`, { method: 'PUT', body: { name, words } });
  else await api('/api/lists', { method: 'POST', body: { name, words } });
  clearListForm();
  msg('List saved.');
  loadSpelling();
});
$('#list-cancel').addEventListener('click', clearListForm);
function clearListForm() {
  $('#list-id').value = '';
  $('#list-name').value = '';
  $('#list-words').value = '';
  $('#list-editor-title').textContent = 'New list';
}

function renderResults(students) {
  $('#results-area').innerHTML = students
    .map((s) => {
      if (s.tests.length === 0) return `<div class="results-student"><h3>${esc(s.emoji)} ${esc(s.name)}</h3><p class="hint">No tests yet.</p></div>`;
      const rows = s.tests
        .map((t) => {
          const pct = Math.round((t.score / t.total) * 100);
          return `<tr>
            <td>${new Date(t.at + 'Z').toLocaleDateString()}</td>
            <td>${esc(t.list)}</td>
            <td class="${pct >= 80 ? 'score-good' : 'score-bad'}">${t.score}/${t.total} (${pct}%)</td>
            <td><button data-print="${t.id}">🖨 Print</button></td>
          </tr>`;
        })
        .join('');
      return `<div class="results-student"><h3>${esc(s.emoji)} ${esc(s.name)}</h3>
        <table class="results"><tr><th>Date</th><th>List</th><th>Score</th><th></th></tr>${rows}</table></div>`;
    })
    .join('');

  document.querySelectorAll('[data-print]').forEach((btn) => btn.addEventListener('click', () => printSpellingReport(btn.dataset.print)));
}

function printSpellingWorksheet(name, words) {
  const rows = words
    .map((w) => {
      const sentence = w.sentence ? `<div style="color:#888;font-size:.85em;font-style:italic">${esc(w.sentence)}</div>` : '';
      return `<tr>
        <td style="font-weight:700;font-size:1.1em;padding:.6rem .75rem">${esc(w.word)}${sentence}</td>
        <td style="border-bottom:1.5px solid #aaa;width:35%"></td>
        <td style="border-bottom:1.5px solid #aaa;width:35%"></td>
      </tr>`;
    })
    .join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Spelling: ${esc(name)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 680px; margin: 2rem auto; color: #222; }
      h1 { font-size: 1.4rem; border-bottom: 2px solid #222; padding-bottom: .4rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      td { padding: .55rem .75rem; }
      th { text-align: left; color: #555; font-size: .85rem; font-weight: 600; padding: .4rem .75rem; }
    </style></head><body>
    <h1>✏️ Spelling: ${esc(name)}</h1>
    <p style="color:#555;font-size:.9em">Write each word twice — once to practice, once from memory.</p>
    <table>
      <tr><th>Word</th><th>Practice</th><th>From memory</th></tr>
      ${rows}
    </table>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

async function printSpellingReport(testId) {
  const r = await api(`/api/test-report/${testId}`);
  const rows = r.answers
    .map((a) => `<tr><td>${esc(a.word)}</td><td>${a.correct ? '✓ correct' : `✗ wrote "${esc(a.typed)}"`}</td></tr>`)
    .join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Spelling Test Report</title>
    <style>
      body { font-family: Georgia, serif; max-width: 640px; margin: 2rem auto; color: #222; }
      h1 { font-size: 1.4rem; border-bottom: 2px solid #222; padding-bottom: 0.4rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      td, th { border: 1px solid #999; padding: 0.4rem 0.6rem; text-align: left; }
      .meta { margin: 0.75rem 0; line-height: 1.6; }
    </style></head><body>
    <h1>Spelling Test Report</h1>
    <div class="meta">
      <strong>Student:</strong> ${esc(r.student)}<br>
      <strong>Word list:</strong> ${esc(r.list)}<br>
      <strong>Date:</strong> ${new Date(r.at + 'Z').toLocaleDateString()}<br>
      <strong>Score:</strong> ${r.score} / ${r.total} (${Math.round((r.score / r.total) * 100)}%)
    </div>
    <table><tr><th>Word</th><th>Result</th></tr>${rows}</table>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

// ============================================================
// Flashcard decks
// ============================================================

async function loadDecks() {
  const decks = await api('/api/decks');
  cachedDecks = decks;
  $('#deck-rows').innerHTML = decks
    .map(
      (d) => `<div class="item-row">
        <strong class="grow">${esc(d.name)}</strong>
        <span>${d.cardCount} cards${d.builtin ? ' · built-in' : ''}</span>
        <button data-edit-deck="${d.id}">${d.builtin ? 'Copy & edit' : 'Edit'}</button>
        ${d.builtin ? '' : `<button class="danger" data-del-deck="${d.id}">Delete</button>`}
      </div>`
    )
    .join('');

  document.querySelectorAll('[data-edit-deck]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const deck = await api(`/api/decks/${btn.dataset.editDeck}`);
      $('#deck-id').value = deck.builtin ? '' : deck.id;
      $('#deck-name').value = deck.builtin ? `${deck.name} (copy)` : deck.name;
      $('#deck-cards').value = deck.cards.map((c) => `${c.front} | ${c.back}`).join('\n');
      $('#deck-editor-title').textContent = deck.builtin ? 'New deck (from copy)' : `Editing: ${deck.name}`;
      $('#deck-editor-details').open = true;
      $('#deck-name').scrollIntoView({ behavior: 'smooth' });
    })
  );
  document.querySelectorAll('[data-del-deck]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this deck?')) return;
      await api(`/api/decks/${btn.dataset.delDeck}`, { method: 'DELETE' });
      loadDecks();
    })
  );
}

$('#deck-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#deck-name').value.trim();
  const cards = $('#deck-cards').value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [front, back = ''] = line.split('|').map((p) => p.trim());
      return { front, back };
    });
  if (!name || cards.length === 0) return msg('Give the deck a name and at least one card.');
  const id = $('#deck-id').value;
  if (id) await api(`/api/decks/${id}`, { method: 'PUT', body: { name, cards } });
  else await api('/api/decks', { method: 'POST', body: { name, cards } });
  clearDeckForm();
  msg('Deck saved.');
  loadDecks();
});
$('#deck-cancel').addEventListener('click', clearDeckForm);
function clearDeckForm() {
  $('#deck-id').value = '';
  $('#deck-name').value = '';
  $('#deck-cards').value = '';
  $('#deck-editor-title').textContent = 'New deck';
}

// ============================================================
// Settings
// ============================================================

$('#pin-change-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPin = $('#new-pin').value;
  try {
    await api('/api/parent/pin', { method: 'POST', body: { newPin } });
    parentPin = newPin;
    sessionStorage.setItem('pin', newPin);
    $('#new-pin').value = '';
    msg('PIN changed.');
  } catch (err) {
    msg(err.message);
  }
});

// ---------- Scan config (settings panel) ----------

async function loadOllamaConfig() {
  const cfg = await api('/api/admin/scan-config');
  document.querySelector(`input[name="scan_primary"][value="${cfg.primary || 'local'}"]`).checked = true;
  $('#ollama-host').value = cfg.ollama_host || '';
  $('#ollama-model').value = cfg.ollama_model || '';
  $('#ollama-test-result').textContent = '';
  $('#ollama-cloud-model').value = cfg.ollama_cloud_model || '';
  $('#ollama-cloud-api-key').value = '';
  $('#ollama-cloud-key-status').textContent = cfg.ollama_cloud_has_key ? '🔑 Key saved' : 'No key saved';
}

$('#scan-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const primary = document.querySelector('input[name="scan_primary"]:checked')?.value || 'local';
  const body = {
    primary,
    ollama_host: $('#ollama-host').value.trim(),
    ollama_model: $('#ollama-model').value.trim(),
    ollama_cloud_model: $('#ollama-cloud-model').value.trim(),
  };
  const ollamaCloudKey = $('#ollama-cloud-api-key').value.trim();
  if (ollamaCloudKey) body.ollama_cloud_api_key = ollamaCloudKey;
  await api('/api/admin/scan-config', { method: 'POST', body });
  if (ollamaCloudKey) { $('#ollama-cloud-api-key').value = ''; $('#ollama-cloud-key-status').textContent = '🔑 Key saved'; }
  msg('Scan settings saved.');
});

$('#ollama-test-btn').addEventListener('click', async () => {
  $('#ollama-test-result').textContent = 'Testing…';
  const r = await api('/api/admin/ollama-test', { method: 'POST' });
  if (r.reachable && r.hasModel) {
    $('#ollama-test-result').textContent = `✅ Connected — "${esc($('#ollama-model').value)}" is available.`;
  } else if (r.reachable) {
    $('#ollama-test-result').textContent =
      `⚠️ Connected but "${esc($('#ollama-model').value)}" isn't pulled. Available: ${esc(r.availableModels.join(', ') || '(none)')}. Run: ollama pull ${esc($('#ollama-model').value)}`;
  } else {
    $('#ollama-test-result').textContent = `❌ ${esc(r.error)}`;
  }
});
