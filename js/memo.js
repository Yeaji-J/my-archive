'use strict';

/* ---------------- 01 Memo editor / album ---------------- */

const MEMO_SKINS = ['pink-grid', 'yellow-line', 'blue-dot', 'purple-grid'];
const MEMO_PAGE_SIZE = 12;
let memoSavedRange = null;
let memoDataSaveTimer = null;

function escapeMemoText(value) {
  return escapeHtml(String(value || ''))
    .replace(/\n/g, '<br>');
}

function ensureMemoData(note) {
  if (!note.memoData || typeof note.memoData !== 'object') {
    note.memoData = {
      html: note.content
        ? `<p>${escapeMemoText(note.content)}</p>`
        : '',
      skin: 'pink-grid',
      columns: 1
    };
  }

  if (!MEMO_SKINS.includes(note.memoData.skin)) {
    note.memoData.skin = 'pink-grid';
  }

  note.memoData.columns =
    Number(note.memoData.columns) === 2
      ? 2
      : 1;

  return note.memoData;
}

function sanitizeMemoHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const allowed = new Set([
    'P', 'DIV', 'BR', 'H3', 'SPAN',
    'STRONG', 'B', 'EM', 'I', 'U',
    'UL', 'OL', 'LI', 'IMG'
  ]);

  [...template.content.querySelectorAll('*')].forEach(element => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    [...element.attributes].forEach(attribute => {
      const keepClass =
        attribute.name === 'class'
        && element.tagName === 'SPAN'
        && element.classList.contains('memo-number-token');
      const keepImage =
        element.tagName === 'IMG'
        && ['src', 'alt'].includes(attribute.name)
        && (
          attribute.name !== 'src'
          || attribute.value.startsWith('data:image/')
        );
      const keepAlign =
        attribute.name === 'style'
        && /^(text-align:\s*(left|center);?\s*)$/i.test(attribute.value);
      const keepAlignAttribute =
        attribute.name === 'align'
        && ['left', 'center'].includes(
          attribute.value.toLowerCase()
        );
      const keepTokenLock =
        element.tagName === 'SPAN'
        && element.classList.contains('memo-number-token')
        && attribute.name === 'contenteditable'
        && attribute.value === 'false';

      if (
        !keepClass
        && !keepImage
        && !keepAlign
        && !keepAlignAttribute
        && !keepTokenLock
      ) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === 'IMG') {
      element.classList.add('memo-inline-image');
    }
  });

  return template.innerHTML;
}

function renderMemoEditor(note = getCurrentNote()) {
  if (!note) return;
  const memo = ensureMemoData(note);
  noteContent.innerHTML = sanitizeMemoHtml(memo.html);

  const skin = $('#memoEditorSkin');
  skin.className =
    `memo-editor-skin memo-skin-${memo.skin}`;
  skin.dataset.columns = String(memo.columns);

  document
    .querySelectorAll('[data-memo-columns]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        Number(button.dataset.memoColumns)
          === memo.columns
      );
    });

  document
    .querySelectorAll('[data-memo-skin]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.memoSkin === memo.skin
      );
    });
}

function persistMemoEditor(note = getCurrentNote()) {
  if (!note) return;
  const memo = ensureMemoData(note);
  memo.html = sanitizeMemoHtml(noteContent.innerHTML);
  note.content = (noteContent.textContent || '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function saveMemoSelection() {
  const selection = window.getSelection();
  if (
    !selection.rangeCount
    || !noteContent.contains(selection.anchorNode)
  ) {
    return;
  }
  memoSavedRange = selection.getRangeAt(0).cloneRange();
}

function restoreMemoSelection() {
  if (!memoSavedRange) {
    noteContent.focus();
    return;
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(memoSavedRange);
}

function runMemoCommand(command) {
  restoreMemoSelection();
  if (command === 'paragraph') {
    document.execCommand('formatBlock', false, 'p');
  } else if (command === 'subtitle') {
    document.execCommand('formatBlock', false, 'h3');
  } else if (command === 'left') {
    document.execCommand('justifyLeft');
  } else if (command === 'center') {
    document.execCommand('justifyCenter');
  } else if (command === 'bullet') {
    document.execCommand('insertText', false, '· ');
  }
  noteContent.focus();
  saveMemoSelection();
  persistMemoEditor();
  scheduleMemoSave();
}

function convertMemoNumberToken(event) {
  if (event.key !== ' ') return;
  const selection = window.getSelection();
  if (!selection.rangeCount || !selection.isCollapsed) return;
  const node = selection.anchorNode;
  const offset = selection.anchorOffset;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;

  const before = node.textContent.slice(0, offset);
  const match = before.match(/(?:^|\s)(\d{1,3})$/);
  if (!match) return;

  event.preventDefault();
  const range = document.createRange();
  range.setStart(node, offset - match[1].length);
  range.setEnd(node, offset);
  range.deleteContents();

  const token = document.createElement('span');
  token.className = 'memo-number-token';
  token.contentEditable = 'false';
  token.textContent = match[1];
  range.insertNode(token);

  const space = document.createTextNode('\u00a0');
  token.after(space);
  range.setStartAfter(space);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  saveMemoSelection();
  scheduleMemoSave();
}

function scheduleMemoSave() {
  clearTimeout(memoDataSaveTimer);
  memoDataSaveTimer = setTimeout(() => {
    const note = getCurrentNote();
    if (!note || (note.template || 'memo') !== 'memo') return;
    persistMemoEditor(note);
    note.updatedAt = Date.now();
    updateEditorMeta(note);
    saveData();
  }, 400);
}

function resizeMemoImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일이 아닙니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .82));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function insertMemoImages(files) {
  restoreMemoSelection();
  for (const file of files) {
    try {
      const src = await resizeMemoImage(file);
      restoreMemoSelection();
      document.execCommand(
        'insertHTML',
        false,
        `<img class="memo-inline-image" src="${src}" alt="">`
      );
      saveMemoSelection();
    } catch (error) {
      console.error('Memo image failed', error);
    }
  }
  persistMemoEditor();
  scheduleMemoSave();
}

