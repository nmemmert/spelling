// ---------- tiny helpers ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

sessionStorage.removeItem('pin');
let parentPin = null;
const appSettings = { schoolName: '', passingPct: 80, weekStartDay: 'monday' };

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

let _toastTimer = null;
function msg(text, type = 'success') {
  const el = $('#toast');
  el.textContent = text;
  el.className = type === 'error' ? 'toast-error' : '';
  el.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => { el.hidden = true; el.classList.remove('toast-out'); }, 400);
  }, 3000);
}

const TYPE_ICON = {
  lesson: '📖', assignment: '📝', quiz: '❓', matching: '🔤', crossword: '⬛',
  spelling_practice: '✏️', spelling_test: '⭐', flashcards: '🗂️', worksheet: '📋',
};
const TYPE_LABEL = {
  lesson: 'Lesson', assignment: 'Assignment', quiz: 'Quiz', matching: 'Matching', crossword: 'Crossword',
  spelling_practice: 'Spelling Practice', spelling_test: 'Spelling Test', flashcards: 'Flashcards',
  worksheet: 'Worksheet',
};

// ---------- PIN gate ----------

$('#pin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $('#pin-input').value;
  const { ok } = await api('/api/parent/verify', { method: 'POST', body: { pin } });
  if (!ok) return ($('#pin-error').hidden = false);
  parentPin = pin;
  $('#pin-error').hidden = true;
  unlock();
});

async function loadAppSettings() {
  try {
    const s = await api('/api/admin/app-settings');
    appSettings.schoolName = s.school_name || '';
    appSettings.passingPct = Number(s.passing_pct) || 80;
    appSettings.weekStartDay = s.week_start_day || 'monday';
  } catch {}
}

async function unlock() {
  await loadAppSettings();
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
    settings: loadSettings,
  };
  if (loaders[name]) loaders[name]();
  if (name === 'course-detail') openCourseDetail(currentCourseId);
}

// ============================================================
// Kids
// ============================================================

const THEME_COLORS = { blue: '#4f86f7', green: '#2e9e5b', purple: '#7c5cbf', orange: '#e8802a', pink: '#d45d8a', red: '#e84040', teal: '#20a8a0', yellow: '#c8960c', indigo: '#5b6abf' };

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
      msg('Kid removed.');
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
  msg('Kid added.');
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

// ---------- import course — tab switching ----------
function setImportTab(tab) {
  $('#import-tab-json').hidden = tab !== 'json';
  $('#import-tab-docx').hidden = tab !== 'docx';
  document.querySelectorAll('.import-tab-btn').forEach((b) => {
    b.classList.toggle('secondary', b.dataset.tab !== tab);
  });
}
setImportTab('json');
document.querySelectorAll('.import-tab-btn').forEach((b) =>
  b.addEventListener('click', () => setImportTab(b.dataset.tab))
);

// ---------- import course — JSON ----------
$('#import-course-browse').addEventListener('click', () => $('#import-course-file').click());
$('#import-course-file').addEventListener('change', () => {
  const f = $('#import-course-file').files[0];
  $('#import-course-filename').textContent = f ? f.name : '';
  $('#import-course-go').disabled = !f;
  $('#import-course-status').textContent = '';
});
$('#import-course-go').addEventListener('click', async () => {
  const f = $('#import-course-file').files[0];
  if (!f) return;
  $('#import-course-status').textContent = 'Importing…';
  let bundle;
  try {
    bundle = JSON.parse(await f.text());
  } catch {
    $('#import-course-status').textContent = 'Could not parse JSON file.';
    return;
  }
  let res;
  try {
    res = await api('/api/admin/import-course', { method: 'POST', body: bundle });
  } catch (err) {
    $('#import-course-status').textContent = `Error: ${err.message}`;
    return;
  }
  $('#import-course-file').value = '';
  $('#import-course-filename').textContent = '';
  $('#import-course-go').disabled = true;
  $('#import-course-status').textContent = '';
  currentCourseId = res.id;
  msg('Course imported.');
  showPanel('course-detail');
});

// ---------- import course — Word docx ----------
$('#import-docx-browse').addEventListener('click', () => $('#import-docx-files').click());
$('#import-docx-files').addEventListener('change', () => {
  const files = [...$('#import-docx-files').files];
  if (files.length) {
    $('#import-docx-filenames').textContent =
      files.length === 1 ? files[0].name : `${files.length} files selected`;
  } else {
    $('#import-docx-filenames').textContent = '';
  }
  $('#import-docx-go').disabled = files.length === 0;
  $('#import-course-status').textContent = '';
});
$('#import-docx-go').addEventListener('click', async () => {
  const name = $('#import-docx-name').value.trim();
  if (!name) { $('#import-course-status').textContent = 'Enter a course name first.'; return; }
  const files = [...$('#import-docx-files').files];
  if (!files.length) return;

  $('#import-course-status').textContent = `Parsing ${files.length} file${files.length > 1 ? 's' : ''}…`;

  const fd = new FormData();
  fd.append('name', name);
  fd.append('subject', $('#import-docx-subject').value.trim());
  fd.append('color', $('#import-docx-color').value);
  files.forEach((f) => fd.append('files', f));

  let data;
  try {
    const res = await fetch('/api/admin/import-course-docx', {
      method: 'POST',
      headers: { 'x-pin': parentPin },
      body: fd,
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');
  } catch (err) {
    $('#import-course-status').textContent = `Error: ${err.message}`;
    return;
  }

  $('#import-docx-files').value = '';
  $('#import-docx-filenames').textContent = '';
  $('#import-docx-go').disabled = true;
  $('#import-docx-name').value = '';
  $('#import-docx-subject').value = '';
  $('#import-course-status').textContent = '';
  currentCourseId = data.id;
  msg('Course imported from Word documents.');
  showPanel('course-detail');
});

async function openCourseDetail(id) {
  if (!id) return showPanel('courses');

  // Preserve unit open/collapsed states and scroll position before re-rendering
  const existingBlocks = document.querySelectorAll('#cd-units .unit-block');
  const savedOpen = Array.from(existingBlocks).map((b) => b.classList.contains('open'));
  const panelVisible = !document.getElementById('panel-course-detail').hidden;
  const savedScroll = panelVisible && existingBlocks.length ? window.scrollY : 0;
  const sameCoursePrev = existingBlocks.length > 0 && id === currentCourseId;

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
      (u, uIdx) => `<div class="unit-block open">
        <div class="unit-toggle">
          <div class="unit-toggle-left">
            <span class="unit-num-badge">Unit ${uIdx + 1}</span>
            <span class="unit-title-text">${esc(u.name)}</span>
          </div>
          <div class="unit-toggle-right">
            <span class="unit-item-count">${u.items.length} item${u.items.length !== 1 ? 's' : ''}</span>
            <span class="unit-chevron" aria-hidden="true">▾</span>
            <button class="danger small" data-del-unit="${u.id}">Delete unit</button>
          </div>
        </div>
        <div class="unit-items-list">
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
        </div>
      </div>`
    )
    .join('') || `<p class="hint">No units yet — add one below.</p>`;

  document.querySelectorAll('#cd-units .unit-toggle').forEach((hdr) => {
    hdr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const block = hdr.closest('.unit-block');
      block.classList.toggle('open');
    });
  });

  document.querySelectorAll('[data-del-unit]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this unit and everything in it?')) return;
      await api(`/api/units/${btn.dataset.delUnit}`, { method: 'DELETE' });
      msg('Unit deleted.');
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

  // Restore which units were open and the scroll position
  if (sameCoursePrev && savedOpen.length) {
    document.querySelectorAll('#cd-units .unit-block').forEach((block, i) => {
      if (i < savedOpen.length) {
        block.classList.toggle('open', savedOpen[i]);
        const btn = block.querySelector('.unit-toggle');
        if (btn) btn.setAttribute('aria-expanded', String(savedOpen[i]));
      }
    });
  }
  if (savedScroll > 0) requestAnimationFrame(() => window.scrollTo(0, savedScroll));

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

$('#cd-duplicate').addEventListener('click', async () => {
  const { id } = await api(`/api/courses/${currentCourseId}/duplicate`, { method: 'POST' });
  currentCourseId = id;
  showPanel('course-detail');
  msg('Course duplicated — update the name and details below.');
});

$('#cd-export').addEventListener('click', async () => {
  const res = await fetch(`/api/admin/courses/${currentCourseId}/export`, {
    headers: { 'x-pin': parentPin },
  });
  if (!res.ok) { msg('Export failed.'); return; }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const nameMatch = disposition.match(/filename="([^"]+)"/);
  const filename = nameMatch ? nameMatch[1] : 'course.json';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  msg('Course exported.');
});

$('#cd-delete').addEventListener('click', async () => {
  if (!confirm('Delete this whole course, including all units, items, and grades?')) return;
  await api(`/api/courses/${currentCourseId}`, { method: 'DELETE' });
  msg('Course deleted.');
  currentCourseId = null;
  showPanel('courses');
});

