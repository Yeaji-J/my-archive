'use strict';

/* ---------------- Template editor / Moodboard ---------------- */

let selectedMoodboardItemId = null;
let moodboardPenActive = false;
let moodboardSaveTimer = null;
let moodboardDrawing = false;
let moodboardLastPoint = null;

function getCurrentNote() {
  return state.notes.find(note => note.id === currentNoteId) || null;
}

function ensureMoodboard(note) {
  if (!note.moodboard) {
    note.moodboard = { items: [], drawing: '' };
  }
  if (!Array.isArray(note.moodboard.items)) note.moodboard.items = [];
  return note.moodboard;
}

function setEditorTemplate(template, updateNote = true) {
  const note = getCurrentNote();
  if (!note) return;

  document.querySelectorAll('[data-editor-template]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.editorTemplate === template);
  });

  memoEditorPanel.hidden = template !== 'memo';
  todoEditorPanel.hidden = template !== 'todo';
  moodboardEditorPanel.hidden = template !== 'moodboard';
  linkEditorPanel.hidden = template !== 'links';
  collectionEditorPanel.hidden = template !== 'collection';
  editorTemplateMessage.hidden = !template.startsWith('blank');

  if (template.startsWith('blank')) {
    editorTemplateMessage.innerHTML = '<div><strong>아직 준비 중인 템플릿이에요.</strong><br><br>용도가 정해지면 이 인덱스에 연결할게요.</div>';
    return;
  }

  if (updateNote) {
    note.template = template;
    note.updatedAt = Date.now();
    saveData();
    updateEditorMeta(note);
  }

  if (template === 'todo') {
    if (!note.title) {
      note.title = '할 일';
      noteTitle.value = note.title;
    }
    renderEditorTodos();
  }

  if (template === 'moodboard') {
    ensureMoodboard(note);
    requestAnimationFrame(renderMoodboard);
  }

  if (template === 'links') renderLinkEditor();
  if (template === 'collection') renderCollectionEditor();
  renderTemplateLibraryBar(template);
}

function renderEditorTodos() {
  const list = $('#editorTodoList');
  const empty = $('#editorTodoEmpty');
  const remaining = todos.filter(todo => !todo.done).length;

  $('#editorTodoCount').textContent = remaining;
  empty.hidden = todos.length > 0;
  list.innerHTML = '';

  todos.forEach(todo => {
    const item = document.createElement('li');
    item.className = 'editor-todo-item' + (todo.done ? ' done' : '');
    item.innerHTML = `
      <button class="editor-todo-check" type="button" aria-label="완료 상태 변경">
        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg>
      </button>
      <span class="editor-todo-text"></span>
      <button class="editor-todo-delete" type="button" aria-label="삭제">×</button>
    `;
    item.querySelector('.editor-todo-text').textContent = todo.text;
    item.querySelector('.editor-todo-check').addEventListener('click', () => {
      todo.done = !todo.done;
      saveTodos();
      renderEditorTodos();
    });
    item.querySelector('.editor-todo-delete').addEventListener('click', () => {
      todos = todos.filter(current => current.id !== todo.id);
      saveTodos();
      renderEditorTodos();
    });
    list.appendChild(item);
  });
}

function scheduleMoodboardSave() {
  clearTimeout(moodboardSaveTimer);
  moodboardSaveTimer = setTimeout(() => {
    const note = getCurrentNote();
    if (!note) return;
    note.updatedAt = Date.now();
    updateEditorMeta(note);
    saveData();
  }, 350);
}

