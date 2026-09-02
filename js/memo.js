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
const MEMO_FILE_MAX_BYTES = 3 * 1024 * 1024;
const MEMO_FILES_TOTAL_MAX_BYTES = 8 * 1024 * 1024;
const MEMO_FILE_MAX_COUNT = 12;
const MEMO_FONT_MARKER_PREFIX =
  'archive-memo-font-';
let memoSavedRange = null;
let memoDataSaveTimer = null;
let memoPendingFontSize = 15;
let memoPendingFontFamily = 'pretendard';
let memoIsComposing = false;
let memoAltCodeDigits = '';
let memoDraggedBlock = null;
let memoDraggedBlocks = [];
let memoDropTarget = null;
let memoDropZone = '';
let memoPointerId = null;
let memoToolbarUpdateFrame = null;
let memoToolbarTargetElement = null;

function escapeMemoText(value) {
  return escapeHtml(String(value || ''))
    .replace(/\n/g, '<br>');
}

function normalizeMemoTags(value) {
  const tags = Array.isArray(value)
    ? value
    : String(value || '').split(/[,\n]/);
  const seen = new Set();

  return tags
    .map(tag => String(tag || '')
      .trim()
      .replace(/^#+/, '')
      .slice(0, 24))
    .filter(tag => {
      if (!tag) return false;
      const key = tag.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function memoTagsHtml(tags) {
  return normalizeMemoTags(tags)
    .map(tag => `<span>#${escapeHtml(tag)}</span>`)
    .join('');
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

  note.memoData.tags = normalizeMemoTags(
    note.memoData.tags
  );

  note.memoData.attachments = Array.isArray(
    note.memoData.attachments
  )
    ? note.memoData.attachments
      .filter(attachment =>
        attachment
        && typeof attachment === 'object'
        && typeof attachment.dataUrl === 'string'
        && /^data:[^,]*;base64,/i.test(
          attachment.dataUrl
        )
      )
      .slice(0, MEMO_FILE_MAX_COUNT)
      .map(attachment => ({
        id: String(attachment.id || uid()),
        name: String(attachment.name || '첨부 파일')
          .slice(0, 180),
        type: String(
          attachment.type
          || 'application/octet-stream'
        ).slice(0, 120),
        size: Math.max(
          0,
          Number(attachment.size) || 0
        ),
        dataUrl: attachment.dataUrl,
        uploadedAt:
          Number(attachment.uploadedAt)
          || Date.now()
      }))
    : [];

  return note.memoData;
}

function formatMemoFileSize(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) {
    return `${Math.round(size / 102.4) / 10} KB`;
  }
  return `${Math.round(size / 104857.6) / 10} MB`;
}

function downloadMemoAttachment(attachment) {
  try {
    const [header, payload = ''] =
      attachment.dataUrl.split(',', 2);
    const mime = header.match(/^data:([^;,]*)/i)?.[1]
      || attachment.type
      || 'application/octet-stream';
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const objectUrl = URL.createObjectURL(
      new Blob([bytes], { type: mime })
    );
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = attachment.name || '첨부 파일';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch (error) {
    console.error('Memo file download failed', error);
    alert('파일을 다운로드하지 못했습니다.');
  }
}

function renderMemoAttachments(
  note = getCurrentNote()
) {
  const wrap = $('#memoAttachments');
  if (!wrap) return;

  const attachments = note
    && (note.template || 'memo') === 'memo'
      ? ensureMemoData(note).attachments
      : [];

  wrap.hidden = !attachments.length;
  wrap.innerHTML = '';

  attachments.forEach(attachment => {
    const row = document.createElement('div');
    row.className = 'memo-attachment-row';
    row.innerHTML = `
      <span class="memo-attachment-icon" aria-hidden="true">FILE</span>
      <span class="memo-attachment-copy">
        <strong>${escapeHtml(attachment.name)}</strong>
        <small>${formatMemoFileSize(attachment.size)}</small>
      </span>
      <button class="memo-attachment-download" type="button">다운로드</button>
      <button class="memo-attachment-remove" type="button" aria-label="${escapeHtml(attachment.name)} 삭제">삭제</button>
    `;

    row.querySelector('.memo-attachment-download')
      .addEventListener('click', event => {
        event.preventDefault();
        downloadMemoAttachment(attachment);
      });

    row.querySelector('.memo-attachment-remove')
      .addEventListener('click', () => {
        const currentNote = getCurrentNote();
        if (!currentNote) return;
        const memo = ensureMemoData(currentNote);
        memo.attachments = memo.attachments.filter(
          item => item.id !== attachment.id
        );
        currentNote.updatedAt = Date.now();
        renderMemoAttachments(currentNote);
        updateEditorMeta(currentNote);
        saveData();
      });

    wrap.appendChild(row);
  });
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

function normalizeMemoColor(value) {
  const color = String(value || '').trim();
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) {
    return color.toLowerCase();
  }
  const rgb = color.match(
    /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i
  );
  if (!rgb) return '';
  return `#${rgb.slice(1, 4)
    .map(channel => Math.min(255, Number(channel))
      .toString(16)
      .padStart(2, '0'))
    .join('')}`;
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
  const textColor = normalizeMemoColor(
    element.getAttribute('color')
    || element.style.color
  );

  if (MEMO_FONT_KEYS.includes(fontKey)) {
    span.dataset.memoFont = fontKey;
  }
  if (MEMO_FONT_SIZES.includes(fontSize)) {
    span.dataset.memoSize = String(fontSize);
  }
  if (textColor) {
    span.style.color = textColor;
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
      const textColor = normalizeMemoColor(
        element.style.color
        || element.getAttribute('color')
      );
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
      if (textColor) {
        element.style.color = textColor;
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
  $('#memoTagsInput').value =
    memo.tags.join(', ');
  $('#memoTagPreview').innerHTML =
    memoTagsHtml(memo.tags);
  renderMemoAttachments(note);
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
  if (memoIsComposing) return;
  const selection = window.getSelection();
  if (
    !selection.rangeCount
    || !noteContent.contains(selection.anchorNode)
    || !noteContent.contains(selection.focusNode)
  ) {
    return;
  }
  memoSavedRange = selection.getRangeAt(0).cloneRange();
  scheduleMemoToolbarUpdate();
}

function restoreMemoSelection() {
  if (
    !memoSavedRange
    || !memoSavedRange.startContainer.isConnected
    || !memoSavedRange.endContainer.isConnected
    || !noteContent.contains(
      memoSavedRange.commonAncestorContainer
    )
  ) {
    memoSavedRange = null;
    noteContent.focus();
    return false;
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(memoSavedRange);
  return true;
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

function memoSelectionElement(range = memoSelectionRange()) {
  if (!range) return null;
  const node = range.startContainer;
  return node.nodeType === Node.ELEMENT_NODE
    ? node
    : node.parentElement;
}

function memoBlocksForRange(range) {
  if (!range) return [];
  const blocks = memoEditableBlocks();

  if (range.collapsed) {
    const element = memoSelectionElement(range);
    const block = element?.closest(
      '.memo-editor-block'
    );
    return block ? [block] : [];
  }

  return blocks.filter(block => {
    try {
      return range.intersectsNode(block);
    } catch (_error) {
      return false;
    }
  });
}

function memoCssColorToHex(value) {
  const match = String(value || '').match(
    /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i
  );
  if (!match) {
    return normalizeMemoColor(value)
      || '#5c3621';
  }
  return `#${match.slice(1, 4)
    .map(channel => Number(channel)
      .toString(16)
      .padStart(2, '0'))
    .join('')}`;
}

function setMemoSizeControlValue(size) {
  const select = $('#memoFontSizeSelect');
  if (!select || !Number.isFinite(size)) return;
  select
    .querySelector('[data-memo-current-size]')
    ?.remove();
  const value = String(Math.round(size));

  if (!select.querySelector(`option[value="${value}"]`)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${value}px`;
    option.dataset.memoCurrentSize = 'true';
    select.appendChild(option);
  }
  select.value = value;
}

function updateMemoToolbarState() {
  memoToolbarUpdateFrame = null;
  const range = memoSelectionRange();
  if (!range && !memoToolbarTargetElement) return;
  const rangeElement = range
    ? memoSelectionElement(range)
    : null;
  const element =
    memoToolbarTargetElement?.isConnected
    && noteContent.contains(memoToolbarTargetElement)
      ? memoToolbarTargetElement
      : rangeElement;
  memoToolbarTargetElement = null;
  if (!element) return;

  const block = element.closest(
    '.memo-editor-block'
  );
  const tagName = block?.tagName || '';
  const alignment = block
    ? getComputedStyle(block).textAlign
    : 'left';

  document
    .querySelectorAll('[data-memo-command]')
    .forEach(button => {
      const command = button.dataset.memoCommand;
      let active = false;
      if (command === 'paragraph') active = tagName === 'P';
      if (command === 'subtitle') active = tagName === 'H3';
      if (command === 'left') active = alignment === 'left' || alignment === 'start';
      if (command === 'center') active = alignment === 'center';
      if (command === 'bold') active = document.queryCommandState('bold');
      if (command === 'strike') active = document.queryCommandState('strikeThrough');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

  const fontSize = parseFloat(
    getComputedStyle(element).fontSize
  );
  setMemoSizeControlValue(fontSize);
  if (MEMO_FONT_SIZES.includes(Math.round(fontSize))) {
    memoPendingFontSize = Math.round(fontSize);
  }

  const fontElement = element.closest(
    '[data-memo-font]'
  );
  const fontKey = fontElement?.dataset.memoFont
    || Object.keys(MEMO_FONT_FACES).find(key =>
      getComputedStyle(element).fontFamily
        .replace(/["']/g, '')
        .split(',')[0]
        .trim()
      === MEMO_FONT_FACES[key]
    )
    || 'pretendard';
  const fontSelect = $('#memoFontFamilySelect');
  if (fontSelect) fontSelect.value = fontKey;
  memoPendingFontFamily = fontKey;

  const colorInput = $('#memoTextColorInput');
  if (colorInput) {
    colorInput.value = memoCssColorToHex(
      getComputedStyle(element).color
    );
  }

  const selectedBlocks = range
    ? memoBlocksForRange(range)
    : [];
  memoEditableBlocks().forEach(candidate => {
    candidate.classList.toggle(
      'memo-block-selected',
      Boolean(range && !range.collapsed)
      && selectedBlocks.includes(candidate)
    );
  });
}

function scheduleMemoToolbarUpdate(target = null) {
  if (
    target instanceof Element
    && noteContent.contains(target)
  ) {
    memoToolbarTargetElement = target;
  }
  if (memoToolbarUpdateFrame !== null) return;
  memoToolbarUpdateFrame = requestAnimationFrame(
    updateMemoToolbarState
  );
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
  scheduleMemoToolbarUpdate();
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
  scheduleMemoToolbarUpdate();
}

function applyMemoTextColor(value) {
  const color = normalizeMemoColor(value);
  if (!color) return;
  restoreMemoSelection();
  document.execCommand(
    'foreColor',
    false,
    color
  );
  noteContent.focus();
  saveMemoSelection();
  scheduleMemoSave();
  scheduleMemoToolbarUpdate();
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
  const selection = window.getSelection();
  if (!selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const wasCollapsed = range.collapsed;
  const blocks = memoBlocksForRange(range);

  if (!blocks.length) {
    return false;
  }

  const activeBlock = blocks[0];
  let collapsedTextOffset = 0;
  if (wasCollapsed) {
    const prefix = document.createRange();
    prefix.selectNodeContents(activeBlock);
    try {
      prefix.setEnd(
        range.startContainer,
        range.startOffset
      );
      collapsedTextOffset = prefix.toString().length;
    } catch (_error) {
      collapsedTextOffset = 0;
    }
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
      const handle = block.querySelector(
        ':scope > .memo-block-handle'
      );
      [...block.childNodes].forEach(node => {
        if (node !== handle) {
          replacement.appendChild(node);
        }
      });
      if (handle) replacement.prepend(handle);

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
  if (wasCollapsed) {
    const walker = document.createTreeWalker(
      replacements[0],
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.parentElement?.closest(
            '.memo-block-handle'
          )
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let remaining = collapsedTextOffset;
    let targetNode = null;
    while (walker.nextNode()) {
      targetNode = walker.currentNode;
      if (remaining <= targetNode.length) break;
      remaining -= targetNode.length;
    }
    if (targetNode) {
      nextRange.setStart(
        targetNode,
        Math.min(remaining, targetNode.length)
      );
    } else {
      nextRange.selectNodeContents(replacements[0]);
      nextRange.collapse(false);
    }
    nextRange.collapse(true);
  } else {
    const first = replacements[0];
    const last = replacements[replacements.length - 1];
    nextRange.selectNodeContents(first);
    const startOffset = first.firstElementChild
      ?.classList.contains('memo-block-handle')
        ? 1
        : 0;
    nextRange.setStart(first, startOffset);
    nextRange.setEnd(last, last.childNodes.length);
  }

  selection.removeAllRanges();
  selection.addRange(nextRange);
  memoSavedRange =
    nextRange.cloneRange();
  decorateMemoBlocks();

  return true;
}

function runMemoCommand(command) {
  if (!restoreMemoSelection()) return;
  if (command === 'paragraph') {
    replaceMemoSelectedBlocks('p');
  } else if (command === 'subtitle') {
    replaceMemoSelectedBlocks('h3');
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
  scheduleMemoToolbarUpdate();
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
    || event.isComposing
    || memoIsComposing
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
  if (memoIsComposing) return;
  const selection = window.getSelection();
  const activeRange =
    selection.rangeCount
    && noteContent.contains(selection.anchorNode)
      ? selection.getRangeAt(0).cloneRange()
      : null;
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
    block.querySelectorAll(
      ':scope > .memo-block-handle'
    ).forEach(handle => handle.remove());
    if (!block.classList.contains('memo-editor-block')) {
      block.classList.add('memo-editor-block');
    }
    block.dataset.memoBlockHandle = 'true';
    block.title = '왼쪽 손잡이를 끌어서 블록 이동';
  });

  if (
    activeRange
    && activeRange.startContainer.isConnected
    && activeRange.endContainer.isConnected
  ) {
    selection.removeAllRanges();
    selection.addRange(activeRange);
    memoSavedRange = activeRange.cloneRange();
  }
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

function sortMemoBlocks(blocks) {
  return [...new Set(blocks)].sort((a, b) => {
    if (a === b) return 0;
    return a.compareDocumentPosition(b)
      & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
  });
}

function moveMemoBlocks(
  draggedBlocks,
  target,
  zone
) {
  const dragged = sortMemoBlocks(
    draggedBlocks
  ).filter(block =>
    block?.isConnected
    && noteContent.contains(block)
  );
  if (
    !dragged.length
    || !target
    || dragged.includes(target)
  ) {
    return;
  }

  const sourceRows = new Set(
    dragged
      .map(block => block.closest(
        '.memo-block-row'
      ))
      .filter(Boolean)
  );
  const fragment = document.createDocumentFragment();
  dragged.forEach(block => fragment.appendChild(block));

  if (zone === 'left' || zone === 'right') {
    const targetColumn =
      target.closest(
        '.memo-block-column'
      );
    const newColumn =
      document.createElement('div');
    newColumn.className =
      'memo-block-column';
    newColumn.appendChild(fragment);

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
      fragment,
      zone === 'before'
        ? target
        : target.nextSibling
    );
  }

  sourceRows.forEach(cleanupMemoBlockRow);
  decorateMemoBlocks();
  persistMemoEditor();
  scheduleMemoSave();
}

function handleMemoShortcuts(event) {
  if (event.isComposing || memoIsComposing) {
    return false;
  }
  const primary =
    event.ctrlKey || event.metaKey;

  if (
    primary
    && event.key.toLowerCase() === 'a'
  ) {
    requestAnimationFrame(() => {
      saveMemoSelection();
      scheduleMemoToolbarUpdate();
    });
    return false;
  }

  if (
    primary
    && !event.shiftKey
    && event.key.toLowerCase() === 'z'
  ) {
    event.preventDefault();
    document.execCommand('undo');
    requestAnimationFrame(() => {
      decorateMemoBlocks();
      saveMemoSelection();
      scheduleMemoSave();
      scheduleMemoToolbarUpdate();
    });
    return true;
  }

  if (
    primary
    && (
      event.key.toLowerCase() === 'y'
      || (
        event.shiftKey
        && event.key.toLowerCase() === 'z'
      )
    )
  ) {
    event.preventDefault();
    document.execCommand('redo');
    requestAnimationFrame(() => {
      decorateMemoBlocks();
      saveMemoSelection();
      scheduleMemoSave();
      scheduleMemoToolbarUpdate();
    });
    return true;
  }

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
  decorateMemoBlocks();
  persistMemoEditor();
  scheduleMemoSave();
}

function readMemoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(
      reader.error || new Error('파일을 읽지 못했습니다.')
    );
    reader.readAsDataURL(file);
  });
}

async function attachMemoFiles(files) {
  const note = getCurrentNote();
  if (!note || (note.template || 'memo') !== 'memo') return;

  const memo = ensureMemoData(note);
  let totalBytes = memo.attachments.reduce(
    (sum, attachment) => sum + attachment.size,
    0
  );
  const rejected = [];

  for (const file of files) {
    if (memo.attachments.length >= MEMO_FILE_MAX_COUNT) {
      rejected.push('첨부 파일은 메모당 최대 12개까지 가능합니다.');
      break;
    }
    if (file.size > MEMO_FILE_MAX_BYTES) {
      rejected.push(`${file.name}: 파일당 3MB를 초과했습니다.`);
      continue;
    }
    if (totalBytes + file.size > MEMO_FILES_TOTAL_MAX_BYTES) {
      rejected.push(`${file.name}: 첨부 파일 총 8MB를 초과합니다.`);
      continue;
    }

    try {
      const dataUrl = await readMemoFile(file);
      if (!/^data:[^,]*;base64,/i.test(dataUrl)) {
        throw new Error('지원하지 않는 파일 형식입니다.');
      }
      memo.attachments.push({
        id: uid(),
        name: file.name || '첨부 파일',
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        uploadedAt: Date.now()
      });
      totalBytes += file.size;
    } catch (error) {
      console.error('Memo file failed', error);
      rejected.push(`${file.name}: 파일을 읽지 못했습니다.`);
    }
  }

  note.updatedAt = Date.now();
  renderMemoAttachments(note);
  updateEditorMeta(note);
  saveData();

  if (rejected.length) {
    alert(rejected.join('\n'));
  }
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
            ${
              memo.tags.length
                ? `<span class="memo-album-tags">${memoTagsHtml(memo.tags)}</span>`
                : ''
            }
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
      event => {
        saveMemoSelection();
        event.preventDefault();
      }
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

$('#memoTextColorInput')
  ?.addEventListener(
    'pointerdown',
    saveMemoSelection
  );

$('#memoTagsInput')
  ?.addEventListener(
    'input',
    event => {
      const note = getCurrentNote();
      if (!note) return;
      const memo = ensureMemoData(note);
      memo.tags = normalizeMemoTags(
        event.target.value
      );
      $('#memoTagPreview').innerHTML =
        memoTagsHtml(memo.tags);
      scheduleMemoSave();
    }
  );
$('#memoTextColorInput')
  ?.addEventListener(
    'input',
    event => applyMemoTextColor(
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
    if (event.isComposing || memoIsComposing) {
      return;
    }
    convertMemoNumberToken(event);
  }
);
noteContent.addEventListener(
  'keyup',
  event => {
    if (event.isComposing || memoIsComposing) return;
    finishMemoAltCode(event);
    saveMemoSelection();
  }
);
noteContent.addEventListener('mouseup', event => {
  saveMemoSelection();
  scheduleMemoToolbarUpdate(event.target);
});
noteContent.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  memoToolbarTargetElement = event.target;
  if (memoToolbarUpdateFrame !== null) {
    cancelAnimationFrame(memoToolbarUpdateFrame);
    memoToolbarUpdateFrame = null;
  }
  updateMemoToolbarState();
});
noteContent.addEventListener('focus', saveMemoSelection);
noteContent.addEventListener('compositionstart', () => {
  memoIsComposing = true;
});
noteContent.addEventListener('compositionend', () => {
  memoIsComposing = false;
  requestAnimationFrame(() => {
    decorateMemoBlocks();
    saveMemoSelection();
    scheduleMemoToolbarUpdate();
  });
  scheduleMemoSave();
});
noteContent.addEventListener('input', event => {
  if (!event.isComposing && !memoIsComposing) {
    decorateMemoBlocks();
    saveMemoSelection();
    scheduleMemoToolbarUpdate();
  }
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
    const block = memoBlockFromTarget(
      event.target
    );
    if (!block || event.button !== 0) return;
    scheduleMemoToolbarUpdate(
      event.target instanceof Element
        ? event.target
        : block
    );
    const bounds = block.getBoundingClientRect();
    const onHandle =
      event.clientX >= bounds.left - 24
      && event.clientX <= bounds.left + 2
      && event.clientY >= bounds.top - 2
      && event.clientY <= bounds.top + 24;
    if (!onHandle) return;

    memoDraggedBlock = block;
    if (!memoDraggedBlock) return;

    const selectionRange = memoSelectionRange()
      || memoSavedRange;
    const selectedBlocks = selectionRange
      && !selectionRange.collapsed
      ? memoBlocksForRange(selectionRange)
      : [];
    memoDraggedBlocks =
      selectedBlocks.includes(memoDraggedBlock)
        ? sortMemoBlocks(selectedBlocks)
        : [memoDraggedBlock];

    event.preventDefault();
    event.stopPropagation();
    memoPointerId = event.pointerId;
    block.setPointerCapture?.(
      event.pointerId
    );
    memoDraggedBlocks.forEach(block => {
      block.classList.add('dragging');
    });
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
      || memoDraggedBlocks.includes(target)
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

  const dragged = [...memoDraggedBlocks];
  const target = memoDropTarget;
  const zone = memoDropZone;
  memoPointerId = null;
  clearMemoDropTarget();
  dragged.forEach(block => {
    block.classList.remove('dragging');
  });
  memoDraggedBlock = null;
  memoDraggedBlocks = [];

  if (event.type === 'pointerup') {
    moveMemoBlocks(
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

document.addEventListener(
  'selectionchange',
  () => {
    const selection = window.getSelection();
    if (
      selection.rangeCount
      && noteContent.contains(selection.anchorNode)
      && noteContent.contains(selection.focusNode)
    ) {
      saveMemoSelection();
    }
  }
);

$('#memoImageInput').addEventListener('change', event => {
  insertMemoImages([...event.target.files]);
  event.target.value = '';
});

$('#memoFileInput').addEventListener('change', event => {
  attachMemoFiles([...event.target.files]);
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
