'use strict';

/* ---------------- Template editor / Moodboard ---------------- */

let selectedMoodboardItemId = null;
let moodboardPenActive = false;
let moodboardSaveTimer = null;
let moodboardDrawing = false;
let moodboardLastPoint = null;
let moodboardHistoryNoteId = null;
let moodboardHistory = [];
let moodboardHistoryIndex = -1;

const MOODBOARD_SKINS = [
  'paper',
  'stripe-split',
  'dot-footer'
];

function getCurrentNote() {
  return state.notes.find(note => note.id === currentNoteId) || null;
}

function ensureMoodboard(note) {
  if (!note.moodboard) {
    note.moodboard = {
      items: [],
      drawing: '',
      skin: 'paper'
    };
  }
  if (!Array.isArray(note.moodboard.items)) {
    note.moodboard.items = [];
  }
  if (
    !MOODBOARD_SKINS.includes(
      note.moodboard.skin
    )
  ) {
    note.moodboard.skin = 'paper';
  }
  return note.moodboard;
}

function moodboardSnapshot(board) {
  return JSON.stringify({
    items: board.items,
    drawing: board.drawing || '',
    skin: board.skin || 'paper'
  });
}

function updateMoodboardHistoryButtons() {
  $('#moodboardUndoBtn').disabled =
    moodboardHistoryIndex <= 0;
  $('#moodboardRedoBtn').disabled =
    moodboardHistoryIndex
      >= moodboardHistory.length - 1;
}

function initializeMoodboardHistory(note) {
  if (
    moodboardHistoryNoteId
    === note.id
  ) {
    updateMoodboardHistoryButtons();
    return;
  }

  moodboardHistoryNoteId = note.id;
  moodboardHistory = [
    moodboardSnapshot(
      ensureMoodboard(note)
    )
  ];
  moodboardHistoryIndex = 0;
  updateMoodboardHistoryButtons();
}

function captureMoodboardHistory(note) {
  initializeMoodboardHistory(note);
  const snapshot =
    moodboardSnapshot(
      ensureMoodboard(note)
    );

  if (
    moodboardHistory[
      moodboardHistoryIndex
    ] === snapshot
  ) {
    return;
  }

  moodboardHistory =
    moodboardHistory.slice(
      0,
      moodboardHistoryIndex + 1
    );
  moodboardHistory.push(snapshot);

  if (moodboardHistory.length > 60) {
    moodboardHistory.shift();
  }

  moodboardHistoryIndex =
    moodboardHistory.length - 1;
  updateMoodboardHistoryButtons();
}

function restoreMoodboardHistory(
  offset
) {
  const note = getCurrentNote();
  if (
    !note
    || note.template !== 'moodboard'
  ) {
    return;
  }

  clearTimeout(moodboardSaveTimer);
  captureMoodboardHistory(note);

  const nextIndex =
    moodboardHistoryIndex + offset;

  if (
    nextIndex < 0
    || nextIndex
      >= moodboardHistory.length
  ) {
    updateMoodboardHistoryButtons();
    return;
  }

  moodboardHistoryIndex =
    nextIndex;
  note.moodboard =
    JSON.parse(
      moodboardHistory[
        moodboardHistoryIndex
      ]
    );
  selectedMoodboardItemId = null;
  note.updatedAt = Date.now();
  updateEditorMeta(note);
  saveData();
  renderMoodboard();
  updateMoodboardHistoryButtons();
}

const EDITOR_TEMPLATE_KEYS = [
  'memo',
  'todo',
  'moodboard',
  'links',
  'collection'
];

function resetNoteForTemplate(
  note,
  template
) {
  if (
    !note
    || !EDITOR_TEMPLATE_KEYS
      .includes(template)
  ) {
    return;
  }

  note.title = '';
  note.content = '';
  note.template = template;

  delete note.memoData;
  delete note.postitData;
  delete note.moodboard;
  delete note.linkData;
  delete note.collectionData;
  moodboardHistoryNoteId = null;
  moodboardHistory = [];
  moodboardHistoryIndex = -1;

  if (template === 'memo') {
    note.memoData = {
      html: '',
      skin: 'pink-grid',
      columns: 1
    };
  } else if (template === 'todo') {
    ensurePostitData(note);
  } else if (template === 'moodboard') {
    note.moodboard = {
      items: [],
      drawing: '',
      skin: 'paper'
    };
  } else if (template === 'links') {
    note.linkData = {
      url: '',
      siteName: '',
      description: '',
      category: ''
    };
  } else if (template === 'collection') {
    note.collectionData = {
      type: '책',
      cover: '',
      oneLine: '',
      tags: [],
      content: '',
      fields: []
    };
  }
}