function memoPreviewHtml(note) {
  const memo = ensureMemoData(note);
  const template = document.createElement('template');
  template.innerHTML = sanitizeMemoHtml(memo.html);
  const image = template.content.querySelector('img');
  const text = (
    template.content.textContent
    || note.content
    || '아직 작성된 내용이 없어요.'
  ).trim();

  return image
    ? `<img src="${image.src}" alt="">`
    : `<p>${escapeHtml(text.slice(0, 150))}</p>`;
}

function renderMemoAlbum(notes) {
  const pagination = $('#memoAlbumPagination');
  const totalPages = Math.max(
    1,
    Math.ceil(notes.length / MEMO_PAGE_SIZE)
  );
  memoAlbumPage = Math.min(
    Math.max(1, memoAlbumPage),
    totalPages
  );

  const start =
    (memoAlbumPage - 1) * MEMO_PAGE_SIZE;

  notes
    .slice(start, start + MEMO_PAGE_SIZE)
    .forEach(note => {
      const memo = ensureMemoData(note);
      const card = document.createElement('article');
      card.className =
        `memo-album-card memo-skin-${memo.skin}`;
      card.innerHTML = `
        <button class="memo-album-open" type="button">
          <span class="memo-album-preview">
            ${memoPreviewHtml(note)}
          </span>
          <span class="memo-album-copy">
            <strong>${escapeHtml(note.title || '제목 없음')}</strong>
            <small>${formatDate(note.updatedAt)}</small>
          </span>
        </button>
        <button
          class="memo-album-star ${note.starred ? 'active' : ''}"
          type="button"
          aria-label="${note.starred ? '즐겨찾기 해제' : '즐겨찾기 추가'}"
          title="${note.starred ? '즐겨찾기 해제' : '즐겨찾기 추가'}"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.6l1.4-6.6-5-4.6 6.6-.7z" />
          </svg>
        </button>
      `;
      card
        .querySelector('.memo-album-open')
        .addEventListener(
        'click',
        () => openNoteView(note.id)
      );
      card
        .querySelector('.memo-album-star')
        .addEventListener('click', () => {
          note.starred = !note.starred;
          saveData();
          renderCounts();
          renderFolderGridView();
        });
      noteGrid.appendChild(card);
    });

  pagination.hidden = notes.length === 0;
  pagination.innerHTML = `
    <button type="button" data-memo-page="${memoAlbumPage - 1}" ${memoAlbumPage === 1 ? 'disabled' : ''} aria-label="이전 페이지">‹</button>
    <span>${Array.from({ length: totalPages }, (_, index) => `
      <button type="button" class="${index + 1 === memoAlbumPage ? 'active' : ''}" data-memo-page="${index + 1}">${index + 1}</button>
    `).join('')}</span>
    <button type="button" data-memo-page="${memoAlbumPage + 1}" ${memoAlbumPage === totalPages ? 'disabled' : ''} aria-label="다음 페이지">›</button>
  `;

  pagination
    .querySelectorAll('[data-memo-page]')
    .forEach(button => {
      button.addEventListener('click', () => {
        memoAlbumPage = Number(button.dataset.memoPage);
        renderFolderGridView();
        folderGridView.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
}

document
  .querySelectorAll('[data-memo-command]')
  .forEach(button => {
    button.addEventListener(
      'mousedown',
      event => event.preventDefault()
    );
    button.addEventListener(
      'click',
      () => runMemoCommand(button.dataset.memoCommand)
    );
  });

document
  .querySelectorAll('[data-memo-columns]')
  .forEach(button => {
    button.addEventListener('click', () => {
      const note = getCurrentNote();
      if (!note) return;
      ensureMemoData(note).columns =
        Number(button.dataset.memoColumns);
      renderMemoEditor(note);
      scheduleMemoSave();
    });
  });

document
  .querySelectorAll('[data-memo-skin]')
  .forEach(button => {
    button.addEventListener('click', () => {
      const note = getCurrentNote();
      if (!note) return;
      ensureMemoData(note).skin =
        button.dataset.memoSkin;
      renderMemoEditor(note);
      scheduleMemoSave();
    });
  });

noteContent.addEventListener('keydown', convertMemoNumberToken);
noteContent.addEventListener('keyup', saveMemoSelection);
noteContent.addEventListener('mouseup', saveMemoSelection);
noteContent.addEventListener('focus', saveMemoSelection);
noteContent.addEventListener('input', () => {
  saveMemoSelection();
  scheduleMemoSave();
});
noteContent.addEventListener('paste', event => {
  event.preventDefault();
  document.execCommand(
    'insertText',
    false,
    event.clipboardData.getData('text/plain')
  );
});

$('#memoImageInput').addEventListener('change', event => {
  insertMemoImages([...event.target.files]);
  event.target.value = '';
});