$('#add-unit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#new-unit-name').value.trim();
  if (!name) return;
  await api('/api/units', { method: 'POST', body: { courseId: currentCourseId, name } });
  $('#new-unit-name').value = '';
  msg('Unit added.');
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
  $('#ie-pairs').innerHTML = '';
  pairCount = 0;
  $('#ie-across-clues').innerHTML = '';
  $('#ie-down-clues').innerHTML = '';
  $('#ie-crossword-preview').innerHTML = '';
  $('#ie-crossword-status').textContent = '';
  currentCrosswordData = null;

  if (itemId) {
    const item = await api(`/api/admin/items/${itemId}`);
    $('#ie-heading').textContent = `Edit: ${item.title}`;
    $('#ie-type').value = item.type;
    $('#ie-title').value = item.title;
    $('#ie-body-lesson').innerHTML = item.body || '';
    $('#ie-body-assignment').innerHTML = item.body || '';
    $('#ie-points').value = item.points || 100;
    $('#ie-due-date').value = item.due_date || '';
    $('#ie-allow-retakes').checked = !!item.allow_retakes;
    $('#ie-prereq').value = item.prereq_item_id || '';
    $('#ie-evidence-mode').value = item.evidence_mode || 'none';
    $('#ie-retake-policy').value = item.retake_policy || 'latest';
    if (item.type === 'spelling_practice' || item.type === 'spelling_test') $('#ie-list').value = item.ref_id;
    if (item.type === 'flashcards') $('#ie-deck').value = item.ref_id;
    if (item.type === 'quiz') {
      $('#ie-quiz-instructions').value = item.body || '';
      (item.questions || []).forEach(addQuestionRow);
    }
    if (item.type === 'matching') {
      $('#ie-matching-instructions').value = item.body || '';
      $('#ie-pairs').innerHTML = '';
      pairCount = 0;
      (item.questions || []).forEach(addMatchingRow);
    }
    if (item.type === 'crossword' && item.crosswordData) {
      currentCrosswordData = item.crosswordData;
      (item.crosswordData.across || []).forEach(w => addCrosswordClueRow('across', { word: w.answer, clue: w.clue }));
      (item.crosswordData.down || []).forEach(w => addCrosswordClueRow('down', { word: w.answer, clue: w.clue }));
      renderCrosswordPreview(item.crosswordData);
      $('#ie-crossword-status').textContent = `${item.crosswordData.placed || ''} words placed`;
    }
    if (item.type === 'worksheet' && item.worksheetData) {
      currentWorksheetData = item.worksheetData;
      renderWorksheetEditor(item.worksheetData);
    }
    $('#ie-delete').hidden = false;
    $('#ie-delete').onclick = async () => {
      if (!confirm('Delete this item and any grades for it?')) return;
      await api(`/api/items/${itemId}`, { method: 'DELETE' });
      msg('Item deleted.');
      showPanel('course-detail');
    };
  } else {
    $('#ie-heading').textContent = 'New item';
    $('#ie-type').value = 'lesson';
    $('#ie-title').value = '';
    $('#ie-body-lesson').innerHTML = '';
    $('#ie-body-assignment').innerHTML = '';
    $('#ie-quiz-instructions').value = '';
    $('#ie-matching-instructions').value = '';
    currentCrosswordData = null;
    currentWorksheetData = null;
    $('#ie-ws-paste').value = '';
    $('#ie-ws-editor').innerHTML = '';
    $('#ie-ws-parse-status').hidden = true;
    $('#ie-points').value = 100;
    $('#ie-due-date').value = '';
    $('#ie-allow-retakes').checked = false;
    $('#ie-prereq').value = '';
    $('#ie-evidence-mode').value = 'none';
    $('#ie-retake-policy').value = 'latest';
    $('#ie-delete').hidden = true;
  }
  updateItemFieldVisibility();
  resetImportSection();
  showPanel('item-editor');
}

function updateItemFieldVisibility() {
  const type = $('#ie-type').value;
  $('#ie-field-lesson').hidden = type !== 'lesson';
  $('#ie-field-assignment').hidden = type !== 'assignment';
  $('#ie-field-quiz').hidden = type !== 'quiz';
  $('#ie-field-matching').hidden = type !== 'matching';
  $('#ie-field-crossword').hidden = type !== 'crossword';
  $('#ie-field-spelling').hidden = type !== 'spelling_practice' && type !== 'spelling_test';
  $('#ie-field-flashcards').hidden = type !== 'flashcards';
  $('#ie-field-worksheet').hidden = type !== 'worksheet';
  $('#ie-import-section').hidden = type === 'spelling_practice' || type === 'spelling_test'
    || type === 'flashcards' || type === 'worksheet';
}
$('#ie-type').addEventListener('change', updateItemFieldVisibility);

// ---------- rich text editor (lesson body) ----------

function getRteBody(el) {
  const html = el.innerHTML.trim();
  return html === '<br>' ? '' : html;
}
function getLessonBody() { return getRteBody($('#ie-body-lesson')); }
function getAssignmentBody() { return getRteBody($('#ie-body-assignment')); }

// Format buttons — mousedown+preventDefault keeps focus/selection in the editor
document.querySelectorAll('.rte-btn[data-cmd]').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const editor = btn.closest('.rte-group').querySelector('.rte-editor');
    editor.focus();
    document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
  });
});

// Link buttons
document.querySelectorAll('.rte-link-btn').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const editor = btn.closest('.rte-group').querySelector('.rte-editor');
    editor.focus();
    const sel = window.getSelection();
    const savedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    const url = prompt('Enter URL (e.g. https://example.com):');
    if (url) {
      editor.focus();
      if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
      document.execCommand('createLink', false, url);
    }
  });
});

// YouTube embed buttons
document.querySelectorAll('.rte-youtube-btn').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const editor = btn.closest('.rte-group').querySelector('.rte-editor');
    editor.focus();
    const sel = window.getSelection();
    const savedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    const input = prompt('YouTube URL or video ID:');
    if (!input) return;
    const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=))([a-zA-Z0-9_-]{11})/);
    const id = match ? match[1] : input.trim();
    if (id) {
      editor.focus();
      if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
      document.execCommand('insertHTML', false,
        `<br><iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen style="max-width:100%;border-radius:10px"></iframe><br>`
      );
    }
  });
});

function resetImportSection() {
  $('#import-local-input').value = '';
  $('#import-local-name').textContent = '';
  $('#import-go-btn').disabled = true;
  $('#import-status').textContent = '';
}

// ---------- import from local .docx file ----------

$('#import-browse-btn').addEventListener('click', () => $('#import-local-input').click());

$('#import-local-input').addEventListener('change', () => {
  const file = $('#import-local-input').files[0];
  $('#import-local-name').textContent = file ? file.name : '';
  $('#import-go-btn').disabled = !file;
  $('#import-status').textContent = '';
});