function setEditorTemplate(template, updateNote = true) {
  const note = getCurrentNote();
  if (!note) return;
  const validTemplate =
    EDITOR_TEMPLATE_KEYS
      .includes(template);

  document.querySelectorAll('[data-editor-template]').forEach(tab => {
    tab.classList.toggle(
      'active',
      validTemplate
      && tab.dataset.editorTemplate
        === template
    );
  });

  memoEditorPanel.hidden =
    template !== 'memo';
  todoEditorPanel.hidden =
    template !== 'todo';
  moodboardEditorPanel.hidden =
    template !== 'moodboard';
  linkEditorPanel.hidden =
    template !== 'links';
  collectionEditorPanel.hidden =
    template !== 'collection';
  $('.editor-library-bar').hidden =
    !validTemplate;
  editorTemplateMessage.hidden =
    validTemplate;

  if (!validTemplate) {
    editorTemplateMessage.hidden = false;
    editorTemplateMessage.innerHTML = `
      <div class="editor-template-empty">
        <strong>작성할 템플릿을 선택해주세요.</strong>
        <span>위 인덱스를 누르면 빈 작성 화면이 열려요.</span>
      </div>
    `;
    return;
  }

  if (updateNote) {
    if (note.template !== template) {
      resetNoteForTemplate(
        note,
        template
      );
      noteTitle.value = '';
    }
    note.updatedAt = Date.now();
    saveData();
    updateEditorMeta(note);
  }

  if (template === 'todo') {
    renderPostitEditor(note);
  }

  if (template === 'memo') {
    renderMemoEditor(note);
  }

  if (template === 'moodboard') {
    ensureMoodboard(note);
    initializeMoodboardHistory(note);
    requestAnimationFrame(renderMoodboard);
  }

  if (template === 'links') renderLinkEditor();
  if (template === 'collection') renderCollectionEditor();
  renderTemplateLibraryBar(template);
}

function scheduleMoodboardSave() {
  clearTimeout(moodboardSaveTimer);
  moodboardSaveTimer = setTimeout(() => {
    const note = getCurrentNote();
    if (!note) return;
    captureMoodboardHistory(note);
    note.updatedAt = Date.now();
    updateEditorMeta(note);
    saveData();
  }, 350);
}

function renderMoodboard() {
  const note = getCurrentNote();
  if (!note || note.template !== 'moodboard') return;

  const board = ensureMoodboard(note);
  initializeMoodboardHistory(note);
  const canvasWrap =
    $('#moodboardCanvasWrap');
  canvasWrap.className =
    `moodboard-canvas-wrap moodboard-skin-${board.skin}`;

  document
    .querySelectorAll(
      '[data-moodboard-skin]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.moodboardSkin
          === board.skin
      );
    });
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

async function addMoodboardImages(
  files,
  dropPoint = null
) {
  const note = getCurrentNote();
  if (!note) return;
  const board = ensureMoodboard(note);
  const images = [...files].filter(file => file.type.startsWith('image/'));
  const baseX =
    dropPoint?.x ?? 35;
  const baseY =
    dropPoint?.y ?? 35;

  for (const [index, file] of images.entries()) {
    if (file.size > 8 * 1024 * 1024) continue;
    const src = await compressMoodboardImage(file);
    board.items.push({
      id: uid(),
      type: 'image',
      src,
      x: Math.max(
        0,
        Math.min(
          baseX + (index % 4) * 34,
          moodboardWrap.clientWidth - 250
        )
      ),
      y: Math.max(
        0,
        Math.min(
          baseY + (index % 4) * 34,
          moodboardWrap.clientHeight - 180
        )
      ),
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
$('#moodboardUndoBtn').addEventListener(
  'click',
  () => restoreMoodboardHistory(-1)
);
$('#moodboardRedoBtn').addEventListener(
  'click',
  () => restoreMoodboardHistory(1)
);
document
  .querySelectorAll(
    '[data-moodboard-skin]'
  )
  .forEach(button => {
    button.addEventListener(
      'click',
      () => {
        const note = getCurrentNote();
        if (!note) return;
        ensureMoodboard(note).skin =
          button.dataset.moodboardSkin;
        renderMoodboard();
        scheduleMoodboardSave();
      }
    );
  });
$('#moodboardDeleteItem').addEventListener('click', deleteSelectedMoodboardItem);
$('#moodboardClearDrawing').addEventListener('click', () => {
  const note = getCurrentNote();
  if (!note) return;
  ensureMoodboard(note).drawing = '';
  resizeMoodboardCanvas('');
  scheduleMoodboardSave();
});

const moodboardCanvas = $('#moodboardDrawingCanvas');
moodboardCanvas.addEventListener('pointerdown', beginMoodboardDrawing);
moodboardCanvas.addEventListener('pointermove', continueMoodboardDrawing);
moodboardCanvas.addEventListener('pointerup', endMoodboardDrawing);
moodboardCanvas.addEventListener('pointercancel', endMoodboardDrawing);

const moodboardWrap = $('#moodboardCanvasWrap');
 moodboardWrap.addEventListener('click', () => {
  selectMoodboardItem(null);
  moodboardWrap.focus({
    preventScroll: true
  });
});

bindImageDropTarget(
  moodboardWrap,
  (files, event) => {
    const bounds =
      moodboardWrap
        .getBoundingClientRect();

    return addMoodboardImages(
      files,
      {
        x: event.clientX
          - bounds.left
          - 125,
        y: event.clientY
          - bounds.top
          - 90
      }
    );
  },
  {
    activeClass: 'drag-over',
    onError: message =>
      alert(message)
  }
);

document.addEventListener('paste', event => {
  if (
    !moodboardEditorPanel.hidden
    && !event.defaultPrevented
  ) {
    const images =
      clipboardImageFiles(
        event.clipboardData
      );

    if (!images.length) return;

    event.preventDefault();
    addMoodboardImages(images);
  }
});

window.addEventListener('resize', () => {
  const note = getCurrentNote();
  if (note?.template === 'moodboard' && !moodboardEditorPanel.hidden) {
    resizeMoodboardCanvas(ensureMoodboard(note).drawing);
  }
});
