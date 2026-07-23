'use strict';

/* ---------------- Read-only note view ---------------- */

const NOTE_TYPE_LABELS = {
  memo: '01 · BASIC NOTE',
  todo: '02 · TO DO LIST',
  moodboard: '03 · MOODBOARD',
  links: '04 · LINKS',
  collection: '05 · COLLECTION'
};

function getViewedNote() {
  return state.notes.find(note => note.id === currentNoteViewId) || null;
}

function openNoteView(noteId) {
  const note = state.notes.find(item => item.id === noteId);
  if (!note) return;

  if (currentNoteId) persistCurrentNote();
  currentNoteId = null;
  currentNoteViewId = noteId;
  editorReturnsToView = false;
  note.template = note.template || 'memo';

  homeView.hidden = true;
  folderGridView.hidden = true;
  editorView.hidden = true;
  editorView.style.display = 'none';
  chatView.hidden = true;
  calendarView.hidden = true;
  todoView.hidden = true;
  noteDetailView.hidden = false;

  breadcrumb.textContent = note.title || '제목 없음';
  renderNoteView(note);
  closeSidebarMobile();
}

function renderNoteView(note = getViewedNote()) {
  if (!note) return;
  const folder = state.folders.find(item => item.id === note.folderId);

  $('#noteViewType').textContent = NOTE_TYPE_LABELS[note.template || 'memo'];
  $('#noteViewTitle').textContent = note.title || '제목 없음';
  $('#noteViewMeta').textContent = `${folder?.name || '폴더 없음'} · 마지막 수정 ${formatDate(note.updatedAt)}`;
  $('#noteViewStarBtn').classList.toggle('active', Boolean(note.starred));
  populateNoteViewFolderSelect(note.folderId);

  const content = $('#noteViewContent');
  content.innerHTML = '';

  if (note.template === 'todo') renderTodoNoteView(content);
  else if (note.template === 'moodboard') renderMoodboardNoteView(content, note);
  else if (note.template === 'links') renderLinkNoteView(content, note);
  else if (note.template === 'collection') renderCollectionNoteView(content, note);
  else renderMemoNoteView(content, note);
}

function populateNoteViewFolderSelect(selectedId) {
  const select = $('#noteViewFolderSelect');
  select.innerHTML = '<option value="">폴더 없음</option>' + state.folders.map(folder => `
    <option value="${folder.id}" ${folder.id === selectedId ? 'selected' : ''}>${escapeHtml(folder.name)}</option>
  `).join('');
}

function renderMemoNoteView(content, note) {
  const body = document.createElement('div');
  body.className = 'note-view-memo';
  body.textContent = note.content || '아직 작성된 내용이 없어요.';
  content.appendChild(body);
}

function renderTodoNoteView(content) {
  const list = document.createElement('ul');
  list.className = 'note-view-todos';

  if (!todos.length) {
    list.innerHTML = '<li class="note-view-memo">아직 등록된 할 일이 없어요.</li>';
  }

  todos.forEach(todo => {
    const item = document.createElement('li');
    item.className = 'note-view-todo' + (todo.done ? ' done' : '');
    item.innerHTML = `
      <button type="button" aria-label="완료 상태 변경"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg></button>
      <span></span>
    `;
    item.querySelector('span').textContent = todo.text;
    item.querySelector('button').addEventListener('click', () => {
      todo.done = !todo.done;
      saveTodos();
      renderNoteView();
    });
    list.appendChild(item);
  });

  content.appendChild(list);
}

function renderMoodboardNoteView(content, note) {
  const data = ensureMoodboard(note);
  const board = document.createElement('div');
  board.className = 'note-view-moodboard';

  data.items.forEach(item => {
    const element = document.createElement('div');
    element.className = `view-board-item ${item.type}`;
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
    element.style.width = `${item.width || 220}px`;
    element.style.height = item.height ? `${item.height}px` : 'auto';
    element.style.transform = `rotate(${item.rotation || 0}deg)`;

    if (item.type === 'image') {
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = '';
      element.appendChild(image);
    } else {
      element.textContent = item.text || '';
    }
    board.appendChild(element);
  });

  if (data.drawing) {
    const drawing = document.createElement('img');
    drawing.className = 'view-board-drawing';
    drawing.src = data.drawing;
    drawing.alt = '';
    board.appendChild(drawing);
  }

  if (!data.items.length && !data.drawing) {
    board.innerHTML = '<div class="note-view-memo" style="padding:30px">아직 무드보드에 추가된 내용이 없어요.</div>';
  }
  content.appendChild(board);
}

