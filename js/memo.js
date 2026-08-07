'use strict';

/* ---------------- 01 Memo editor / album ---------------- */

const MEMO_SKINS = ['pink-grid', 'yellow-line', 'blue-dot', 'purple-grid'];
const MEMO_PAGE_SIZE = 12;
const MEMO_FONT_KEYS = [
  'pretendard',
  'lee-seoyun',
  'gowun-dodum',
  'gowun-batang',
  'nanum-pen',
  'gaegu',
  'dongle',
  'black-han',
  'song-myung'
];
const MEMO_FONT_FACES = {
  pretendard: 'Pretendard',
  'lee-seoyun': 'IsYun',
  'gowun-dodum': 'Gowun Dodum',
  'gowun-batang': 'Gowun Batang',
  'nanum-pen': 'Nanum Pen Script',
  gaegu: 'Gaegu',
  dongle: 'Dongle',
  'black-han': 'Black Han Sans',
  'song-myung': 'Song Myung'
};
const MEMO_FONT_SIZES = [
  12, 14, 15, 16, 18, 20, 24
];
const MEMO_FONT_MARKER_PREFIX =
  'archive-memo-font-';
let memoSavedRange = null;
let memoDataSaveTimer = null;
let memoPendingFontSize = 15;
let memoPendingFontFamily = 'pretendard';
let memoAltCodeDigits = '';
let memoDraggedBlock = null;
let memoDropTarget = null;
let memoDropZone = '';
let memoBlockObserver = null;
let memoPointerId = null;

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

function normalizeMemoUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = /^www\./i.test(raw)
    ? `https://${raw}`
    : raw;

  try {
    const url = new URL(candidate);
    return ['http:', 'https:', 'mailto:']
      .includes(url.protocol)
      ? url.href
      : '';
  } catch (_error) {
    return '';
  }
}