$('#import-go-btn').addEventListener('click', async () => {
  const file = $('#import-local-input').files[0];
  if (!file) return;
  const type = $('#ie-type').value;
  $('#import-go-btn').disabled = true;
  $('#import-status').textContent = '📤 Uploading…';
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
    }
    const base64 = btoa(binary);
    const result = await api('/api/admin/upload-attachment', {
      method: 'POST',
      body: { base64, originalName: file.name },
    });
    const downloadLink = `<p><a href="${result.url}" download="${result.originalName}">⬇️ ${result.originalName}</a></p>`;
    const content = result.htmlBody
      ? downloadLink + result.htmlBody
      : `<p><a href="${result.url}" target="_blank">📄 ${result.originalName}</a></p>`;
    const editor = type === 'assignment' ? $('#ie-body-assignment') : $('#ie-body-lesson');
    editor.innerHTML += content;
    $('#import-status').textContent = '✅ Imported — content is now editable above.';
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

let pairCount = 0;
function addMatchingRow(pair = {}) {
  const n = pairCount++;
  const div = document.createElement('div');
  div.className = 'matching-pair-row';
  div.innerHTML = `
    <input class="pair-word" placeholder="Word / term" value="${esc(pair.correct_answer || pair.word || '')}">
    <input class="pair-clue" placeholder="Clue / definition" value="${esc(pair.prompt || pair.clue || '')}">
    <button type="button" class="danger small pair-remove">✕</button>`;
  div.querySelector('.pair-remove').addEventListener('click', () => div.remove());
  $('#ie-pairs').appendChild(div);
}
$('#ie-add-pair').addEventListener('click', () => addMatchingRow());

// ---------- crossword editor ----------

let currentCrosswordData = null;

function addCrosswordClueRow(dir, entry = {}) {
  const container = dir === 'across' ? $('#ie-across-clues') : $('#ie-down-clues');
  const div = document.createElement('div');
  div.className = 'cw-clue-row';
  div.innerHTML = `
    <input class="cw-word" placeholder="ANSWER" value="${esc(entry.word || '')}" style="text-transform:uppercase;width:7rem">
    <input class="cw-clue" placeholder="Clue" value="${esc(entry.clue || '')}" style="flex:1">
    <button type="button" class="danger small cw-remove">✕</button>`;
  div.querySelector('.cw-word').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
  div.querySelector('.cw-remove').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

$('#ie-add-across').addEventListener('click', () => addCrosswordClueRow('across'));
$('#ie-add-down').addEventListener('click', () => addCrosswordClueRow('down'));

function renderCrosswordPreview(cw) {
  const cell = 22;
  const w = cw.cols * cell, h = cw.rows * cell;
  let svg = `<svg width="${w}" height="${h}" style="border:1px solid #ccc;display:block">`;
  for (let r = 0; r < cw.rows; r++) {
    for (let c = 0; c < cw.cols; c++) {
      const x = c * cell, y = r * cell;
      if (cw.grid[r][c] === null) {
        svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#222"/>`;
      } else {
        svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#fff" stroke="#999" stroke-width="0.5"/>`;
        if (cw.grid[r][c]) {
          svg += `<text x="${x + cell/2}" y="${y + cell/2 + 5}" text-anchor="middle" font-size="11" font-family="monospace">${esc(cw.grid[r][c])}</text>`;
        }
      }
    }
  }
  // Draw numbers
  const allWords = [...(cw.across||[]), ...(cw.down||[])];
  const nums = {};
  for (const w2 of allWords) if (w2.num) nums[`${w2.row},${w2.col}`] = w2.num;
  for (const [key, n] of Object.entries(nums)) {
    const [r, c] = key.split(',').map(Number);
    svg += `<text x="${c * cell + 1}" y="${r * cell + 8}" font-size="6" font-family="sans-serif" fill="#333">${n}</text>`;
  }
  svg += '</svg>';
  $('#ie-crossword-preview').innerHTML = svg;
}

$('#ie-crossword-generate').addEventListener('click', async () => {
  const across = Array.from($('#ie-across-clues').querySelectorAll('.cw-clue-row')).map(row => ({
    word: row.querySelector('.cw-word').value.trim(),
    clue: row.querySelector('.cw-clue').value.trim(),
  })).filter(e => e.word && e.clue);
  const down = Array.from($('#ie-down-clues').querySelectorAll('.cw-clue-row')).map(row => ({
    word: row.querySelector('.cw-word').value.trim(),
    clue: row.querySelector('.cw-clue').value.trim(),
  })).filter(e => e.word && e.clue);
  if (across.length + down.length < 2) return msg('Add at least 2 words with clues before generating.');
  $('#ie-crossword-status').textContent = '⚡ Generating…';
  try {
    const result = await api('/api/crossword/generate', { method: 'POST', body: { across, down } });
    currentCrosswordData = result;
    renderCrosswordPreview(result);
    const skipped = result.total - result.placed;
    $('#ie-crossword-status').textContent = `✅ ${result.placed} words placed${skipped ? ` (${skipped} couldn't fit — try sharing more letters)` : ''}`;
  } catch (err) {
    $('#ie-crossword-status').textContent = `❌ ${err.message}`;
  }
});

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
    body: type === 'lesson' ? getLessonBody()
        : type === 'assignment' ? getAssignmentBody()
        : type === 'quiz' ? $('#ie-quiz-instructions').value.trim()
        : type === 'matching' ? $('#ie-matching-instructions').value.trim()
        : '',
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
  if (type === 'matching') {
    body.questions = Array.from(document.querySelectorAll('.matching-pair-row')).map((row) => ({
      type: 'match',
      prompt: row.querySelector('.pair-clue').value.trim(),
      correctAnswer: row.querySelector('.pair-word').value.trim(),
      choices: [],
      points: 1,
    })).filter((q) => q.prompt && q.correctAnswer);
  }
  if (type === 'crossword') {
    if (!currentCrosswordData) {
      $('#ie-error').textContent = 'Generate the crossword first.';
      $('#ie-error').hidden = false;
      return;
    }
    body.crosswordData = currentCrosswordData;
  }
  if (type === 'worksheet') {
    const wd = collectWorksheetAnswers();
    if (!wd) {
      $('#ie-error').textContent = 'Parse the worksheet first.';
      $('#ie-error').hidden = false;
      return;
    }
    body.worksheetData = wd;
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
// Worksheet editor
// ============================================================

let currentWorksheetData = null;

function parseWorksheet(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let hasHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Name/Date header line
    if (!hasHeader && /name\s*:/i.test(trimmed)) {
      hasHeader = true;
      continue;
    }

    // Section header: "Part 1 —", "Part 1:", "Section 1 —", etc.
    if (/^(part|section)\s+\d+/i.test(trimmed)) {
      currentSection = { title: trimmed, questions: [] };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      currentSection = { title: '', questions: [] };
      sections.push(currentSection);
    }

    // True/False line: starts with T then whitespace then F
    if (/^T\s+F\b/i.test(trimmed)) {
      const text = trimmed.replace(/^T\s+F\s*/i, '').trim();
      if (text) currentSection.questions.push({ type: 'tf', text, correct: '', points: 1 });
      continue;
    }

    // Strip optional leading number: "1. " or "1) "
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    const num = numMatch ? Number(numMatch[1]) : undefined;
    const content = numMatch ? numMatch[2] : trimmed;

    // Fill-in-the-blank: contains 3+ underscores anywhere
    if (/_{3,}/.test(content)) {
      const template = content.replace(/_{3,}/g, '___');
      const blankCount = (template.match(/___/g) || []).length;
      currentSection.questions.push({
        type: 'fitb',
        num,
        template,
        blanks: Array(blankCount).fill(''),
        points: blankCount,
      });
      continue;
    }

    // Short answer (numbered or plain)
    currentSection.questions.push({ type: 'short', num, text: content, points: 1 });
  }

  // Drop empty sections
  return { hasHeader, sections: sections.filter(s => s.questions.length > 0 || s.title) };
}

function renderWorksheetEditor(wd) {
  const container = $('#ie-ws-editor');
  container.innerHTML = '';

  if (!wd || !wd.sections || wd.sections.length === 0) {
    container.innerHTML = '<p class="hint">No questions parsed yet.</p>';
    return;
  }

  let flatQ = 0; // global question counter for unique radio names
  wd.sections.forEach((section, si) => {
    if (section.title) {
      const h = document.createElement('h3');
      h.style.cssText = 'margin:1rem 0 .5rem;font-size:.95rem;border-bottom:1px solid var(--border);padding-bottom:.25rem';
      h.textContent = section.title;
      container.appendChild(h);
    }
    (section.questions || []).forEach((q, qi) => {
      const div = document.createElement('div');
      div.className = 'ws-admin-q';
      div.style.cssText = 'margin-bottom:.75rem;padding:.6rem .75rem;background:var(--card-bg,#fff);border:1px solid var(--border);border-radius:8px';

      if (q.type === 'fitb') {
        const label = document.createElement('p');
        label.style.cssText = 'margin:0 0 .4rem;font-size:.9rem;color:var(--muted)';
        label.textContent = `Fill-in-the-blank${q.num !== undefined ? ` #${q.num}` : ''}`;
        div.appendChild(label);

        const preview = document.createElement('p');
        preview.style.cssText = 'margin:0 0 .5rem;font-size:1rem';
        preview.textContent = q.template;
        div.appendChild(preview);

        q.blanks.forEach((blank, bi) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem';
          const lbl = document.createElement('label');
          lbl.style.cssText = 'font-size:.85rem;color:var(--muted);white-space:nowrap';
          lbl.textContent = `Blank ${bi + 1} answer:`;
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.style.cssText = 'flex:1;min-width:0';
          inp.placeholder = 'Correct answer…';
          inp.value = blank;
          inp.dataset.si = si;
          inp.dataset.qi = qi;
          inp.dataset.bi = bi;
          inp.className = 'ws-blank-ans';
          inp.addEventListener('input', () => syncWorksheetData());
          row.appendChild(lbl);
          row.appendChild(inp);
          div.appendChild(row);
        });

        const ptsRow = document.createElement('div');
        ptsRow.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-top:.25rem';
        ptsRow.innerHTML = `<label style="font-size:.8rem;color:var(--muted)">Points total: <input type="number" min="0" step="0.5" value="${q.points}" data-si="${si}" data-qi="${qi}" class="ws-pts-inp" style="width:4rem"></label>`;
        ptsRow.querySelector('.ws-pts-inp').addEventListener('input', () => syncWorksheetData());
        div.appendChild(ptsRow);

      } else if (q.type === 'tf') {
        const label = document.createElement('p');
        label.style.cssText = 'margin:0 0 .4rem;font-size:.9rem;color:var(--muted)';
        label.textContent = 'True / False';
        div.appendChild(label);

        const stmt = document.createElement('p');
        stmt.style.cssText = 'margin:0 0 .5rem;font-size:1rem';
        stmt.textContent = q.text;
        div.appendChild(stmt);

        const radios = document.createElement('div');
        radios.style.cssText = 'display:flex;gap:1rem;align-items:center';
        const name = `ws-tf-${si}-${qi}-${flatQ}`;
        ['T', 'F'].forEach(val => {
          const lbl = document.createElement('label');
          lbl.style.cssText = 'display:flex;align-items:center;gap:.35rem;font-size:.95rem;cursor:pointer';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = name;
          radio.value = val;
          radio.dataset.si = si;
          radio.dataset.qi = qi;
          radio.className = 'ws-tf-radio';
          if (q.correct === val) radio.checked = true;
          radio.addEventListener('change', () => syncWorksheetData());
          lbl.appendChild(radio);
          lbl.appendChild(document.createTextNode(val === 'T' ? 'True' : 'False'));
          radios.appendChild(lbl);
        });
        div.appendChild(radios);

      } else if (q.type === 'short') {
        const label = document.createElement('p');
        label.style.cssText = 'margin:0 0 .25rem;font-size:.9rem;color:var(--muted)';
        label.textContent = `Short answer${q.num !== undefined ? ` #${q.num}` : ''} — parent grades`;
        div.appendChild(label);

        const stmt = document.createElement('p');
        stmt.style.cssText = 'margin:0 0 .4rem;font-size:1rem';
        stmt.textContent = q.text;
        div.appendChild(stmt);

        const ptsRow = document.createElement('div');
        ptsRow.innerHTML = `<label style="font-size:.8rem;color:var(--muted)">Points: <input type="number" min="0" step="1" value="${q.points}" data-si="${si}" data-qi="${qi}" class="ws-pts-inp" style="width:4rem"></label>`;
        ptsRow.querySelector('.ws-pts-inp').addEventListener('input', () => syncWorksheetData());
        div.appendChild(ptsRow);
      }

      container.appendChild(div);
      flatQ++;
    });
  });
}

function syncWorksheetData() {
  if (!currentWorksheetData) return;
  // Sync blank answers from inputs back into currentWorksheetData
  document.querySelectorAll('.ws-blank-ans').forEach(inp => {
    const si = Number(inp.dataset.si), qi = Number(inp.dataset.qi), bi = Number(inp.dataset.bi);
    if (currentWorksheetData.sections[si]?.questions[qi]?.blanks) {
      currentWorksheetData.sections[si].questions[qi].blanks[bi] = inp.value.trim();
    }
  });
  document.querySelectorAll('.ws-tf-radio:checked').forEach(radio => {
    const si = Number(radio.dataset.si), qi = Number(radio.dataset.qi);
    if (currentWorksheetData.sections[si]?.questions[qi]) {
      currentWorksheetData.sections[si].questions[qi].correct = radio.value;
    }
  });
  document.querySelectorAll('.ws-pts-inp').forEach(inp => {
    const si = Number(inp.dataset.si), qi = Number(inp.dataset.qi);
    if (currentWorksheetData.sections[si]?.questions[qi]) {
      currentWorksheetData.sections[si].questions[qi].points = Number(inp.value) || 1;
    }
  });
}

function collectWorksheetAnswers() {
  if (!currentWorksheetData) return null;
  syncWorksheetData();
  return currentWorksheetData;
}

$('#ie-ws-parse').addEventListener('click', () => {
  const text = $('#ie-ws-paste').value;
  if (!text.trim()) return;
  const wd = parseWorksheet(text);
  const total = wd.sections.reduce((s, sec) => s + sec.questions.length, 0);
  const statusEl = $('#ie-ws-parse-status');
  if (total === 0) {
    statusEl.textContent = 'No questions found — check the format.';
    statusEl.hidden = false;
    return;
  }
  currentWorksheetData = wd;
  renderWorksheetEditor(wd);
  statusEl.textContent = `Parsed ${total} question${total !== 1 ? 's' : ''}. Fill in any correct answers below, then save.`;
  statusEl.hidden = false;
});

// ============================================================
// Planner
// ============================================================

function weekStartOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const target = appSettings.weekStartDay === 'sunday' ? 0 : 1;
  const diff = (day - target + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}
function formatWeekLabel(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const sM = s.toLocaleString('default', { month: 'short' });
  const eM = e.toLocaleString('default', { month: 'short' });
  const y = s.getFullYear();
  if (s.getMonth() === e.getMonth()) return `${sM} ${s.getDate()}–${e.getDate()}, ${y}`;
  return `${sM} ${s.getDate()} – ${eM} ${e.getDate()}, ${y}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let plannerWeekStart = null; // initialized lazily after settings load
let plannerStudentId = null;
let plannerCoursesCache = [];
let plannerMode = 'week'; // 'week' | 'month'
let plannerMonthRef = null; // YYYY-MM-01 of the month being viewed

function firstWeekStartOfMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(1);
  return weekStartOf(d);
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
  if (!plannerWeekStart) plannerWeekStart = weekStartOf(new Date());
  allCourseItems = [];
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
  loadAllCourseItems(); // pre-fetch in background, no need to await
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
  plannerWeekStart = weekStartOf(startDate + 'T12:00:00');
  renderPlanner();
});

$('#planner-student').addEventListener('change', () => {
  allCourseItems = [];
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
  plannerWeekStart = firstWeekStartOfMonth(plannerMonthRef);
  $('#planner-view-month').classList.add('active-view');
  $('#planner-view-week').classList.remove('active-view');
  $('#planner-copy').hidden = true;
  renderPlanner();
});
$('#planner-prev').addEventListener('click', () => {
  if (plannerMode === 'month') {
    plannerMonthRef = addMonths(plannerMonthRef, -1);
    plannerWeekStart = firstWeekStartOfMonth(plannerMonthRef);
  } else {
    plannerWeekStart = addDays(plannerWeekStart, -7);
  }
  renderPlanner();
});
$('#planner-next').addEventListener('click', () => {
  if (plannerMode === 'month') {
    plannerMonthRef = addMonths(plannerMonthRef, 1);
    plannerWeekStart = firstWeekStartOfMonth(plannerMonthRef);
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
$('#planner-today').addEventListener('click', () => {
  plannerWeekStart = weekStartOf(new Date());
  plannerMonthRef = plannerWeekStart;
  renderPlanner();
});

$('#planner-print').addEventListener('click', () => {
  if (plannerMode === 'month') printMonthReport(plannerStudentId, plannerWeekStart, plannerMonthRef);
  else printWeekReport(plannerStudentId, plannerWeekStart);
});

const DAY_NAMES_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_NAMES_SUN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_NAMES = () => appSettings.weekStartDay === 'sunday' ? DAY_NAMES_SUN : DAY_NAMES_MON;

function attachPlannerEvents() {
  let draggingId = null;
  let draggingDate = null;

  document.querySelectorAll('.planner-task[draggable]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      draggingId = el.dataset.taskId;
      draggingDate = el.closest('.planner-tasks')?.dataset.dropDate;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      draggingId = null;
      draggingDate = null;
      el.classList.remove('dragging');
      document.querySelectorAll('.planner-tasks').forEach((col) => col.classList.remove('drop-target'));
      document.querySelectorAll('.planner-task').forEach((t) => t.classList.remove('insert-before'));
    });
    el.addEventListener('dragover', (e) => {
      if (!draggingId || el.dataset.taskId === draggingId) return;
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.planner-task').forEach((t) => t.classList.remove('insert-before'));
      el.classList.add('insert-before');
    });
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.planner-task').forEach((t) => t.classList.remove('insert-before'));
      if (!draggingId || el.dataset.taskId === draggingId) return;
      const targetDate = el.closest('.planner-tasks')?.dataset.dropDate;
      if (draggingDate === targetDate) {
        const colEl = el.closest('.planner-tasks');
        const ids = [...colEl.querySelectorAll('.planner-task[data-task-id]')].map((t) => t.dataset.taskId);
        const fromIdx = ids.indexOf(draggingId);
        const toIdx = ids.indexOf(el.dataset.taskId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, draggingId);
        await api('/api/schedule/reorder', { method: 'POST', body: { tasks: ids.map((id, sort) => ({ id: Number(id), sort })) } });
      } else {
        await api(`/api/schedule/${draggingId}`, { method: 'PATCH', body: { date: targetDate } });
      }
      renderPlanner();
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
      const targetDate = col.dataset.dropDate;
      if (targetDate !== draggingDate) {
        await api(`/api/schedule/${draggingId}`, { method: 'PATCH', body: { date: targetDate } });
        renderPlanner();
      }
    });
  });

  document.querySelectorAll('[data-del-schedule]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await api(`/api/schedule/${btn.dataset.delSchedule}`, { method: 'DELETE' });
      renderPlanner();
    })
  );
  document.querySelectorAll('[data-done-schedule]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isDone = btn.dataset.isDone === '1';
      await api(`/api/schedule/${btn.dataset.doneSchedule}`, { method: 'PATCH', body: { done: !isDone } });
      renderPlanner();
    });
  });
  document.querySelectorAll('[data-add-task]').forEach((btn) =>
    btn.addEventListener('click', () => openPlannerAddModal(btn.dataset.addTask))
  );
}

function renderDayCell(day, tasks, compact = false, spellingTests = [], today = '') {
  const dayTasks = tasks.filter((t) => t.date === day.date);
  const dayTests = spellingTests.filter((t) => t.date === day.date);
  const isToday = day.date === today;
  const testBadges = dayTests.map((t) => {
    const pct = Math.round((t.score / t.total) * 100);
    return `<div class="planner-task planner-test-badge" title="${esc(t.list)}">⭐ Spelling ${t.score}/${t.total} (${pct}%)</div>`;
  }).join('');
  const taskHtml = dayTasks.map((t) => {
    const colorStyle = t.courseColor ? ` style="border-left:3px solid ${esc(t.courseColor)}"` : '';
    return `<div class="planner-task${t.done ? ' done' : ''}" draggable="true" data-task-id="${t.id}"${colorStyle}>
      <button class="planner-done-btn${t.done ? ' is-done' : ''}" data-done-schedule="${t.id}" data-is-done="${t.done ? '1' : '0'}" title="${t.done ? 'Mark not done' : 'Mark done'}">✓</button>
      <span>${t.itemId ? TYPE_ICON[t.type] : '📌'} ${esc(t.itemTitle || t.offlineTitle)}</span>
      <button class="danger tiny" data-del-schedule="${t.id}">✕</button>
    </div>`;
  }).join('');
  const fmtDate = (d) => { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleString('default', { month: 'short', day: 'numeric' }); };
  return `<div class="planner-day${compact ? ' planner-day-compact' : ''}${isToday ? ' today' : ''}" data-drop-date="${day.date}">
    <h3>${compact ? day.name.slice(0,3) : day.name}<small>${fmtDate(day.date)}</small></h3>
    <div class="planner-tasks" data-drop-date="${day.date}">
      ${testBadges}
      ${taskHtml || (!testBadges ? `<p class="hint tiny">—</p>` : '')}
    </div>
    <button class="secondary small" data-add-task="${day.date}">+ Add</button>
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
      const weekDays = DAY_NAMES().map((name, i) => ({ name, date: addDays(cursor, i) }));
      const fridayMonth = new Date(weekDays[4].date + 'T00:00:00').getMonth();
      const mondayMonth = new Date(weekDays[0].date + 'T00:00:00').getMonth();
      if (w > 0 && mondayMonth !== month && fridayMonth !== month) break;
      weeks.push(weekDays);
      cursor = addDays(cursor, 7);
    }
    const rangeStart = weeks[0][0].date;
    const rangeEnd = weeks[weeks.length - 1][4].date;
    const [{ tasks }, { tests: spellingTests }] = await Promise.all([
      api(`/api/schedule-range/${plannerStudentId}?start=${rangeStart}&end=${rangeEnd}`),
      api(`/api/admin/students/${plannerStudentId}/tests-range?from=${rangeStart}&to=${rangeEnd}`),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    $('#planner-week-label').textContent = monthLabel(plannerMonthRef);
    $('#planner-grid').className = 'planner-grid planner-month';
    $('#planner-grid').innerHTML =
      `<div class="planner-month-header">${DAY_NAMES().map((d) => `<div>${d.slice(0,3)}</div>`).join('')}</div>` +
      weeks.map((week) =>
        `<div class="planner-month-row">${week.map((day) => renderDayCell(day, tasks, true, spellingTests, today)).join('')}</div>`
      ).join('');
  } else {
    const end = addDays(plannerWeekStart, 4);
    $('#planner-week-label').textContent = formatWeekLabel(plannerWeekStart, end);
    const [{ tasks }, { tests: spellingTests }] = await Promise.all([
      api(`/api/schedule-week/${plannerStudentId}?start=${plannerWeekStart}`),
      api(`/api/admin/students/${plannerStudentId}/tests-range?from=${plannerWeekStart}&to=${end}`),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const days = DAY_NAMES().map((name, i) => ({ name, date: addDays(plannerWeekStart, i) }));
    $('#planner-grid').className = 'planner-grid';
    $('#planner-grid').innerHTML = days.map((day) => renderDayCell(day, tasks, false, spellingTests, today)).join('');
  }

  attachPlannerEvents();
}

// ---------- planner add-task modal ----------

let allCourseItems = []; // {id, type, title, courseName, courseColor}
let plannerAddDate = null;

async function loadAllCourseItems() {
  const courses = await api(`/api/courses/mine/${plannerStudentId}`);
  const details = await Promise.all(courses.map((c) => api(`/api/admin/courses/${c.id}`)));
  allCourseItems = [];
  for (const course of details) {
    for (const unit of course.units) {
      for (const it of unit.items) {
        allCourseItems.push({ id: it.id, type: it.type, title: it.title, courseName: course.name, courseColor: course.color });
      }
    }
  }
}

function openPlannerAddModal(date) {
  plannerAddDate = date || addDays(plannerWeekStart, 0);
  renderDayTabs();
  renderItemList('');
  $('#planner-item-search').value = '';
  $('#planner-offline-input').value = '';
  $('#planner-add-modal').hidden = false;
  setTimeout(() => $('#planner-item-search').focus(), 60);
}

function closePlannerAddModal() {
  $('#planner-add-modal').hidden = true;
  renderPlanner();
}

function renderDayTabs() {
  const days = DAY_NAMES().map((name, i) => ({ name, date: addDays(plannerWeekStart, i) }));
  $('#planner-day-tabs').innerHTML = days.map((d) =>
    `<button class="day-tab${d.date === plannerAddDate ? ' active' : ''}" data-tab-date="${d.date}">
      <span>${d.name.slice(0, 3)}</span>
      <small>${d.date.slice(5)}</small>
    </button>`
  ).join('');
  $('#planner-day-tabs').querySelectorAll('.day-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      plannerAddDate = btn.dataset.tabDate;
      document.querySelectorAll('.day-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function renderItemList(query) {
  const q = query.toLowerCase();
  const filtered = q
    ? allCourseItems.filter((it) => it.title.toLowerCase().includes(q) || it.courseName.toLowerCase().includes(q))
    : allCourseItems;

  if (!filtered.length) {
    $('#planner-item-list').innerHTML = '<p class="hint" style="padding:1rem;text-align:center">No items match.</p>';
    return;
  }

  const groups = {};
  for (const it of filtered) {
    if (!groups[it.courseName]) groups[it.courseName] = [];
    groups[it.courseName].push(it);
  }

  $('#planner-item-list').innerHTML = Object.entries(groups).map(([course, items]) =>
    `<div class="item-group-header">${esc(course)}</div>` +
    items.map((it) =>
      `<div class="item-list-item" tabindex="0" data-item-id="${it.id}">
        <span>${TYPE_ICON[it.type] || '📄'}</span>
        <span class="item-label">${esc(it.title)}</span>
        <span class="item-course">${TYPE_LABEL[it.type] || ''}</span>
      </div>`
    ).join('')
  ).join('');

  $('#planner-item-list').querySelectorAll('.item-list-item').forEach((el) => {
    el.addEventListener('click', () => scheduleItem(Number(el.dataset.itemId), null, el));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') scheduleItem(Number(el.dataset.itemId), null, el); });
  });
}

async function scheduleItem(itemId, title, el) {
  if (!plannerAddDate) return;
  if (el) {
    el.classList.add('added');
    el.innerHTML = '<span>✓</span><span class="item-label">Added</span>';
    el.style.pointerEvents = 'none';
  }
  await api('/api/schedule', {
    method: 'POST',
    body: { studentId: plannerStudentId, date: plannerAddDate, itemId: itemId || null, title: title || null },
  });
  if (title) {
    msg('Added to planner.');
    $('#planner-offline-input').value = '';
  }
  if (el) setTimeout(() => renderItemList($('#planner-item-search').value), 2000);
}

$('#planner-item-search').addEventListener('input', (e) => renderItemList(e.target.value));

$('#planner-modal-close').addEventListener('click', closePlannerAddModal);
$('#planner-add-modal').addEventListener('click', (e) => { if (e.target === $('#planner-add-modal')) closePlannerAddModal(); });

$('#planner-add-btn').addEventListener('click', () => openPlannerAddModal(plannerWeekStart || addDays(weekStartOf(new Date()), 0)));

$('#planner-offline-add').addEventListener('click', () => {
  const title = $('#planner-offline-input').value.trim();
  if (title) scheduleItem(null, title, null);
});
$('#planner-offline-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const t = e.target.value.trim(); if (t) scheduleItem(null, t, null); }
});

function renderPrintTaskBlock(t) {
  const title = t.itemTitle || t.offlineTitle;
  const course = t.courseName ? `<span class="task-course">${esc(t.courseName)}</span>` : `<span class="task-course offline">Offline</span>`;
  const status = t.done ? `<span class="done-tag">✓ done</span>` : '';
  const typeTag = t.type ? `<span class="type-tag">${TYPE_LABEL[t.type] || t.type}</span>` : '';
  let body = '';
  if (t.body) {
    const isHtml = t.body.includes('<');
    body = isHtml
      ? `<div class="task-body">${t.body}</div>`
      : `<div class="task-body">${t.body.split(/\n\n+/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
  }
  return `<div class="task-block">
    <div class="task-header">${course} ${typeTag} <strong>${esc(title)}</strong> ${status}</div>
    ${body}
  </div>`;
}

async function printWeekReport(studentId, start) {
  const r = await api(`/api/week-report/${studentId}?start=${start}`);
  // Group tasks by date
  const byDate = {};
  for (const t of r.tasks) { (byDate[t.date] = byDate[t.date] || []).push(t); }
  const dayBlocks = Object.entries(byDate).map(([date, tasks]) =>
    `<div class="day-block">
      <h3>${date}</h3>
      ${tasks.map(renderPrintTaskBlock).join('')}
    </div>`
  ).join('') || '<p class="empty">Nothing scheduled this week.</p>';

  const gradedRows = r.graded
    .map((g) => `<tr><td>${esc(g.itemTitle)}</td><td>${esc(g.courseName)}</td><td>${g.score}/${g.points_possible}</td></tr>`)
    .join('');
  const spellingRows = r.spellingTests
    .map((t) => `<tr><td>${esc(t.list)}</td><td>${t.score}/${t.total}</td></tr>`)
    .join('');
  const win = window.open('', '_blank');
  const schoolPrefix = appSettings.schoolName ? `${esc(appSettings.schoolName)} — ` : '';
  win.document.write(`<!DOCTYPE html><html><head><title>${schoolPrefix}Weekly Plan — ${esc(r.student)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 680px; margin: 2rem auto; color: #222; font-size: .95rem; }
      h1 { font-size: 1.4rem; border-bottom: 2px solid #222; padding-bottom: .4rem; }
      h2 { font-size: 1.1rem; margin: 1.5rem 0 .5rem; border-bottom: 1px solid #ccc; padding-bottom: .2rem; }
      h3 { font-size: 1rem; margin: 1rem 0 .3rem; color: #555; }
      .day-block { margin-bottom: .75rem; }
      .task-block { border-left: 3px solid #bbb; padding: .3rem .7rem; margin-bottom: .5rem; break-inside: avoid; }
      .task-header { font-size: .95rem; margin-bottom: .2rem; }
      .task-course { font-weight: 700; color: #3a6fd8; }
      .task-course.offline { color: #888; font-weight: 400; }
      .type-tag { font-size: .78rem; color: #888; font-style: italic; }
      .done-tag { font-size: .78rem; color: #2e9e5b; font-weight: 700; }
      .task-body p { margin: .2rem 0; font-size: .88rem; color: #444; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; margin-top: .4rem; }
      td, th { border: 1px solid #bbb; padding: .35rem .6rem; text-align: left; font-size: .88rem; }
      th { background: #f0f0f0; }
      .empty { color: #888; font-style: italic; }
      @media print { h2 { break-after: avoid; } .task-block { break-inside: avoid; } }
    </style></head><body>
    <h1>${schoolPrefix}Weekly Plan — ${esc(r.student)}</h1>
    <p>Week of ${r.start}</p>
    <h2>Schedule</h2>
    ${dayBlocks}
    <h2>Graded work</h2>
    ${gradedRows ? `<table><tr><th>Item</th><th>Course</th><th>Score</th></tr>${gradedRows}</table>` : '<p class="empty">Nothing graded this week.</p>'}
    <h2>Spelling tests</h2>
    ${spellingRows ? `<table><tr><th>List</th><th>Score</th></tr>${spellingRows}</table>` : '<p class="empty">No spelling tests this week.</p>'}
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

async function printMonthReport(studentId, monthMonday, monthRef) {
  const month = new Date(monthRef + 'T00:00:00').getMonth();
  const weeks = [];
  let cursor = monthMonday;
  for (let w = 0; w < 6; w++) {
    const weekDays = DAY_NAMES().map((name, i) => ({ name, date: addDays(cursor, i) }));
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

  const DAY_SHORT = DAY_NAMES().map((d) => d.slice(0, 3));
  const calRows = weeks.map((week) =>
    `<tr>${week.map((day) => {
      const dayTasks = tasks.filter((t) => t.date === day.date);
      const items = dayTasks.map((t) => {
        const label = t.itemTitle || t.offlineTitle;
        const course = t.courseName ? `<span class="cell-course">${esc(t.courseName)}</span> ` : '';
        return `<div class="cell-task${t.done ? ' done' : ''}">${course}${esc(label)}</div>`;
      }).join('');
      return `<td><div class="date-num">${day.date.slice(5)}</div>${items || ''}</td>`;
    }).join('')}</tr>`
  ).join('');

  // Detail section: all days that have tasks, grouped by date
  const taskDays = weeks.flatMap((w) => w).filter((day) => tasks.some((t) => t.date === day.date));
  const detailBlocks = taskDays.map((day) => {
    const dayTasks = tasks.filter((t) => t.date === day.date);
    return `<div class="detail-day">
      <h3>${day.date}</h3>
      ${dayTasks.map(renderPrintTaskBlock).join('')}
    </div>`;
  }).join('');

  const win = window.open('', '_blank');
  const schoolPfx = appSettings.schoolName ? `${esc(appSettings.schoolName)} — ` : '';
  win.document.write(`<!DOCTYPE html><html><head><title>${schoolPfx}${monthLabel(monthRef)} — ${student?.name || ''}</title>
  <style>
    body { font-family: Georgia, serif; margin: 1cm; color: #222; font-size: .88rem; }
    h1 { font-size: 1.3rem; border-bottom: 2px solid #222; padding-bottom: .4rem; margin-bottom: .75rem; }
    h2 { font-size: 1rem; margin: 1.5rem 0 .5rem; border-bottom: 1px solid #ccc; padding-bottom: .2rem; }
    h3 { font-size: .9rem; color: #555; margin: .75rem 0 .25rem; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; padding: .3rem; font-size: .8rem; border: 1px solid #bbb; }
    td { vertical-align: top; border: 1px solid #bbb; padding: .3rem; min-height: 3rem; width: 20%; }
    .date-num { font-size: .7rem; color: #888; font-weight: 700; margin-bottom: .2rem; }
    .cell-course { font-weight: 700; color: #3a6fd8; font-size: .7rem; }
    .cell-task { font-size: .72rem; margin: .1rem 0; padding: .1rem .3rem; background: #e8f0ff; border-radius: 3px; }
    .cell-task.done { background: #e8f7ee; text-decoration: line-through; color: #666; }
    .task-block { border-left: 3px solid #bbb; padding: .3rem .6rem; margin-bottom: .4rem; break-inside: avoid; }
    .task-header { font-size: .88rem; }
    .task-course { font-weight: 700; color: #3a6fd8; }
    .task-course.offline { color: #888; font-weight: 400; }
    .type-tag { font-size: .75rem; color: #888; font-style: italic; }
    .done-tag { font-size: .75rem; color: #2e9e5b; font-weight: 700; }
    .task-body p { margin: .15rem 0; font-size: .82rem; color: #444; line-height: 1.4; }
    .empty { color: #888; font-style: italic; }
    @media print { @page { size: landscape; margin: .75cm; } h2 { break-after: avoid; } .task-block { break-inside: avoid; } }
  </style></head><body>
  <h1>${schoolPfx}${monthLabel(monthRef)} — ${esc(student?.name || '')}</h1>
  <table><tr>${DAY_SHORT.map((d) => `<th>${d}</th>`).join('')}</tr>${calRows}</table>
  ${detailBlocks ? `<h2>Assignment Detail</h2>${detailBlocks}` : ''}
  <script>window.print()<\/script></body></html>`);
  win.document.close();
}

async function printCourse(courseId) {
  const course = await api(`/api/admin/courses/${courseId}`);

  function renderItemBody(it) {
    let html = '';
    if (it.body) {
      const isHtml = it.body.includes('<');
      html += `<div class="item-body">${
        isHtml
          ? it.body
          : it.body.split(/\n\n+/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')
      }</div>`;
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
  const allRows = await api('/api/grading-queue');

  // Populate student filter
  const filterEl = $('#grading-student-filter');
  const prevFilter = filterEl.value;
  const seen = new Set();
  filterEl.innerHTML = '<option value="">All students</option>' +
    allRows.filter((r) => { if (seen.has(r.studentId)) return false; seen.add(r.studentId); return true; })
           .map((r) => `<option value="${r.studentId}">${esc(r.emoji)} ${esc(r.studentName)}</option>`).join('');
  if (prevFilter) filterEl.value = prevFilter;

  const rows = filterEl.value ? allRows.filter((r) => String(r.studentId) === filterEl.value) : allRows;

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
          <div class="grade-score-row">
            <input type="number" class="grade-input" min="0" max="${r.points_possible || 100}" placeholder="Score" data-sub="${r.submissionId}">
            <span class="grade-max-label">/ ${r.points_possible || 100} pts</span>
          </div>
          <input type="text" class="comment-input" placeholder="Parent comment (optional)" data-comment-sub="${r.submissionId}">
          <button data-save-grade="${r.submissionId}">Save grade</button>
        </div>
      </div>`;
    })
    .join('');

  document.querySelectorAll('[data-evidence-notes]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const subId = btn.dataset.subId;
      let photo = null;
      if (btn.dataset.evidencePhoto === 'yes') {
        const full = await fetch(`/api/grading-queue/${subId}/evidence`, { headers: { 'x-pin': parentPin } });
        if (full.ok) { const d = await full.json(); photo = d.evidence_photo; }
      }
      showEvidenceLightbox(btn.dataset.evidenceNotes || null, photo);
    });
  });

  async function saveGrade(subId) {
    const input = document.querySelector(`.grade-input[data-sub="${subId}"]`);
    const commentInput = document.querySelector(`.comment-input[data-comment-sub="${subId}"]`);
    if (!input || input.value === '') return;
    await api(`/api/submissions/${subId}/grade`, {
      method: 'PUT',
      body: { score: Number(input.value), parentComment: commentInput?.value || '', pointsPossible: Number(input.max) || 100 },
    });
    msg('Grade saved.');
    loadGrading();
    loadGradingBadge();
  }

  document.querySelectorAll('[data-save-grade]').forEach((btn) =>
    btn.addEventListener('click', () => saveGrade(btn.dataset.saveGrade))
  );
  document.querySelectorAll('.grade-input').forEach((input) =>
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveGrade(input.dataset.sub); })
  );
}

$('#grading-student-filter').addEventListener('change', loadGrading);

// ============================================================
// Gradebook
// ============================================================

let gradebookCourseId = null;

async function loadGradebookPanel() {
  const courses = await api('/api/admin/courses');
  $('#gradebook-course').innerHTML = courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if (courses.length) renderGradebook(courses[0].id);
  loadSpellingTests();
}

async function loadSpellingTests() {
  const since = $('#spelling-tests-since').value;
  const { students } = await api(since ? `/api/spelling-tests?since=${since}` : '/api/spelling-tests');
  const container = $('#spelling-tests-table');
  const active = students.filter((s) => s.tests.length > 0);
  if (!active.length) {
    container.innerHTML = `<p class="hint">No spelling tests recorded yet.</p>`;
    return;
  }
  container.innerHTML = active
    .map((s) => {
      const rows = s.tests
        .map((t) => {
          const pct = Math.round((t.score / t.total) * 100);
          return `<tr>
            <td>${new Date(t.at + 'Z').toLocaleDateString()}</td>
            <td>${esc(t.list)}</td>
            <td class="${pct >= appSettings.passingPct ? 'score-good' : 'score-bad'}">${t.score}/${t.total} (${pct}%)</td>
            <td><button data-print="${t.id}">🖨 Print</button></td>
          </tr>`;
        })
        .join('');
      return `<div class="results-student"><h3>${esc(s.emoji)} ${esc(s.name)}</h3>
        <table class="results"><tr><th>Date</th><th>List</th><th>Score</th><th></th></tr>${rows}</table></div>`;
    })
    .join('');
  container.querySelectorAll('[data-print]').forEach((btn) =>
    btn.addEventListener('click', () => printSpellingReport(btn.dataset.print))
  );
}
$('#gradebook-course').addEventListener('change', () => renderGradebook($('#gradebook-course').value));
$('#gradebook-csv-btn').addEventListener('click', () => {
  if (!gradebookCourseId) return;
  window.location.href = `/api/gradebook/${gradebookCourseId}/csv`;
});
$('#spelling-tests-since').addEventListener('change', loadSpellingTests);
$('#spelling-tests-csv-btn').addEventListener('click', () => {
  const since = $('#spelling-tests-since').value;
  window.location.href = `/api/spelling-tests/csv${since ? '?since=' + since : ''}`;
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
      const cls = pct !== null ? (pct >= appSettings.passingPct ? 'score-good' : 'score-bad') : '';
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

  // Group items by unit (preserving unit order from the API)
  const unitMap = new Map();
  for (const it of gb.gradableItems) {
    if (!unitMap.has(it.unit_id)) unitMap.set(it.unit_id, { id: it.unit_id, name: it.unit_name, items: [] });
    unitMap.get(it.unit_id).items.push(it);
  }
  const units = Array.from(unitMap.values());

  const unitBlocks = units.map((u, uIdx) => {
    const header = u.items.map((it) => {
      const due = it.due_date ? `<br><small class="hint">due ${it.due_date}</small>` : '';
      return `<th>${esc(it.title)}<br><small>${it.points} pts</small>${due}</th>`;
    }).join('');

    const rows = gb.students.map((s) => {
      const cells = u.items.map((it) => {
        const sc = s.scores[it.id];
        const overdueClass = sc?.overdue ? ' overdue' : '';
        if (!sc || (!sc.status && !sc.overdue)) return `<td class="hint">—</td>`;
        if (sc.overdue && !sc.status) return `<td class="hint overdue" title="Overdue">⚠️</td>`;
        if (sc.status !== 'graded') return `<td class="hint${overdueClass}">${sc.overdue ? '⚠️ ' : ''}⏳</td>`;
        return `<td class="${sc.score / sc.points_possible >= appSettings.passingPct / 100 ? 'score-good' : 'score-bad'}${overdueClass}" style="cursor:pointer" data-history-student="${s.id}" data-history-item="${it.id}" data-history-label="${esc(it.title)} — ${esc(s.name)}">${sc.score}/${sc.points_possible}</td>`;
      }).join('');
      return `<tr><td>${esc(s.emoji)} ${esc(s.name)}</td>${cells}</tr>`;
    }).join('');

    return `<div class="unit-block open">
      <button class="unit-toggle" type="button" aria-expanded="true">
        <div class="unit-toggle-left">
          <span class="unit-num-badge">Unit ${uIdx + 1}</span>
          <span class="unit-title-text">${esc(u.name)}</span>
        </div>
        <div class="unit-toggle-right">
          <span class="unit-item-count">${u.items.length} item${u.items.length !== 1 ? 's' : ''}</span>
          <span class="unit-chevron" aria-hidden="true">▾</span>
        </div>
      </button>
      <div class="unit-items-list">
        <div style="overflow-x:auto">
          <table class="results"><tr><th>Kid</th>${header}</tr>${rows}</table>
        </div>
      </div>
    </div>`;
  }).join('');

  // Overall course summary
  const overallRows = gb.students.map((s) => {
    const pctClass = s.percent === null ? '' : s.percent >= appSettings.passingPct ? 'score-good' : 'score-bad';
    return `<tr><td>${esc(s.emoji)} ${esc(s.name)}</td><td class="${pctClass}">${s.percent === null ? '—' : s.percent + '%'}</td></tr>`;
  }).join('');

  $('#gradebook-table').innerHTML = `<div class="gb-units">${unitBlocks}</div>
    <div class="gb-overall">
      <strong>Course overall</strong>
      <table class="results"><tr><th>Kid</th><th>%</th></tr>${overallRows}</table>
    </div>`;

  document.querySelectorAll('#gradebook-table .unit-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.unit-block');
      const nowOpen = block.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(nowOpen));
    });
  });

  document.querySelectorAll('[data-history-student]').forEach((td) =>
    td.addEventListener('click', () => showHistory(td.dataset.historyStudent, td.dataset.historyItem, td.dataset.historyLabel))
  );
}

// ============================================================
// Spelling (word lists + weekly assignment + results)
// ============================================================

let cachedStudents = [];
async function loadSpelling() {
  const [overview, lists] = await Promise.all([api('/api/overview'), api('/api/lists')]);
  cachedLists = lists;
  cachedStudents = overview.students;
  renderAssignRows(overview.students);
  renderLists(lists);
}

function renderAssignRows(students) {
  const options = (sel) =>
    `<option value="">— no list —</option>` +
    cachedLists.map((l) => `<option value="${l.id}" ${sel === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  $('#assign-rows').innerHTML = students.length
    ? students.map((s) => {
        const lp = s.listProgress;
        const progressHtml = lp
          ? `<span class="mastery-stat">${lp.mastered}/${lp.total} mastered
              <span class="mastery-bar"><span class="mastery-fill" style="width:${lp.total ? Math.round((lp.mastered/lp.total)*100) : 0}%"></span></span>
             </span>`
          : `<span class="mastery-stat">No list assigned</span>`;
        return `<div class="item-row">
          <span>${esc(s.emoji)}</span>
          <strong class="grow">${esc(s.name)}</strong>
          ${progressHtml}
          <label>This week: <select data-assign="${s.id}">${options(s.assignment?.id)}</select></label>
        </div>`;
      }).join('')
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

function groupByName(arr) {
  const map = {};
  for (const item of arr) {
    const k = item.group_name || '';
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function renderGroupSections(groups, renderItem) {
  const named = Object.keys(groups).filter((k) => k).sort();
  const ungrouped = groups[''] || [];
  let html = '';
  for (const g of named) {
    html += `<details class="list-group"><summary class="list-group-header">${esc(g)}</summary>${groups[g].map(renderItem).join('')}</details>`;
  }
  if (ungrouped.length) {
    html += named.length
      ? `<details class="list-group"><summary class="list-group-header">Ungrouped</summary>${ungrouped.map(renderItem).join('')}</details>`
      : ungrouped.map(renderItem).join('');
  }
  return html || '<p class="hint">None yet.</p>';
}

const hiddenLists = new Set(JSON.parse(localStorage.getItem('hiddenLists') || '[]'));
function saveHiddenLists() { localStorage.setItem('hiddenLists', JSON.stringify([...hiddenLists])); }

function renderLists(lists, filterText = '') {
  const q = filterText.toLowerCase();
  const visible = lists.filter((l) => !hiddenLists.has(l.id) && (!q || l.name.toLowerCase().includes(q)));
  const hidden  = lists.filter((l) => hiddenLists.has(l.id) && (!q || l.name.toLowerCase().includes(q)));

  const showHiddenBtn = $('#list-show-hidden');
  showHiddenBtn.hidden = hidden.length === 0;
  showHiddenBtn.textContent = showHiddenBtn.dataset.showing === '1'
    ? `Hide hidden (${hidden.length})`
    : `Show hidden (${hidden.length})`;

  const displayList = showHiddenBtn.dataset.showing === '1' ? [...visible, ...hidden] : visible;

  const groups = groupByName(displayList);
  const groupNames = Object.keys(groups).filter((k) => k).sort();
  $('#list-groups-datalist').innerHTML = groupNames.map((g) => `<option value="${esc(g)}">`).join('');

  const renderItem = (l) => {
    const isHidden = hiddenLists.has(l.id);
    return `<div class="item-row${isHidden ? ' list-hidden-item' : ''}">
      <strong class="grow">${esc(l.name)}</strong>
      <span class="muted-label">${l.wordCount} words${l.builtin ? ' · built-in' : ''}</span>
      <button class="secondary small" data-assign-list="${l.id}">Assign →</button>
      ${l.builtin ? '' : `<button class="secondary small" data-print-list="${l.id}">🖨 Worksheet</button>`}
      <button class="small" data-edit-list="${l.id}">${l.builtin ? 'Copy & edit' : 'Edit'}</button>
      ${l.builtin
        ? `<button class="secondary small" data-hide-list="${l.id}">${isHidden ? 'Unhide' : 'Hide'}</button>`
        : `<button class="danger small" data-del-list="${l.id}">Delete</button>`}
    </div>`;
  };

  $('#list-rows').innerHTML = renderGroupSections(groups, renderItem);

  document.querySelectorAll('[data-assign-list]').forEach((btn) =>
    btn.addEventListener('click', (e) => openAssignPopup(e, Number(btn.dataset.assignList)))
  );
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
      $('#list-group').value = list.group_name || '';
      $('#list-words').value = list.words.map((w) => {
        if (w.definition) return `${w.word} | ${w.sentence} | ${w.definition}`;
        if (w.sentence) return `${w.word} | ${w.sentence}`;
        return w.word;
      }).join('\n');
      $('#list-editor-title').textContent = list.builtin ? 'New list (from copy)' : `Editing: ${list.name}`;
      showSection('list', 'editor');
      $('#list-name').scrollIntoView({ behavior: 'smooth' });
    })
  );
  document.querySelectorAll('[data-del-list]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this list?')) return;
      await api(`/api/lists/${btn.dataset.delList}`, { method: 'DELETE' });
      msg('List deleted.');
      loadSpelling();
    })
  );
  document.querySelectorAll('[data-hide-list]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.hideList);
      if (hiddenLists.has(id)) hiddenLists.delete(id); else hiddenLists.add(id);
      saveHiddenLists();
      renderLists(cachedLists, $('#list-filter').value);
    })
  );
}

// Filter input
$('#list-filter').addEventListener('input', () => renderLists(cachedLists, $('#list-filter').value));
$('#list-show-hidden').addEventListener('click', () => {
  const btn = $('#list-show-hidden');
  btn.dataset.showing = btn.dataset.showing === '1' ? '0' : '1';
  renderLists(cachedLists, $('#list-filter').value);
});

// ---- Assign popup ----
function openAssignPopup(e, listId) {
  const popup = $('#assign-popup');
  $('#assign-popup-students').innerHTML = cachedStudents.map((s) =>
    `<button class="assign-popup-student" data-sid="${s.id}" data-lid="${listId}">${esc(s.emoji)} ${esc(s.name)}</button>`
  ).join('');
  document.querySelectorAll('.assign-popup-student').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await api('/api/assign', { method: 'POST', body: { studentId: Number(btn.dataset.sid), listId: Number(btn.dataset.lid) } });
      popup.hidden = true;
      msg(`Assigned!`);
      loadSpelling();
    })
  );
  const rect = e.target.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
  popup.hidden = false;
}
document.addEventListener('click', (e) => {
  if (!$('#assign-popup').hidden && !e.target.closest('#assign-popup') && !e.target.dataset.assignList)
    $('#assign-popup').hidden = true;
});

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
  const groupName = $('#list-group').value.trim();
  const id = $('#list-id').value;
  if (id) await api(`/api/lists/${id}`, { method: 'PUT', body: { name, words, groupName } });
  else await api('/api/lists', { method: 'POST', body: { name, words, groupName } });
  clearListForm();
  hideSections('list');
  msg('List saved.');
  loadSpelling();
});
$('#list-cancel').addEventListener('click', clearListForm);
function clearListForm() {
  $('#list-id').value = '';
  $('#list-name').value = '';
  $('#list-group').value = '';
  $('#list-words').value = '';
  $('#list-editor-title').textContent = 'New list';
  hideSections('list');
}

function showSection(type, which) {
  $(`#${type}-editor-section`).hidden = which !== 'editor';
  $(`#${type}-bulk-section`).hidden = which !== 'bulk';
  $(`#${type}-new-btn`).classList.toggle('active', which === 'editor');
  $(`#${type}-bulk-btn`).classList.toggle('active', which === 'bulk');
}
function hideSections(type) {
  $(`#${type}-editor-section`).hidden = true;
  $(`#${type}-bulk-section`).hidden = true;
  $(`#${type}-new-btn`).classList.remove('active');
  $(`#${type}-bulk-btn`).classList.remove('active');
}

$('#list-new-btn').addEventListener('click', () => {
  if ($('#list-editor-section').hidden) showSection('list', 'editor');
  else hideSections('list');
});
$('#list-bulk-btn').addEventListener('click', () => {
  if ($('#list-bulk-section').hidden) showSection('list', 'bulk');
  else hideSections('list');
});

function parseBulkSections(text) {
  const sections = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      if (current) sections.push(current);
      current = { name: line.replace(/^#+\s*/, ''), lines: [] };
    } else if (current && line) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

$('#list-bulk-save').addEventListener('click', async () => {
  const groupName = $('#list-bulk-group').value.trim();
  const sections = parseBulkSections($('#list-bulk-text').value);
  if (sections.length === 0) return ($('#list-bulk-status').textContent = 'Paste at least one # Section with words below it.');
  const statusEl = $('#list-bulk-status');
  statusEl.textContent = `Importing ${sections.length} list(s)…`;
  let done = 0;
  for (const sec of sections) {
    const words = sec.lines.map((line) => {
      const [word, sentence = ''] = line.split('|').map((p) => p.trim());
      return { word, sentence };
    }).filter((w) => w.word);
    if (!words.length) continue;
    await api('/api/lists', { method: 'POST', body: { name: sec.name, words, groupName } });
    done++;
    statusEl.textContent = `Imported ${done} of ${sections.length}…`;
  }
  statusEl.textContent = `Done! ${done} list(s) imported.`;
  msg(`${done} list${done === 1 ? '' : 's'} imported.`);
  $('#list-bulk-text').value = '';
  loadSpelling();
});
$('#list-bulk-clear').addEventListener('click', () => {
  $('#list-bulk-text').value = '';
  $('#list-bulk-group').value = '';
  $('#list-bulk-status').textContent = '';
});


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
  renderDecks(decks, $('#deck-filter').value);
}

function renderDecks(decks, filterText = '') {
  const q = filterText.toLowerCase();
  const visible = decks.filter((d) => !q || d.name.toLowerCase().includes(q));
  const groups = groupByName(visible);
  const groupNames = Object.keys(groups).filter((k) => k).sort();
  $('#deck-groups-datalist').innerHTML = groupNames.map((g) => `<option value="${esc(g)}">`).join('');

  const renderItem = (d) => `<div class="item-row">
        <strong class="grow">${esc(d.name)}</strong>
        <span>${d.cardCount} cards${d.builtin ? ' · built-in' : ''}</span>
        <button data-edit-deck="${d.id}">${d.builtin ? 'Copy & edit' : 'Edit'}</button>
        <button class="danger" data-del-deck="${d.id}">Delete</button>
      </div>`;

  $('#deck-rows').innerHTML = renderGroupSections(groups, renderItem);

  document.querySelectorAll('[data-edit-deck]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const deck = await api(`/api/decks/${btn.dataset.editDeck}`);
      $('#deck-id').value = deck.builtin ? '' : deck.id;
      $('#deck-name').value = deck.builtin ? `${deck.name} (copy)` : deck.name;
      $('#deck-group').value = deck.group_name || '';
      $('#deck-cards').value = deck.cards.map((c) => `${c.front} | ${c.back}`).join('\n');
      $('#deck-editor-title').textContent = deck.builtin ? 'New deck (from copy)' : `Editing: ${deck.name}`;
      showSection('deck', 'editor');
      $('#deck-name').scrollIntoView({ behavior: 'smooth' });
    })
  );
  document.querySelectorAll('[data-del-deck]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this deck?')) return;
      await api(`/api/decks/${btn.dataset.delDeck}`, { method: 'DELETE' });
      msg('Deck deleted.');
      loadDecks();
    })
  );
}

$('#deck-filter').addEventListener('input', () => renderDecks(cachedDecks, $('#deck-filter').value));

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
  const groupName = $('#deck-group').value.trim();
  const id = $('#deck-id').value;
  if (id) await api(`/api/decks/${id}`, { method: 'PUT', body: { name, cards, groupName } });
  else await api('/api/decks', { method: 'POST', body: { name, cards, groupName } });
  clearDeckForm();
  hideSections('deck');
  msg('Deck saved.');
  loadDecks();
});
$('#deck-cancel').addEventListener('click', clearDeckForm);
function clearDeckForm() {
  $('#deck-id').value = '';
  $('#deck-name').value = '';
  $('#deck-group').value = '';
  $('#deck-cards').value = '';
  $('#deck-editor-title').textContent = 'New deck';
  hideSections('deck');
}

$('#deck-new-btn').addEventListener('click', () => {
  if ($('#deck-editor-section').hidden) showSection('deck', 'editor');
  else hideSections('deck');
});
$('#deck-bulk-btn').addEventListener('click', () => {
  if ($('#deck-bulk-section').hidden) showSection('deck', 'bulk');
  else hideSections('deck');
});

$('#deck-bulk-save').addEventListener('click', async () => {
  const groupName = $('#deck-bulk-group').value.trim();
  const sections = parseBulkSections($('#deck-bulk-text').value);
  if (sections.length === 0) return ($('#deck-bulk-status').textContent = 'Paste at least one # Section with cards below it.');
  const statusEl = $('#deck-bulk-status');
  statusEl.textContent = `Importing ${sections.length} deck(s)…`;
  let done = 0;
  for (const sec of sections) {
    const cards = sec.lines.map((line) => {
      const [front, back = ''] = line.split('|').map((p) => p.trim());
      return { front, back };
    }).filter((c) => c.front);
    if (!cards.length) continue;
    await api('/api/decks', { method: 'POST', body: { name: sec.name, cards, groupName } });
    done++;
    statusEl.textContent = `Imported ${done} of ${sections.length}…`;
  }
  statusEl.textContent = `Done! ${done} deck(s) imported.`;
  msg(`${done} deck${done === 1 ? '' : 's'} imported.`);
  $('#deck-bulk-text').value = '';
  loadDecks();
});
$('#deck-bulk-clear').addEventListener('click', () => {
  $('#deck-bulk-text').value = '';
  $('#deck-bulk-group').value = '';
  $('#deck-bulk-status').textContent = '';
});

// ============================================================
// Settings
// ============================================================

$('#pin-change-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPin = $('#new-pin').value;
  try {
    await api('/api/parent/pin', { method: 'POST', body: { newPin } });
    parentPin = newPin;
    $('#new-pin').value = '';
    msg('PIN changed.');
  } catch (err) {
    msg(err.message);
  }
});

async function loadSettings() {
  const s = await api('/api/admin/app-settings');
  appSettings.schoolName = s.school_name || '';
  appSettings.passingPct = Number(s.passing_pct) || 80;
  appSettings.weekStartDay = s.week_start_day || 'monday';
  $('#setting-school-name').value = appSettings.schoolName;
  $('#setting-passing-pct').value = appSettings.passingPct;
  const radio = document.querySelector(`input[name="week_start_day"][value="${appSettings.weekStartDay}"]`);
  if (radio) radio.checked = true;
}

$('#app-settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const school_name = $('#setting-school-name').value.trim();
  const passing_pct = Number($('#setting-passing-pct').value);
  const week_start_day = document.querySelector('input[name="week_start_day"]:checked')?.value || 'monday';
  await api('/api/admin/app-settings', { method: 'POST', body: { school_name, passing_pct, week_start_day } });
  appSettings.schoolName = school_name;
  appSettings.passingPct = passing_pct;
  if (appSettings.weekStartDay !== week_start_day) {
    appSettings.weekStartDay = week_start_day;
    plannerWeekStart = weekStartOf(new Date());
  }
  msg('Settings saved.');
});