function renderMoodboard() {
  const note = getCurrentNote();
  if (!note || note.template !== 'moodboard') return;

  const board = ensureMoodboard(note);
  const itemsWrap = $('#moodboardItems');
  itemsWrap.innerHTML = '';

  board.items.forEach(item => {
    const element = document.createElement('div');
    element.className = `moodboard-item ${item.type}` + (item.id === selectedMoodboardItemId ? ' selected' : '');
    element.dataset.itemId = item.id;
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
    element.style.width = `${item.width || (item.type === 'image' ? 240 : 220)}px`;
    element.style.height = item.height ? `${item.height}px` : 'auto';
    element.style.transform = `rotate(${item.rotation || 0}deg)`;

    if (item.type === 'image') {
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = '';
      element.appendChild(image);
    } else {
      element.contentEditable = 'true';
      element.spellcheck = false;
      element.textContent = item.text || '텍스트를 입력하세요';
      element.addEventListener('input', () => {
        item.text = element.textContent;
        scheduleMoodboardSave();
      });
    }

    makeMoodboardItemDraggable(element, item);
    element.addEventListener('click', event => {
      event.stopPropagation();
      selectMoodboardItem(item.id);
    });
    element.addEventListener('pointerup', () => {
      item.width = element.offsetWidth;
      item.height = element.offsetHeight;
      scheduleMoodboardSave();
    });

    itemsWrap.appendChild(element);
  });

  $('#moodboardGuide').hidden = board.items.length > 0 || Boolean(board.drawing);
  resizeMoodboardCanvas(board.drawing);
}

function selectMoodboardItem(itemId) {
  selectedMoodboardItemId = itemId;
  document.querySelectorAll('.moodboard-item').forEach(element => {
    element.classList.toggle('selected', element.dataset.itemId === itemId);
  });
}