function renderLinkNoteView(content, note) {
  const data = ensureLinkData(note);
  let parsed = null;
  try { parsed = new URL(data.url); } catch (_error) { parsed = null; }

  const wrap = document.createElement('div');
  wrap.className = 'note-view-link';
  wrap.innerHTML = `
    ${data.category ? `<span class="note-view-category">${escapeHtml(data.category)}</span>` : ''}
    ${data.description ? `<p class="note-view-link-summary">${escapeHtml(data.description)}</p>` : ''}
    <a class="note-view-link-card" href="${parsed ? escapeHtml(parsed.href) : '#'}" ${parsed ? 'target="_blank" rel="noopener"' : ''}>
      ${parsed ? `<img src="${escapeHtml(parsed.origin)}/favicon.ico" alt="">` : ''}
      <span><strong>${escapeHtml(data.siteName || note.title || '저장된 링크')}</strong><small>${escapeHtml(parsed?.hostname || data.url || '')}</small></span>
      <b>사이트 열기 ↗</b>
    </a>
    ${data.memo ? `<div class="note-view-link-memo">${escapeHtml(data.memo)}</div>` : ''}
  `;
  content.appendChild(wrap);
}

function renderCollectionNoteView(content, note) {
  const data = ensureCollectionData(note);
  const wrap = document.createElement('div');
  wrap.className = 'note-view-collection';

  const cover = document.createElement('div');
  cover.className = 'note-view-collection-cover';
  cover.innerHTML = data.cover
    ? `<img src="${data.cover}" alt="${escapeHtml(note.title || '')}">`
    : '<div class="note-view-memo" style="padding:28px">등록된 대표 이미지가 없어요.</div>';

  const copy = document.createElement('div');
  copy.className = 'note-view-collection-copy';
  copy.innerHTML = `
    <span class="note-view-category">${escapeHtml(data.type || '기타')}</span>
    ${data.oneLine ? `<blockquote>${escapeHtml(data.oneLine)}</blockquote>` : ''}
    <dl class="note-view-info">
      ${data.fields.filter(field => field.label || field.value).map(field => `<div><dt>${escapeHtml(field.label || '정보')}</dt><dd>${escapeHtml(field.value || '-')}</dd></div>`).join('')}
    </dl>
    <div class="note-view-tags">${data.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="note-view-collection-body">${escapeHtml(data.content || '아직 작성된 내용이 없어요.')}</div>
  `;

  wrap.append(cover, copy);
  content.appendChild(wrap);
}

function closeNoteView() {
  currentNoteViewId = null;
  noteDetailView.hidden = true;
  setView(currentView);
}

$('#noteViewBackBtn').addEventListener('click', closeNoteView);
$('#noteViewEditBtn').addEventListener('click', () => {
  const noteId = currentNoteViewId;
  if (noteId) openEditor(noteId, true);
});
$('#noteViewStarBtn').addEventListener('click', () => {
  const note = getViewedNote();
  if (!note) return;
  note.starred = !note.starred;
  saveData();
  renderNoteView(note);
});
$('#noteViewFolderSelect').addEventListener('change', event => {
  const note = getViewedNote();
  if (!note) return;
  note.folderId = event.target.value;
  note.updatedAt = Date.now();
  saveData();
  renderNoteView(note);
});
$('#noteViewDeleteBtn').addEventListener('click', () => {
  const note = getViewedNote();
  if (!note || !confirm('이 자료를 삭제할까요?')) return;
  state.notes = state.notes.filter(item => item.id !== note.id);
  saveData();
  closeNoteView();
});
