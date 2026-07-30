'use strict';

const ARCHIVE_FONT_STACKS = {
  pretendard:
    '"Pretendard", sans-serif',
  'lee-seoyun':
    '"IsYun", "Pretendard", sans-serif',
  'gowun-dodum':
    '"Gowun Dodum", "Pretendard", sans-serif',
  'gowun-batang':
    '"Gowun Batang", serif',
  'nanum-pen':
    '"Nanum Pen Script", cursive',
  gaegu:
    '"Gaegu", cursive',
  dongle:
    '"Dongle", sans-serif',
  'black-han':
    '"Black Han Sans", sans-serif',
  'song-myung':
    '"Song Myung", serif'
};

function normalizeArchiveFontKey(
  value
) {
  const legacy = {
    handwriting: 'lee-seoyun',
    serif: 'gowun-batang'
  };
  const key =
    legacy[value] || value;

  return Object.prototype
    .hasOwnProperty.call(
      ARCHIVE_FONT_STACKS,
      key
    )
    ? key
    : 'pretendard';
}

function archiveFontStack(
  value
) {
  return ARCHIVE_FONT_STACKS[
    normalizeArchiveFontKey(value)
  ];
}

function noteFontKey(note) {
  if (!note) return 'pretendard';

  return normalizeArchiveFontKey(
    note.fontKey
    || note.postitData?.font
    || 'pretendard'
  );
}

function applyEditorFont(
  note = (
    typeof getCurrentNote
      === 'function'
      ? getCurrentNote()
      : null
  )
) {
  if (!note) return;

  const key = noteFontKey(note);
  const paper =
    document.querySelector(
      '.editor-paper'
    );
  const select =
    document.querySelector(
      '#editorFontSelect'
    );

  note.fontKey = key;

  paper?.style.setProperty(
    '--archive-note-font',
    archiveFontStack(key)
  );

  if (select) {
    select.value = key;
    select.style.fontFamily =
      archiveFontStack(key);
  }

  if (
    note.template === 'todo'
    && note.postitData
  ) {
    note.postitData.font = key;
    const postitSelect =
      document.querySelector(
        '#postitFontSelect'
      );

    if (postitSelect) {
      postitSelect.value = key;
    }
  }
}

function saveCurrentNoteFont(
  value
) {
  const note =
    typeof getCurrentNote
      === 'function'
      ? getCurrentNote()
      : null;

  if (!note) return;

  const key =
    normalizeArchiveFontKey(value);

  note.fontKey = key;

  if (note.template === 'todo') {
    ensurePostitData(note).font = key;
    renderPostitEditor(note);
  }

  if (note.template === 'moodboard') {
    renderMoodboard();
  }

  note.updatedAt = Date.now();
  updateEditorMeta(note);
  applyEditorFont(note);
  saveData();
}

function syncMoodboardFontControl(
  item
) {
  const field =
    document.querySelector(
      '#moodboardFontField'
    );
  const select =
    document.querySelector(
      '#moodboardFontSelect'
    );
  const textItem =
    item?.type === 'text';

  if (!field || !select) return;

  field.hidden =
    Boolean(item)
    && !textItem;
  select.disabled = !textItem;

  if (textItem) {
    const note =
      getCurrentNote();
    select.value =
      normalizeArchiveFontKey(
        item.fontKey
        || note?.fontKey
      );
  }
}

document
  .querySelector(
    '#editorFontSelect'
  )
  ?.addEventListener(
    'change',
    event => {
      saveCurrentNoteFont(
        event.target.value
      );
    }
  );

document
  .querySelector(
    '#moodboardFontSelect'
  )
  ?.addEventListener(
    'change',
    event => {
      const item =
        selectedMoodboardItem();

      if (
        !item
        || item.type !== 'text'
      ) {
        return;
      }

      item.fontKey =
        normalizeArchiveFontKey(
          event.target.value
        );
      renderMoodboard();
      scheduleMoodboardSave();
    }
  );