function replaceMemoFontElement(
  element,
  options = {}
) {
  const span = document.createElement('span');
  const face =
    String(element.getAttribute('face') || '');
  const markerIndex =
    face.indexOf(MEMO_FONT_MARKER_PREFIX);
  const fontKey =
    options.fontKey
    || (
      markerIndex >= 0
        ? face.slice(
            markerIndex
            + MEMO_FONT_MARKER_PREFIX.length
          ).replace(/["']/g, '')
        : ''
    )
    || Object.keys(MEMO_FONT_FACES)
      .find(key =>
        face.replace(/["']/g, '')
          .split(',')[0]
          .trim()
        === MEMO_FONT_FACES[key]
      );
  const legacySizes = {
    1: 12,
    2: 12,
    3: 14,
    4: 16,
    5: 18,
    6: 20,
    7: 24
  };
  const fontSize = Number(
    options.fontSize
    || parseInt(element.style.fontSize, 10)
    || legacySizes[
      Number(element.getAttribute('size'))
    ]
  );

  if (MEMO_FONT_KEYS.includes(fontKey)) {
    span.dataset.memoFont = fontKey;
  }
  if (MEMO_FONT_SIZES.includes(fontSize)) {
    span.dataset.memoSize = String(fontSize);
  }

  span.append(...element.childNodes);
  element.replaceWith(span);
  return span;
}

function normalizeMemoCommandMarkup(
  root = noteContent,
  options = {}
) {
  root
    .querySelectorAll('font')
    .forEach(element =>
      replaceMemoFontElement(
        element,
        options
      )
    );
}

function sanitizeMemoHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  template.content
    .querySelectorAll('.memo-block-handle')
    .forEach(handle => handle.remove());
  normalizeMemoCommandMarkup(
    template.content
  );

  const allowed = new Set([
    'P', 'DIV', 'BR', 'H3', 'SPAN',
    'STRONG', 'B', 'EM', 'I', 'U',
    'S', 'STRIKE', 'A',
    'UL', 'OL', 'LI', 'IMG'
  ]);

  [...template.content.querySelectorAll('*')]
    .forEach(element => {
      if (!allowed.has(element.tagName)) {
        element.replaceWith(
          ...element.childNodes
        );
        return;
      }

      if (element.tagName === 'A') {
        const href = normalizeMemoUrl(
          element.getAttribute('href')
        );

        if (!href) {
          element.replaceWith(
            ...element.childNodes
          );
          return;
        }

        element.setAttribute('href', href);
        element.setAttribute('target', '_blank');
        element.setAttribute(
          'rel',
          'noopener noreferrer'
        );
      }

      const textAlign =
        ['left', 'center'].includes(
          element.style.textAlign
        )
          ? element.style.textAlign
          : '';
      const lineThrough =
        element.style.textDecoration
          .includes('line-through')
        || element.style.textDecorationLine
          .includes('line-through');
      element.removeAttribute('style');

      if (textAlign) {
        element.style.textAlign =
          textAlign;
      }
      if (
        lineThrough
        && element.tagName === 'SPAN'
      ) {
        element.style.textDecoration =
          'line-through';
      }

      [...element.attributes]
        .forEach(attribute => {
          const keepClass =
            attribute.name === 'class'
            && (
              (
                element.tagName === 'SPAN'
                && element.classList
                  .contains(
                    'memo-number-token'
                  )
              )
              || (
                element.tagName === 'DIV'
                && (
                  element.classList
                    .contains(
                      'memo-block-row'
                    )
                  || element.classList
                    .contains(
                      'memo-block-column'
                    )
                )
              )
            );
          const keepImage =
            element.tagName === 'IMG'
            && ['src', 'alt']
              .includes(attribute.name)
            && (
              attribute.name !== 'src'
              || attribute.value
                .startsWith('data:image/')
            );
          const keepStyle =
            attribute.name === 'style'
            && Boolean(
              element.getAttribute('style')
            );
          const keepAlignAttribute =
            attribute.name === 'align'
            && ['left', 'center'].includes(
              attribute.value.toLowerCase()
            );
          const keepTokenLock =
            element.tagName === 'SPAN'
            && element.classList
              .contains(
                'memo-number-token'
              )
            && attribute.name
              === 'contenteditable'
            && attribute.value === 'false';
          const keepMemoFont =
            element.tagName === 'SPAN'
            && attribute.name
              === 'data-memo-font'
            && MEMO_FONT_KEYS.includes(
              attribute.value
            );
          const keepMemoSize =
            element.tagName === 'SPAN'
            && attribute.name
              === 'data-memo-size'
            && MEMO_FONT_SIZES.includes(
              Number(attribute.value)
            );
          const keepLink =
            element.tagName === 'A'
            && ['href', 'target', 'rel']
              .includes(attribute.name);

          if (
            !keepClass
            && !keepImage
            && !keepStyle
            && !keepAlignAttribute
            && !keepTokenLock
            && !keepMemoFont
            && !keepMemoSize
            && !keepLink
          ) {
            element.removeAttribute(
              attribute.name
            );
          }
        });

      if (element.tagName === 'IMG') {
        element.classList.add(
          'memo-inline-image'
        );
      }
    });

  let looseParagraph = null;
  [...template.content.childNodes]
    .forEach(node => {
      const isBlock =
        node.nodeType === Node.ELEMENT_NODE
        && ['P', 'DIV', 'H3', 'UL', 'OL']
          .includes(node.tagName);

      if (isBlock) {
        looseParagraph = null;
        return;
      }

      if (
        node.nodeType === Node.TEXT_NODE
        && !node.textContent.trim()
      ) {
        node.remove();
        return;
      }

      if (!looseParagraph) {
        looseParagraph =
          document.createElement('p');
        node.before(looseParagraph);
      }
      looseParagraph.appendChild(node);
    });

  return template.innerHTML;
}

function renderMemoEditor(note = getCurrentNote()) {
  if (!note) return;
  const memo = ensureMemoData(note);
  noteContent.innerHTML =
    sanitizeMemoHtml(memo.html)
    || '<p><br></p>';

  const skin = $('#memoEditorSkin');
  skin.className =
    `memo-editor-skin memo-skin-${memo.skin}`;
  skin.removeAttribute('data-columns');

  document
    .querySelectorAll('[data-memo-skin]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.memoSkin === memo.skin
      );
    });

  decorateMemoBlocks();
}

function persistMemoEditor(note = getCurrentNote()) {
  if (!note) return;
  const memo = ensureMemoData(note);
  const cleanHtml =
    sanitizeMemoHtml(noteContent.innerHTML);
  const template =
    document.createElement('template');
  template.innerHTML = cleanHtml;
  memo.html = cleanHtml;
  note.content = (
    template.content.textContent || ''
  )
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

function memoSelectionRange() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return noteContent.contains(
    range.commonAncestorContainer
  )
    ? range
    : null;
}

function refreshMemoLinks() {
  noteContent
    .querySelectorAll('a[href]')
    .forEach(link => {
      const href = normalizeMemoUrl(
        link.getAttribute('href')
      );

      if (!href) {
        link.replaceWith(...link.childNodes);
        return;
      }

      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
}

function applyMemoLink(value) {
  restoreMemoSelection();
  const range = memoSelectionRange();
  const href = normalizeMemoUrl(value);

  if (
    !range
    || range.collapsed
    || !href
  ) {
    return false;
  }

  document.execCommand(
    'createLink',
    false,
    href
  );
  refreshMemoLinks();
  saveMemoSelection();
  persistMemoEditor();
  scheduleMemoSave();
  return true;
}

function promptMemoLink() {
  restoreMemoSelection();
  const range = memoSelectionRange();

  if (!range || range.collapsed) {
    alert('링크를 걸 글씨를 먼저 선택해주세요.');
    return;
  }

  const value = prompt(
    '연결할 링크를 입력해주세요.',
    'https://'
  );

  if (value === null) return;
  if (!applyMemoLink(value)) {
    alert('http 또는 https 링크를 확인해주세요.');
  }
}

function applyMemoFontFamily(value) {
  const key = MEMO_FONT_KEYS.includes(value)
    ? value
    : 'pretendard';
  memoPendingFontFamily = key;
  restoreMemoSelection();
  const range = memoSelectionRange();
  document.execCommand(
    'fontName',
    false,
    MEMO_FONT_FACES[key]
  );
  if (range?.collapsed) {
    document.execCommand(
      'fontSize',
      false,
      '7'
    );
    applyPendingMemoFontSizeMarkup();
  }
  noteContent.focus();
  saveMemoSelection();
  scheduleMemoSave();
}

function applyMemoFontSize(value) {
  const size = Number(value);
  if (!MEMO_FONT_SIZES.includes(size)) {
    return;
  }

  memoPendingFontSize = size;
  restoreMemoSelection();
  const range = memoSelectionRange();
  if (range?.collapsed) {
    document.execCommand(
      'fontName',
      false,
      MEMO_FONT_FACES[
        memoPendingFontFamily
      ]
    );
  }
  document.execCommand(
    'fontSize',
    false,
    '7'
  );
  applyPendingMemoFontSizeMarkup();
  noteContent.focus();
  saveMemoSelection();
  scheduleMemoSave();
}

function applyPendingMemoFontSizeMarkup() {
  noteContent
    .querySelectorAll('font[size="7"]')
    .forEach(element => {
      element.style.fontSize =
        `${memoPendingFontSize}px`;
      element.removeAttribute('size');
    });
}

function replaceMemoSelectedBlocks(
  tagName
) {
  const selection =
    window.getSelection();

  if (
    !selection.rangeCount
    || selection.isCollapsed
  ) {
    return false;
  }

  const range =
    selection.getRangeAt(0);
  const candidates = [
    ...noteContent
      .querySelectorAll(
        'p, h3, div'
      )
  ].filter(element => {
    if (
      element.classList.contains(
        'memo-block-row'
      )
      || element.classList.contains(
        'memo-block-column'
      )
    ) {
      return false;
    }

    try {
      return range.intersectsNode(
        element
      );
    } catch (_error) {
      return false;
    }
  });

  const blocks =
    candidates.filter(
      element =>
        !candidates.some(
          other =>
            other !== element
            && element.contains(other)
        )
    );

  if (!blocks.length) {
    return false;
  }

  const replacements =
    blocks.map(block => {
      if (
        block.tagName
        === tagName.toUpperCase()
      ) {
        return block;
      }

      const replacement =
        document.createElement(
          tagName
        );
      replacement.innerHTML =
        block.innerHTML;

      const alignment =
        block.style.textAlign
        || block.getAttribute('align');

      if (
        alignment === 'left'
        || alignment === 'center'
      ) {
        replacement.style.textAlign =
          alignment;
      }

      block.replaceWith(replacement);
      return replacement;
    });

  const nextRange =
    document.createRange();
  nextRange.setStart(
    replacements[0],
    0
  );
  nextRange.setEnd(
    replacements[
      replacements.length - 1
    ],
    replacements[
      replacements.length - 1
    ].childNodes.length
  );

  selection.removeAllRanges();
  selection.addRange(nextRange);
  memoSavedRange =
    nextRange.cloneRange();

  return true;
}

function runMemoCommand(command) {
  restoreMemoSelection();
  if (command === 'paragraph') {
    if (
      !replaceMemoSelectedBlocks('p')
    ) {
      document.execCommand(
        'formatBlock',
        false,
        'p'
      );
    }
  } else if (command === 'subtitle') {
    if (
      !replaceMemoSelectedBlocks('h3')
    ) {
      document.execCommand(
        'formatBlock',
        false,
        'h3'
      );
    }
  } else if (command === 'left') {
    document.execCommand('justifyLeft');
  } else if (command === 'center') {
    document.execCommand('justifyCenter');
  } else if (command === 'bold') {
    document.execCommand('bold');
  } else if (command === 'strike') {
    document.execCommand('strikeThrough');
  } else if (command === 'link') {
    promptMemoLink();
    return;
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

function insertMemoParagraph(event) {
  if (
    event.key !== 'Enter'
    || event.shiftKey
    || event.ctrlKey
    || event.metaKey
    || event.altKey
  ) {
    return false;
  }

  event.preventDefault();
  document.execCommand(
    'defaultParagraphSeparator',
    false,
    'p'
  );
  document.execCommand(
    'insertParagraph',
    false
  );
  decorateMemoBlocks();
  saveMemoSelection();
  scheduleMemoSave();
  return true;
}

function memoEditableBlocks() {
  const blocks = [];

  [...noteContent.children]
    .forEach(child => {
      if (
        child.classList.contains(
          'memo-block-row'
        )
      ) {
        child
          .querySelectorAll(
            ':scope > .memo-block-column'
          )
          .forEach(column => {
            blocks.push(
              ...[...column.children]
                .filter(element =>
                  element.matches(
                    'p, h3, div'
                  )
                  && !element.classList
                    .contains(
                      'memo-block-row'
                    )
                  && !element.classList
                    .contains(
                      'memo-block-column'
                    )
                )
            );
          });
        return;
      }

      if (
        child.matches('p, h3, div')
        && !child.classList.contains(
          'memo-block-column'
        )
      ) {
        blocks.push(child);
      }
    });

  return blocks;
}

function decorateMemoBlocks() {
  const structuralParents = [
    noteContent,
    ...noteContent.querySelectorAll(
      '.memo-block-column'
    )
  ];

  structuralParents.forEach(parent => {
    [...parent.children]
      .filter(element =>
        element.tagName === 'IMG'
      )
      .forEach(image => {
        const wrapper =
          document.createElement('div');
        image.replaceWith(wrapper);
        wrapper.appendChild(image);
      });
  });

  memoEditableBlocks().forEach(block => {
    block.classList.add(
      'memo-editor-block'
    );

    if (
      block.querySelector(
        ':scope > .memo-block-handle'
      )
    ) {
      return;
    }

    const handle =
      document.createElement('span');
    handle.className =
      'memo-block-handle';
    handle.contentEditable = 'false';
    handle.draggable = false;
    handle.tabIndex = 0;
    handle.setAttribute(
      'role',
      'button'
    );
    handle.setAttribute(
      'aria-label',
      '블록 이동'
    );
    handle.title =
      '끌어서 순서 또는 단 구성 변경';
    handle.textContent = '⋮⋮';
    block.prepend(handle);
  });
}

function memoBlockFromTarget(target) {
  const block = target instanceof Element
    ? target.closest('.memo-editor-block')
    : null;

  return block
    && noteContent.contains(block)
      ? block
      : null;
}

function clearMemoDropTarget() {
  if (memoDropTarget) {
    memoDropTarget.classList.remove(
      'drop-before',
      'drop-after',
      'drop-left',
      'drop-right'
    );
  }
  memoDropTarget = null;
  memoDropZone = '';
}

function memoDropZoneForEvent(
  block,
  event
) {
  const bounds =
    block.getBoundingClientRect();
  const horizontalRatio =
    (event.clientX - bounds.left)
    / Math.max(1, bounds.width);

  if (horizontalRatio < .24) {
    return 'left';
  }
  if (horizontalRatio > .76) {
    return 'right';
  }

  return event.clientY
    < bounds.top + bounds.height / 2
      ? 'before'
      : 'after';
}

function cleanupMemoBlockRow(row) {
  if (
    !row
    || !row.classList.contains(
      'memo-block-row'
    )
  ) {
    return;
  }

  [...row.children]
    .filter(column =>
      column.classList.contains(
        'memo-block-column'
      )
      && !memoEditableBlocksInColumn(
        column
      ).length
    )
    .forEach(column => column.remove());

  const columns = [
    ...row.querySelectorAll(
      ':scope > .memo-block-column'
    )
  ];

  if (columns.length !== 1) return;

  const column = columns[0];
  while (column.firstChild) {
    row.before(column.firstChild);
  }
  row.remove();
}

function memoEditableBlocksInColumn(
  column
) {
  return [...column.children]
    .filter(element =>
      element.classList.contains(
        'memo-editor-block'
      )
    );
}

function moveMemoBlock(
  dragged,
  target,
  zone
) {
  if (
    !dragged
    || !target
    || dragged === target
  ) {
    return;
  }

  const sourceColumn =
    dragged.closest(
      '.memo-block-column'
    );
  const sourceRow = sourceColumn
    ?.closest('.memo-block-row');

  if (zone === 'left' || zone === 'right') {
    const targetColumn =
      target.closest(
        '.memo-block-column'
      );
    const newColumn =
      document.createElement('div');
    newColumn.className =
      'memo-block-column';
    newColumn.appendChild(dragged);

    if (targetColumn) {
      const row = targetColumn.closest(
        '.memo-block-row'
      );
      row.insertBefore(
        newColumn,
        zone === 'left'
          ? targetColumn
          : targetColumn.nextSibling
      );
    } else {
      const row =
        document.createElement('div');
      const targetColumnNew =
        document.createElement('div');
      row.className = 'memo-block-row';
      targetColumnNew.className =
        'memo-block-column';
      target.replaceWith(row);
      targetColumnNew.appendChild(target);

      if (zone === 'left') {
        row.append(
          newColumn,
          targetColumnNew
        );
      } else {
        row.append(
          targetColumnNew,
          newColumn
        );
      }
    }
  } else {
    target.parentNode.insertBefore(
      dragged,
      zone === 'before'
        ? target
        : target.nextSibling
    );
  }

  cleanupMemoBlockRow(sourceRow);
  decorateMemoBlocks();
  persistMemoEditor();
  scheduleMemoSave();
}

function handleMemoShortcuts(event) {
  const primary =
    event.ctrlKey || event.metaKey;

  if (
    primary
    && event.key.toLowerCase() === 'b'
  ) {
    event.preventDefault();
    saveMemoSelection();
    runMemoCommand('bold');
    return true;
  }

  if (
    primary
    && event.shiftKey
    && event.key.toLowerCase() === 'x'
  ) {
    event.preventDefault();
    saveMemoSelection();
    runMemoCommand('strike');
    return true;
  }

  if (
    primary
    && event.key.toLowerCase() === 'k'
  ) {
    event.preventDefault();
    saveMemoSelection();
    promptMemoLink();
    return true;
  }

  const digitMatch = event.code.match(
    /^(?:Numpad|Digit)(\d)$/
  );
  if (event.altKey && digitMatch) {
    event.preventDefault();
    memoAltCodeDigits += digitMatch[1];
    memoAltCodeDigits =
      memoAltCodeDigits.slice(-3);
    return true;
  }

  return false;
}

function finishMemoAltCode(event) {
  if (event.key !== 'Alt') return;
  const code = memoAltCodeDigits;
  memoAltCodeDigits = '';

  if (code !== '183') return;

  noteContent.focus();
  document.execCommand(
    'insertText',
    false,
    '·'
  );
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
        const max = 1200;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(
          canvas.toDataURL(
            'image/jpeg',
            .76
          )
        );
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

  return image
    ? `<img src="${image.src}" alt="">`
    : `
      <div class="memo-album-preview-content">
        ${
          template.innerHTML.trim()
          || '<p>아직 작성된 내용이 없어요.</p>'
        }
      </div>
    `;
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
        `memo-album-card memo-skin-${memo.skin}`
        + (
          archiveSelectionMode
            ? ' selection-mode'
            : ''
        )
        + (
          selectedArchiveNoteIds.has(note.id)
            ? ' selected'
            : ''
        );
      card.style.setProperty(
        '--archive-note-font',
        typeof archiveFontStack
          === 'function'
          ? archiveFontStack(noteFontKey(note))
          : '"Pretendard", sans-serif'
      );
      card.innerHTML = `
        ${
          archiveSelectionMode
            ? archiveSelectionButton(note.id)
            : ''
        }
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
        () => {
          if (archiveSelectionMode) {
            toggleArchiveNoteSelection(
              note.id
            );
            return;
          }

          openNoteView(note.id);
        }
      );
      card
        .querySelector(
          '[data-note-select]'
        )
        ?.addEventListener(
          'click',
          event => {
            event.stopPropagation();
            toggleArchiveNoteSelection(
              note.id
            );
          }
        );
      card
        .querySelector('.memo-album-star')
        .addEventListener('click', () => {
          if (archiveSelectionMode) {
            toggleArchiveNoteSelection(
              note.id
            );
            return;
          }

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

$('#memoFontFamilySelect')
  ?.addEventListener(
    'pointerdown',
    saveMemoSelection
  );
$('#memoFontFamilySelect')
  ?.addEventListener(
    'change',
    event => applyMemoFontFamily(
      event.target.value
    )
  );
$('#memoFontSizeSelect')
  ?.addEventListener(
    'pointerdown',
    saveMemoSelection
  );
$('#memoFontSizeSelect')
  ?.addEventListener(
    'change',
    event => applyMemoFontSize(
      event.target.value
    )
  );

noteContent.addEventListener(
  'keydown',
  event => {
    if (handleMemoShortcuts(event)) {
      return;
    }
    if (insertMemoParagraph(event)) {
      return;
    }
    convertMemoNumberToken(event);
  }
);
noteContent.addEventListener(
  'keyup',
  event => {
    finishMemoAltCode(event);
    saveMemoSelection();
  }
);
noteContent.addEventListener('mouseup', saveMemoSelection);
noteContent.addEventListener('focus', saveMemoSelection);
noteContent.addEventListener('input', () => {
  applyPendingMemoFontSizeMarkup();
  normalizeMemoCommandMarkup(
    noteContent
  );
  decorateMemoBlocks();
  saveMemoSelection();
  scheduleMemoSave();
});
noteContent.addEventListener('paste', event => {
  const images =
    clipboardImageFiles(
      event.clipboardData
    );

  if (images.length) {
    event.preventDefault();
    insertMemoImages(images);
    return;
  }

  const text =
    event.clipboardData
      .getData('text/plain');
  const href = normalizeMemoUrl(text);
  const range = memoSelectionRange();

  if (
    href
    && range
    && !range.collapsed
  ) {
    event.preventDefault();
    memoSavedRange = range.cloneRange();
    applyMemoLink(href);
    return;
  }

  event.preventDefault();
  document.execCommand(
    'insertText',
    false,
    text
  );
});

noteContent.addEventListener(
  'pointerdown',
  event => {
    const handle = event.target.closest(
      '.memo-block-handle'
    );
    if (!handle || event.button !== 0) return;

    memoDraggedBlock =
      memoBlockFromTarget(handle);
    if (!memoDraggedBlock) return;

    event.preventDefault();
    event.stopPropagation();
    memoPointerId = event.pointerId;
    handle.setPointerCapture?.(
      event.pointerId
    );
    memoDraggedBlock.classList.add(
      'dragging'
    );
  }
);

noteContent.addEventListener(
  'pointermove',
  event => {
    if (
      memoPointerId !== event.pointerId
      || !memoDraggedBlock
    ) {
      return;
    }

    event.preventDefault();
    const target = memoBlockFromTarget(
      document.elementFromPoint(
        event.clientX,
        event.clientY
      )
    );

    if (
      !target
      || target === memoDraggedBlock
    ) {
      clearMemoDropTarget();
      return;
    }

    const zone = memoDropZoneForEvent(
      target,
      event
    );
    if (
      memoDropTarget === target
      && memoDropZone === zone
    ) {
      return;
    }

    clearMemoDropTarget();
    memoDropTarget = target;
    memoDropZone = zone;
    target.classList.add(`drop-${zone}`);
  }
);

function finishMemoPointerDrag(event) {
  if (memoPointerId !== event.pointerId) {
    return;
  }

  const dragged = memoDraggedBlock;
  const target = memoDropTarget;
  const zone = memoDropZone;
  memoPointerId = null;
  clearMemoDropTarget();
  dragged?.classList.remove('dragging');
  memoDraggedBlock = null;

  if (event.type === 'pointerup') {
    moveMemoBlock(
      dragged,
      target,
      zone
    );
  }
}

noteContent.addEventListener(
  'pointerup',
  finishMemoPointerDrag
);
noteContent.addEventListener(
  'pointercancel',
  finishMemoPointerDrag
);
window.addEventListener(
  'pointerup',
  finishMemoPointerDrag,
  true
);
window.addEventListener(
  'pointercancel',
  finishMemoPointerDrag,
  true
);

memoBlockObserver = new MutationObserver(
  decorateMemoBlocks
);
memoBlockObserver.observe(
  noteContent,
  {
    childList: true,
    subtree: true
  }
);

$('#memoImageInput').addEventListener('change', event => {
  insertMemoImages([...event.target.files]);
  event.target.value = '';
});

bindImageDropTarget(
  $('#memoEditorSkin'),
  (files, event) => {
    const range =
      document.caretRangeFromPoint
        ?.(
          event.clientX,
          event.clientY
        );

    if (
      range
      && noteContent.contains(
        range.startContainer
      )
    ) {
      const selection =
        window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      saveMemoSelection();
    }

    return insertMemoImages(files);
  },
  {
    onError: message =>
      alert(message)
  }
);