function makeMoodboardItemDraggable(element, item) {
  element.addEventListener('pointerdown', event => {
    if (moodboardPenActive || event.button !== 0) return;
    const elementRect = element.getBoundingClientRect();
    const onResizeHandle =
      event.clientX > elementRect.right - 20
      && event.clientY > elementRect.bottom - 20;
    if (onResizeHandle) return;
    selectMoodboardItem(item.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = item.x;
    const originalY = item.y;
    const boardRect = $('#moodboardCanvasWrap').getBoundingClientRect();

    element.setPointerCapture(event.pointerId);
    element.style.cursor = 'grabbing';

    const move = moveEvent => {
      const maxX = Math.max(0, boardRect.width - element.offsetWidth);
      const maxY = Math.max(0, boardRect.height - element.offsetHeight);
      item.x = Math.min(maxX, Math.max(0, originalX + moveEvent.clientX - startX));
      item.y = Math.min(maxY, Math.max(0, originalY + moveEvent.clientY - startY));
      element.style.left = `${item.x}px`;
      element.style.top = `${item.y}px`;
    };

    const end = () => {
      element.style.cursor = '';
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', end);
      scheduleMoodboardSave();
    };

    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', end);
  });
}

async function addMoodboardImages(files) {
  const note = getCurrentNote();
  if (!note) return;
  const board = ensureMoodboard(note);
  const images = [...files].filter(file => file.type.startsWith('image/'));

  for (const [index, file] of images.entries()) {
    if (file.size > 8 * 1024 * 1024) continue;
    const src = await compressMoodboardImage(file);
    board.items.push({
      id: uid(),
      type: 'image',
      src,
      x: 35 + (index % 4) * 34,
      y: 35 + (index % 4) * 34,
      width: 250,
      height: 180,
      rotation: (index % 3 - 1) * 2
    });
  }

  scheduleMoodboardSave();
  renderMoodboard();
}

function compressMoodboardImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const limit = 1600;
        const scale = Math.min(1, limit / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addMoodboardText() {
  const note = getCurrentNote();
  if (!note) return;
  const board = ensureMoodboard(note);
  const item = { id: uid(), type: 'text', text: '텍스트를 입력하세요', x: 70, y: 70, width: 220, height: 70, rotation: 0 };
  board.items.push(item);
  selectedMoodboardItemId = item.id;
  scheduleMoodboardSave();
  renderMoodboard();
}

function deleteSelectedMoodboardItem() {
  const note = getCurrentNote();
  if (!note || !selectedMoodboardItemId) return;
  const board = ensureMoodboard(note);
  board.items = board.items.filter(item => item.id !== selectedMoodboardItemId);
  selectedMoodboardItemId = null;
  scheduleMoodboardSave();
  renderMoodboard();
}

function resizeMoodboardCanvas(savedDrawing = '') {
  const canvas = $('#moodboardDrawingCanvas');
  const wrap = $('#moodboardCanvasWrap');
  const width = Math.max(1, Math.round(wrap.clientWidth));
  const height = Math.max(1, Math.round(wrap.clientHeight));
  canvas.width = width;
  canvas.height = height;

  if (savedDrawing) {
    const image = new Image();
    image.onload = () => canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    image.src = savedDrawing;
  }
}

function toggleMoodboardPen() {
  moodboardPenActive = !moodboardPenActive;
  $('#moodboardPenBtn').classList.toggle('active', moodboardPenActive);
  $('#moodboardDrawingCanvas').classList.toggle('drawing', moodboardPenActive);
  selectedMoodboardItemId = null;
  document.querySelectorAll('.moodboard-item').forEach(item => item.classList.remove('selected'));
}

function moodboardCanvasPoint(event) {
  const canvas = $('#moodboardDrawingCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

function beginMoodboardDrawing(event) {
  if (!moodboardPenActive) return;
  moodboardDrawing = true;
  moodboardLastPoint = moodboardCanvasPoint(event);
  event.currentTarget.setPointerCapture(event.pointerId);
}

function continueMoodboardDrawing(event) {
  if (!moodboardDrawing) return;
  const canvas = $('#moodboardDrawingCanvas');
  const point = moodboardCanvasPoint(event);
  const context = canvas.getContext('2d');
  context.beginPath();
  context.moveTo(moodboardLastPoint.x, moodboardLastPoint.y);
  context.lineTo(point.x, point.y);
  context.strokeStyle = $('#moodboardPenColor').value;
  context.lineWidth = Number($('#moodboardPenWidth').value);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
  moodboardLastPoint = point;
}

function endMoodboardDrawing() {
  if (!moodboardDrawing) return;
  moodboardDrawing = false;
  const note = getCurrentNote();
  if (!note) return;
  ensureMoodboard(note).drawing = $('#moodboardDrawingCanvas').toDataURL('image/png');
  $('#moodboardGuide').hidden = true;
  scheduleMoodboardSave();
}

document.querySelectorAll('[data-editor-template]').forEach(tab => {
  tab.addEventListener('click', () => setEditorTemplate(tab.dataset.editorTemplate));
});

$('#moodboardImageInput').addEventListener('change', event => addMoodboardImages(event.target.files));
$('#moodboardTextBtn').addEventListener('click', addMoodboardText);
$('#moodboardPenBtn').addEventListener('click', toggleMoodboardPen);
$('#moodboardDeleteItem').addEventListener('click', deleteSelectedMoodboardItem);
$('#moodboardClearDrawing').addEventListener('click', () => {
  const note = getCurrentNote();
  if (!note) return;
  ensureMoodboard(note).drawing = '';
  resizeMoodboardCanvas('');
  scheduleMoodboardSave();
});

$('#editorTodoForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#editorTodoInput');
  const text = input.value.trim();
  if (!text) return;
  todos.unshift({ id: uid(), text, done: false });
  input.value = '';
  saveTodos();
  renderEditorTodos();
});

const moodboardCanvas = $('#moodboardDrawingCanvas');
moodboardCanvas.addEventListener('pointerdown', beginMoodboardDrawing);
moodboardCanvas.addEventListener('pointermove', continueMoodboardDrawing);
moodboardCanvas.addEventListener('pointerup', endMoodboardDrawing);
moodboardCanvas.addEventListener('pointercancel', endMoodboardDrawing);

const moodboardWrap = $('#moodboardCanvasWrap');
moodboardWrap.addEventListener('click', () => selectMoodboardItem(null));
moodboardWrap.addEventListener('dragover', event => {
  event.preventDefault();
  moodboardWrap.classList.add('drag-over');
});
moodboardWrap.addEventListener('dragleave', () => moodboardWrap.classList.remove('drag-over'));
moodboardWrap.addEventListener('drop', event => {
  event.preventDefault();
  moodboardWrap.classList.remove('drag-over');
  addMoodboardImages(event.dataTransfer.files);
});

window.addEventListener('resize', () => {
  const note = getCurrentNote();
  if (note?.template === 'moodboard' && !moodboardEditorPanel.hidden) {
    resizeMoodboardCanvas(ensureMoodboard(note).drawing);
  }
});
