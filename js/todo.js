'use strict';

/* ---------------- 02 Post-it template ---------------- */

const POSTIT_PAGE_SIZE = 12;
const POSTIT_TIME_SNAPSHOT_PREFIX =
  'archive.postit-time.v1.';
const restoredPostitTimeData = new WeakSet();
const POSTIT_TYPES = {
  habit: {
    label: '해빗 트래커',
    heading: 'HABIT TRACKER',
    skin: 'cream'
  },
  todo: {
    label: '투두 리스트',
    heading: 'TO DO LIST',
    skin: 'blue'
  },
  weekly: {
    label: '위클리 플랜',
    heading: 'WEEKLY PLAN',
    skin: 'purple'
  },
  wish: {
    label: '위시 리스트',
    heading: 'WISH LIST',
    skin: 'pink'
  },
  shopping: {
    label: '쇼핑 리스트',
    heading: 'SHOPPING LIST',
    skin: 'green'
  },
  time: {
    label: '타임 트래커',
    heading: 'TIME TRACKER',
    skin: 'cream'
  }
};
const POSTIT_SKINS = [
  'cream',
  'blue',
  'purple',
  'pink',
  'green'
];
const POSTIT_DEFAULT_ACCENT =
  '#BFD3E6';
const POSTIT_TRACKER_COLORS = [
  '#BFD3E6',
  '#F6D4E2',
  '#F7E7A9',
  '#CFE0B9',
  '#D8CFE7',
  '#F4C7AE'
];
const POSTIT_COLOR_NAMES = {
  '#BFD3E6': '블루',
  '#F6D4E2': '핑크',
  '#F7E7A9': '옐로',
  '#CFE0B9': '그린',
  '#D8CFE7': '퍼플',
  '#F4C7AE': '오렌지',
  '#7F9FC0': '블루',
  '#F0A9C0': '핑크',
  '#E8C76D': '옐로',
  '#9CB87A': '그린',
  '#B29AC5': '퍼플',
  '#E79A75': '오렌지'
};
const POSTIT_FONTS = [
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
const POSTIT_WEEKDAYS = [
  ['MON', '월요일'],
  ['TUE', '화요일'],
  ['WED', '수요일'],
  ['THU', '목요일'],
  ['FRI', '금요일'],
  ['SAT', '토요일'],
  ['SUN', '일요일']
];
let postitSaveTimer = null;
let postitTimePainting = false;
let postitTimePaintColor = '';
let postitLinkTargetNoteId = null;
let postitLinkTargetItemId = null;

function postitMonthValue() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1)
      .padStart(2, '0')
  ].join('-');
}

function blankPostitItems(count = 10) {
  return Array.from(
    { length: count },
    () => ({
      id: uid(),
      text: '',
      memo: '',
      linkedNoteId: '',
      done: false
    })
  );
}

function blankWeeklyRows() {
  return POSTIT_WEEKDAYS.map(
    ([day]) => ({
      id: uid(),
      day,
      text: ''
    })
  );
}

function blankHabitRows(count = 3) {
  return Array.from(
    { length: count },
    () => ({
      id: uid(),
      text: '',
      checked: []
    })
  );
}

function blankTimeSlots() {
  return Array.from(
    { length: 19 },
    (_, index) => ({
      id: uid(),
      hour: String(
        (index + 6) % 24
      ).padStart(2, '0'),
      label: '',
      blocks: Array(6).fill('')
    })
  );
}

function normalizePostitColor(
  value,
  fallback = POSTIT_DEFAULT_ACCENT
) {
  const color =
    String(value || '').trim();

  return /^#[0-9a-f]{6}$/i.test(color)
    ? color.toUpperCase()
    : fallback;
}

function normalizePostitTimeBlock(
  value,
  fallbackColor = ''
) {
  if (
    value
    && typeof value === 'object'
  ) {
    return normalizePostitColor(
      value.color,
      ''
    );
  }

  if (value === true) {
    return normalizePostitColor(
      fallbackColor,
      ''
    );
  }

  return normalizePostitColor(
    value,
    ''
  );
}

function postitTimeSnapshotKey(noteId) {
  return POSTIT_TIME_SNAPSHOT_PREFIX
    + String(noteId || '');
}

function serializePostitTimeSlots(
  timeSlots,
  fallbackColor = ''
) {
  return (timeSlots || []).map(slot => ({
    id: slot.id || uid(),
    hour: String(slot.hour || ''),
    label: String(slot.label || ''),
    blocks: Array.from(
      { length: 6 },
      (_, index) =>
        normalizePostitTimeBlock(
          slot.blocks?.[index],
          fallbackColor
        )
    )
  }));
}

function normalizePostitTimeProjects(
  value
) {
  const projects = {};

  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return projects;
  }

  Object.entries(value)
    .forEach(([color, label]) => {
      const normalizedColor =
        normalizePostitColor(color, '');
      if (!normalizedColor) return;

      projects[normalizedColor] =
        String(label || '')
          .trimStart()
          .slice(0, 24);
    });

  return projects;
}

function persistPostitTimeSnapshot(
  note,
  data
) {
  if (!note?.id || data?.type !== 'time') {
    return;
  }

  try {
    localStorage.setItem(
      postitTimeSnapshotKey(note.id),
      JSON.stringify({
        savedAt: Date.now(),
        timeSlots:
          serializePostitTimeSlots(
            data.timeSlots,
            data.accentColor
          ),
        timeProjects:
          normalizePostitTimeProjects(
            data.timeProjects
          )
      })
    );
  } catch (error) {
    console.warn(
      'Could not save time tracker recovery snapshot',
      error
    );
  }
}

function restorePostitTimeSnapshot(
  note,
  data
) {
  if (
    !note?.id
    || restoredPostitTimeData.has(data)
  ) {
    return;
  }

  restoredPostitTimeData.add(data);

  try {
    const snapshot = JSON.parse(
      localStorage.getItem(
        postitTimeSnapshotKey(note.id)
      ) || 'null'
    );
    const snapshotSavedAt =
      Number(snapshot?.savedAt) || 0;

    if (
      !Array.isArray(snapshot?.timeSlots)
      || snapshotSavedAt
        < (Number(note.updatedAt) || 0)
    ) {
      return;
    }

    data.timeSlots = snapshot.timeSlots;
    if (
      snapshot.timeProjects
      && typeof snapshot.timeProjects
        === 'object'
    ) {
      data.timeProjects =
        snapshot.timeProjects;
    }
    note.updatedAt = Math.max(
      Number(note.updatedAt) || 0,
      snapshotSavedAt
    );

    setTimeout(() => {
      if (
        typeof saveData === 'function'
        && state.notes?.some(
          item => item.id === note.id
        )
      ) {
        saveData();
      }
    }, 0);
  } catch (error) {
    console.warn(
      'Could not restore time tracker recovery snapshot',
      error
    );
  }
}

function ensurePostitData(note) {
  if (
    !note.postitData
    || typeof note.postitData !== 'object'
  ) {
    note.postitData = {
      type: 'todo',
      skin: 'blue',
      heading: 'TO DO LIST',
      font: 'pretendard',
      fontSize: 16,
      accentColor: POSTIT_DEFAULT_ACCENT,
      tags: [],
      items: blankPostitItems(10),
      weekly: blankWeeklyRows(),
      habitMonth: postitMonthValue(),
      habits: blankHabitRows(),
      timeSlots: blankTimeSlots(),
      timeProjects: {}
    };
  }

  const data = note.postitData;

  if (!POSTIT_TYPES[data.type]) {
    data.type = 'todo';
  }
  if (!POSTIT_SKINS.includes(data.skin)) {
    data.skin =
      POSTIT_TYPES[data.type].skin;
  }
  if (data.font === 'handwriting') {
    data.font = 'lee-seoyun';
  } else if (data.font === 'serif') {
    data.font = 'gowun-batang';
  }

  if (!POSTIT_FONTS.includes(data.font)) {
    data.font = 'pretendard';
  }

  data.fontSize =
    [14, 16, 18, 20].includes(
      Number(data.fontSize)
    )
      ? Number(data.fontSize)
      : 16;
  data.accentColor =
    normalizePostitColor(
      data.accentColor
    );

  data.heading =
    String(
      data.heading
      || POSTIT_TYPES[data.type].heading
    );

  if (!Array.isArray(data.tags)) {
    data.tags = [];
  }
  if (!Array.isArray(data.items)) {
    data.items = blankPostitItems();
  }
  if (!Array.isArray(data.weekly)) {
    data.weekly = blankWeeklyRows();
  }
  if (!Array.isArray(data.habits)) {
    data.habits = blankHabitRows();
  }
  if (!Array.isArray(data.timeSlots)) {
    data.timeSlots = blankTimeSlots();
  }
  data.timeProjects =
    normalizePostitTimeProjects(
      data.timeProjects
    );

  restorePostitTimeSnapshot(
    note,
    data
  );

  data.items.forEach(item => {
    item.id = item.id || uid();
    item.text = item.text || '';
    item.memo = String(item.memo || '');
    item.linkedNoteId = String(
      item.linkedNoteId || ''
    );
    item.done = Boolean(item.done);
  });
  data.weekly = POSTIT_WEEKDAYS.map(
    ([day], index) => ({
      id:
        data.weekly[index]?.id
        || uid(),
      day,
      text:
        data.weekly[index]?.text
        || ''
    })
  );
  data.habits.forEach(habit => {
    habit.id = habit.id || uid();
    habit.text = habit.text || '';
    if (!Array.isArray(habit.checked)) {
      habit.checked = [];
    }
  });
  const fallbackTimeSlots =
    blankTimeSlots();
  const expectedHours =
    fallbackTimeSlots.map(
      slot => slot.hour
    );
  const hasExpectedHours =
    data.timeSlots.length
      === expectedHours.length
    && data.timeSlots.every(
      (slot, index) =>
        String(slot?.hour || '')
          .padStart(2, '0')
        === expectedHours[index]
    );

  if (!hasExpectedHours) {
    const slotsByHour = new Map(
      data.timeSlots
        .filter(
          slot =>
            slot
            && typeof slot === 'object'
        )
        .map(slot => [
          String(slot.hour || '')
            .padStart(2, '0'),
          slot
        ])
    );

    fallbackTimeSlots.forEach(
      (fallback, index) => {
        data.timeSlots[index] =
          slotsByHour.get(
            fallback.hour
          ) || {};
      }
    );
    data.timeSlots.length =
      fallbackTimeSlots.length;
  }

  fallbackTimeSlots.forEach(
    (fallback, index) => {
      if (
        !data.timeSlots[index]
        || typeof data.timeSlots[index]
          !== 'object'
      ) {
        data.timeSlots[index] = {};
      }

      const current =
        data.timeSlots[index];
      current.id =
        current.id || fallback.id;
      current.hour = fallback.hour;
      current.label =
        String(current.label || '');
      current.blocks = Array.from(
        { length: 6 },
        (_, blockIndex) =>
          normalizePostitTimeBlock(
            current.blocks?.[blockIndex],
            data.accentColor
          )
      );
    }
  );

  if (
    !/^\d{4}-\d{2}$/
      .test(data.habitMonth || '')
  ) {
    data.habitMonth =
      postitMonthValue();
  }

  return data;
}

function postitDaysInMonth(value) {
  const [year, month] =
    String(value)
      .split('-')
      .map(Number);

  if (!year || !month) return 31;

  return new Date(
    year,
    month,
    0
  ).getDate();
}

function schedulePostitSave() {
  const note =
    typeof getCurrentNote === 'function'
      ? getCurrentNote()
      : null;

  if (
    !note
    || note.template !== 'todo'
  ) {
    return;
  }

  note.updatedAt = Date.now();
  updateEditorMeta(note);
  persistPostitTimeSnapshot(
    note,
    ensurePostitData(note)
  );
  saveData();

  clearTimeout(postitSaveTimer);
  postitSaveTimer = setTimeout(() => {
    if (
      typeof renderTemplateLibraryBar
      === 'function'
    ) {
      renderTemplateLibraryBar('todo');
    }
  }, 320);
}

function postitPaperClass(data) {
  return [
    'postit-paper',
    `postit-type-${data.type}`,
    `postit-skin-${data.skin}`,
    `postit-font-${data.font}`
  ].join(' ');
}

function postitTagsHtml(tags) {
  return tags
    .map(
      tag => `
        <span>#${escapeHtml(tag)}</span>
      `
    )
    .join('');
}

function postitMemoLink(value) {
  const match = String(value || '').match(
    /(?:https?:\/\/|www\.)[^\s<>]+/i
  );
  if (!match) return null;

  const label = match[0].replace(
    /[),.!?;:]+$/,
    ''
  );
  if (!label) return null;

  try {
    const url = new URL(
      /^www\./i.test(label)
        ? `https://${label}`
        : label
    );
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return {
      href: url.href,
      label,
      index: match.index || 0,
      raw: match[0]
    };
  } catch (_error) {
    return null;
  }
}

function renderPostitMemoText(element, value) {
  const text = String(value || '');
  element.textContent = '';
  let cursor = 0;
  const pattern = /(?:https?:\/\/|www\.)[^\s<>]+/gi;
  let match;

  while ((match = pattern.exec(text))) {
    const link = postitMemoLink(match[0]);
    if (!link) continue;
    element.appendChild(
      document.createTextNode(
        text.slice(cursor, match.index)
      )
    );
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = link.label;
    element.appendChild(anchor);
    element.appendChild(
      document.createTextNode(
        match[0].slice(link.label.length)
      )
    );
    cursor = match.index + match[0].length;
  }

  element.appendChild(
    document.createTextNode(text.slice(cursor))
  );
}

function syncPostitMemoLink(anchor, value) {
  const link = postitMemoLink(value);
  anchor.hidden = !link;
  if (!link) {
    anchor.removeAttribute('href');
    return;
  }
  anchor.href = link.href;
  anchor.title = `${link.label} 열기`;
}

function postitLinkedNote(item) {
  return state.notes.find(
    note => note.id === item.linkedNoteId
  ) || null;
}

function postitLinkedNoteLabel(note) {
  const template = note.template || 'memo';
  if (template === 'todo') {
    return POSTIT_TYPES[
      ensurePostitData(note).type
    ]?.label || '포스트잇';
  }
  return ({
    memo: '메모',
    moodboard: '무드보드',
    links: '링크',
    collection: '컬렉션'
  })[template] || '자료';
}

function renderPostitNoteLinkResults(
  query = ''
) {
  const results =
    $('#postitNoteLinkResults');
  if (!results) return;

  const term = String(query)
    .trim()
    .toLowerCase();
  const notes = state.notes
    .filter(
      note =>
        note.id !== postitLinkTargetNoteId
    )
    .filter(note => {
      if (!term) return true;
      const searchable =
        typeof templateSearchText
          === 'function'
          ? templateSearchText(note)
          : `${note.title || ''} ${note.content || ''}`
            .toLowerCase();
      return searchable.includes(term);
    })
    .sort(
      (first, second) =>
        Number(second.updatedAt)
        - Number(first.updatedAt)
    )
    .slice(0, 40);

  results.innerHTML = '';
  if (!notes.length) {
    results.innerHTML = `
      <p class="postit-note-link-empty">
        연결할 자료를 찾지 못했어요.
      </p>
    `;
    return;
  }

  notes.forEach(note => {
    const folder = state.folders.find(
      item => item.id === note.folderId
    );
    const button =
      document.createElement('button');
    button.type = 'button';
    button.className =
      'postit-note-link-result';
    button.innerHTML = `
      <i class="postit-folder-glyph" aria-hidden="true"></i>
      <span>
        <small>${escapeHtml(postitLinkedNoteLabel(note))}${folder ? ` · ${escapeHtml(folder.name)}` : ''}</small>
        <strong>${escapeHtml(note.title || '제목 없음')}</strong>
      </span>
    `;
    button.addEventListener(
      'click',
      () => {
        const targetNote = state.notes.find(
          item =>
            item.id === postitLinkTargetNoteId
        );
        if (!targetNote) return;
        const targetItem =
          ensurePostitData(targetNote)
            .items.find(
              item =>
                item.id === postitLinkTargetItemId
            );
        if (!targetItem) return;
        targetItem.linkedNoteId = note.id;
        schedulePostitSave();
        closePostitNoteLinkModal();
        renderPostitEditor(targetNote);
      }
    );
    results.appendChild(button);
  });
}

function openPostitNoteLinkModal(
  note,
  item
) {
  postitLinkTargetNoteId = note.id;
  postitLinkTargetItemId = item.id;
  const search =
    $('#postitNoteLinkSearch');
  search.value = '';
  renderPostitNoteLinkResults();
  $('#postitNoteLinkModal').hidden =
    false;
  scrim.classList.add('visible');
  setTimeout(() => search.focus(), 30);
}

function closePostitNoteLinkModal() {
  const modal =
    $('#postitNoteLinkModal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  postitLinkTargetNoteId = null;
  postitLinkTargetItemId = null;
  scrim.classList.remove('visible');
}

function renderPostitList(
  container,
  note,
  readOnly = false
) {
  const data =
    ensurePostitData(note);
  const list =
    document.createElement('div');

  list.className =
    `postit-list postit-list-${data.type}`;

  if (!data.items.length) {
    data.items =
      blankPostitItems(
        data.type === 'shopping'
          ? 12
          : 10
      );
  }

  data.items.forEach(item => {
    const row =
      document.createElement('div');

    row.className =
      'postit-list-row'
      + (item.done ? ' done' : '');

    const check =
      document.createElement(
        readOnly ? 'span' : 'button'
      );

    if (!readOnly) {
      check.type = 'button';
    }
    check.className = 'postit-check';
    check.setAttribute(
      'aria-label',
      item.done
        ? '체크 해제'
        : '완료 체크'
    );
    check.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M5 12.5l4.2 4.2L19 7" />
      </svg>
    `;

    const input =
      document.createElement(
        readOnly ? 'span' : 'input'
      );

    input.className = 'postit-item-title';

    if (readOnly) {
      input.textContent =
        item.text || '';
    } else {
      input.type = 'text';
      input.maxLength = 120;
      input.value = item.text || '';
      input.placeholder = '내용을 입력하세요';
      input.addEventListener(
        'input',
        event => {
          item.text =
            event.target.value;
          schedulePostitSave();
        }
      );
    }

    if (!readOnly) {
      check.addEventListener(
        'click',
        () => {
          item.done = !item.done;
          row.classList.toggle(
            'done',
            item.done
          );
          schedulePostitSave();
        }
      );
    }

    const fields =
      document.createElement('div');
    fields.className = 'postit-list-fields';
    fields.appendChild(input);

    if (data.type === 'todo') {
      const linkedNote =
        postitLinkedNote(item);

      if (readOnly) {
        if (item.memo) {
          const memo =
            document.createElement('div');
          memo.className = 'postit-item-memo';
          renderPostitMemoText(
            memo,
            item.memo
          );
          fields.appendChild(memo);
        }

        if (linkedNote) {
          const linked =
            document.createElement('span');
          linked.className =
            'postit-linked-note';
          linked.innerHTML = `
            <i class="postit-folder-glyph" aria-hidden="true"></i>
            <span>${escapeHtml(linkedNote.title || '제목 없음')}</span>
          `;
          fields.appendChild(linked);
        }
      } else {
        const noteLinkButton =
          document.createElement('button');
        noteLinkButton.type = 'button';
        noteLinkButton.className =
          'postit-item-note-link-btn'
          + (linkedNote ? ' active' : '');
        noteLinkButton.innerHTML = `
          <i class="postit-folder-glyph" aria-hidden="true"></i>
        `;
        noteLinkButton.title =
          linkedNote
            ? '연결 자료 변경'
            : '자료 연결';
        noteLinkButton.setAttribute(
          'aria-label',
          noteLinkButton.title
        );
        noteLinkButton.addEventListener(
          'click',
          () => openPostitNoteLinkModal(
            note,
            item
          )
        );

        const memoLine =
          document.createElement('div');
        memoLine.className =
          'postit-item-memo-line';

        const memoInput =
          document.createElement('input');
        memoInput.type = 'text';
        memoInput.className =
          'postit-item-memo-input';
        memoInput.maxLength = 320;
        memoInput.value = item.memo;
        memoInput.placeholder =
          '웹주소 · 파일 위치 · 추가 메모';

        const memoLink =
          document.createElement('a');
        memoLink.className =
          'postit-item-memo-link';
        memoLink.target = '_blank';
        memoLink.rel =
          'noopener noreferrer';
        memoLink.textContent = '링크 열기 ↗';
        syncPostitMemoLink(
          memoLink,
          item.memo
        );

        memoInput.addEventListener(
          'input',
          event => {
            item.memo = event.target.value;
            row.classList.toggle(
              'has-memo',
              Boolean(item.memo)
            );
            syncPostitMemoLink(
              memoLink,
              item.memo
            );
            schedulePostitSave();
          }
        );

        memoLine.append(
          noteLinkButton,
          memoInput,
          memoLink
        );
        fields.append(memoLine);

        row.classList.toggle(
          'has-memo',
          Boolean(item.memo)
        );

        const setEditing = value => {
          row.classList.toggle(
            'is-editing',
            value
          );
        };
        input.addEventListener(
          'focus',
          () => setEditing(true)
        );
        memoInput.addEventListener(
          'focus',
          () => setEditing(true)
        );
        row.addEventListener(
          'focusout',
          () => requestAnimationFrame(() => {
            if (
              !row.contains(
                document.activeElement
              )
            ) {
              setEditing(false);
            }
          })
        );

        if (linkedNote) {
          const linked =
            document.createElement('div');
          linked.className =
            'postit-linked-note';
          linked.innerHTML = `
            <button type="button" class="postit-linked-note-open">
              <i class="postit-folder-glyph" aria-hidden="true"></i>
              <span>${escapeHtml(linkedNote.title || '제목 없음')}</span>
            </button>
            <button type="button" class="postit-linked-note-remove" aria-label="연결 해제">×</button>
          `;
          linked.querySelector(
            '.postit-linked-note-open'
          ).addEventListener(
            'click',
            () => {
              if (
                typeof persistCurrentNote
                === 'function'
              ) {
                persistCurrentNote();
              }
              openNoteView(
                linkedNote.id
              );
            }
          );
          linked.querySelector(
            '.postit-linked-note-remove'
          ).addEventListener(
            'click',
            () => {
              item.linkedNoteId = '';
              renderPostitEditor(note);
              schedulePostitSave();
            }
          );
          fields.appendChild(linked);
        }
      }
    }

    row.append(check, fields);

    if (!readOnly) {
      const remove =
        document.createElement('button');
      remove.type = 'button';
      remove.className =
        'postit-row-remove';
      remove.textContent = '×';
      remove.setAttribute(
        'aria-label',
        '항목 삭제'
      );
      remove.addEventListener(
        'click',
        () => {
          data.items =
            data.items.filter(
              current =>
                current.id !== item.id
            );
          renderPostitEditor(note);
          schedulePostitSave();
        }
      );
      row.appendChild(remove);
    }

    list.appendChild(row);
  });

  container.appendChild(list);
}

function renderPostitWeekly(
  container,
  note,
  readOnly = false
) {
  const data =
    ensurePostitData(note);
  const weekly =
    document.createElement('div');
  weekly.className = 'postit-weekly';

  data.weekly.forEach(
    (rowData, index) => {
      const row =
        document.createElement('div');
      row.className =
        'postit-weekly-row';

      const day =
        document.createElement('span');
      day.textContent =
        POSTIT_WEEKDAYS[index][0];

      const field =
        document.createElement(
          readOnly
            ? 'p'
            : 'textarea'
        );

      if (readOnly) {
        field.textContent =
          rowData.text || '';
      } else {
        field.value =
          rowData.text || '';
        field.rows = 2;
        field.placeholder =
          `${POSTIT_WEEKDAYS[index][1]} 계획`;
        field.addEventListener(
          'input',
          event => {
            rowData.text =
              event.target.value;
            schedulePostitSave();
          }
        );
      }

      row.append(day, field);
      weekly.appendChild(row);
    }
  );

  container.appendChild(weekly);
}

function renderPostitHabit(
  container,
  note,
  readOnly = false
) {
  const data =
    ensurePostitData(note);
  const days =
    postitDaysInMonth(
      data.habitMonth
    );
  const wrap =
    document.createElement('div');
  wrap.className = 'postit-habit';

  const monthRow =
    document.createElement('div');
  monthRow.className =
    'postit-habit-month';

  if (readOnly) {
    const label =
      document.createElement('span');
    label.textContent =
      data.habitMonth
        .replace('-', '. ');
    monthRow.appendChild(label);
  } else {
    const month =
      document.createElement('input');
    month.type = 'month';
    month.value = data.habitMonth;
    month.addEventListener(
      'change',
      event => {
        data.habitMonth =
          event.target.value
          || postitMonthValue();
        data.habits.forEach(habit => {
          habit.checked =
            habit.checked.filter(
              day => day <= postitDaysInMonth(
                data.habitMonth
              )
            );
        });
        renderPostitEditor(note);
        schedulePostitSave();
      }
    );
    monthRow.appendChild(month);
  }

  const count =
    document.createElement('span');
  count.textContent =
    `${days} DAYS`;
  monthRow.appendChild(count);
  wrap.appendChild(monthRow);

  data.habits.forEach(habit => {
    const habitRow =
      document.createElement('div');
    habitRow.className =
      'postit-habit-row';

    const heading =
      document.createElement('div');
    heading.className =
      'postit-habit-name';

    const name =
      document.createElement(
        readOnly ? 'span' : 'input'
      );

    if (readOnly) {
      name.textContent =
        habit.text || '습관';
    } else {
      name.type = 'text';
      name.maxLength = 40;
      name.value = habit.text || '';
      name.placeholder = '기록할 습관';
      name.addEventListener(
        'input',
        event => {
          habit.text =
            event.target.value;
          schedulePostitSave();
        }
      );
    }

    heading.appendChild(name);

    if (!readOnly) {
      const remove =
        document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute(
        'aria-label',
        '습관 삭제'
      );
      remove.addEventListener(
        'click',
        () => {
          data.habits =
            data.habits.filter(
              current =>
                current.id !== habit.id
            );
          renderPostitEditor(note);
          schedulePostitSave();
        }
      );
      heading.appendChild(remove);
    }

    const dots =
      document.createElement('div');
    dots.className =
      'postit-habit-dots';

    Array.from(
      { length: days },
      (_, index) => index + 1
    ).forEach(day => {
      const dot =
        document.createElement(
          readOnly ? 'span' : 'button'
        );
      if (!readOnly) {
        dot.type = 'button';
      }
      dot.className =
        'postit-habit-dot'
        + (
          habit.checked.includes(day)
            ? ' checked'
            : ''
        );
      dot.textContent = String(day);
      dot.title = `${day}일`;
      dot.setAttribute(
        'aria-label',
        `${day}일 기록`
      );
      if (!readOnly) {
        dot.addEventListener(
          'click',
          () => {
            if (
              habit.checked.includes(day)
            ) {
              habit.checked =
                habit.checked.filter(
                  value => value !== day
                );
            } else {
              habit.checked.push(day);
            }
            dot.classList.toggle(
              'checked'
            );
            schedulePostitSave();
          }
        );
      }
      dots.appendChild(dot);
    });

    habitRow.append(heading, dots);
    wrap.appendChild(habitRow);
  });

  container.appendChild(wrap);
}

function applyPostitTimeBlock(
  slot,
  blockIndex,
  color,
  cell
) {
  const normalizedColor =
    normalizePostitTimeBlock(color);
  slot.blocks[blockIndex] =
    normalizedColor;
  cell.classList.toggle(
    'painted',
    Boolean(normalizedColor)
  );
  cell.style.backgroundColor =
    normalizedColor;
  cell.setAttribute(
    'aria-pressed',
    normalizedColor ? 'true' : 'false'
  );

  const tracker = cell.closest(
    '.postit-time'
  );
  const currentNote = getCurrentNote();
  if (tracker && currentNote) {
    const data =
      ensurePostitData(currentNote);
    renderPostitTimeSummary(
      tracker,
      data
    );
  }
  schedulePostitSave();
}

function postitTimeProjectColors(data) {
  const colors = new Set(
    POSTIT_TRACKER_COLORS
  );

  colors.add(
    normalizePostitColor(
      data.accentColor
    )
  );
  Object.keys(
    data.timeProjects || {}
  ).forEach(color => colors.add(color));
  data.timeSlots.forEach(slot => {
    slot.blocks.forEach(color => {
      const normalizedColor =
        normalizePostitColor(color, '');
      if (normalizedColor) {
        colors.add(normalizedColor);
      }
    });
  });

  return [...colors].filter(Boolean);
}

function renderPostitTimeProjects(
  data
) {
  const projects =
    $('#postitTimeProjectsPanel');
  if (!projects) return;

  projects.innerHTML = `
    <span class="postit-time-projects-label">
      PROJECT COLORS
    </span>
    <span class="postit-time-project-fields"></span>
  `;

  const fields = projects.querySelector(
    '.postit-time-project-fields'
  );

  postitTimeProjectColors(data)
    .forEach(color => {
      const field =
        document.createElement('label');
      field.className =
        'postit-time-project-field';
      field.dataset.timeProjectColor =
        color;
      field.classList.toggle(
        'active',
        color === data.accentColor
      );
      field.innerHTML = `
        <i style="--time-project-color:${color}"></i>
        <input
          type="text"
          maxlength="24"
          value="${escapeHtml(data.timeProjects[color] || '')}"
          placeholder="${escapeHtml(POSTIT_COLOR_NAMES[color] || '사용자 색상')} 프로젝트"
          aria-label="${escapeHtml(POSTIT_COLOR_NAMES[color] || color)} 프로젝트명"
        >
      `;

      field.querySelector('input')
        .addEventListener(
          'input',
          event => {
            data.timeProjects[color] =
              event.target.value
                .slice(0, 24);
            const tracker =
              document.querySelector(
                '#postitEditorContent .postit-time'
              );
            if (tracker) {
              renderPostitTimeSummary(
                tracker,
                data
              );
            }
            schedulePostitSave();
          }
        );
      fields.appendChild(field);
    });
}

function postitTimeTotals(data) {
  const colorCounts = new Map();

  data.timeSlots.forEach(slot => {
    slot.blocks.forEach(blockColor => {
      const color = normalizePostitColor(
        blockColor,
        ''
      );
      if (!color) return;
      colorCounts.set(
        color,
        (colorCounts.get(color) || 0) + 1
      );
    });
  });

  const colors = [...colorCounts]
    .map(([color, blocks]) => ({
      color,
      blocks,
      minutes: blocks * 10,
      label:
        String(
          data.timeProjects?.[color]
          || ''
        ).trim()
        || POSTIT_COLOR_NAMES[color]
        || '사용자 색상'
    }));

  return {
    colors,
    totalMinutes: colors.reduce(
      (sum, item) => sum + item.minutes,
      0
    )
  };
}

function renderPostitTimeSummary(
  tracker,
  data
) {
  let summary = tracker.querySelector(
    '.postit-time-summary'
  );
  if (!summary) {
    summary = document.createElement('div');
    summary.className =
      'postit-time-summary';
    summary.setAttribute(
      'aria-live',
      'polite'
    );
    tracker.appendChild(summary);
  }

  const totals = postitTimeTotals(data);
  summary.innerHTML = `
    <span class="postit-time-summary-label">
      COLOR TOTAL
    </span>
    <span class="postit-time-summary-colors">
      ${
        totals.colors.length
          ? totals.colors.map(item => `
              <span class="postit-time-summary-item">
                <i style="--time-summary-color:${item.color}"></i>
                <span>${escapeHtml(item.label)}</span>
                <strong>${item.minutes}분</strong>
              </span>
            `).join('')
          : '<span class="postit-time-summary-empty">아직 기록된 시간이 없어요.</span>'
      }
    </span>
    <strong class="postit-time-summary-total">
      <span>총 기록</span>
      ${totals.totalMinutes}분
    </strong>
  `;
}

function renderPostitTime(
  container,
  note,
  readOnly = false
) {
  const data =
    ensurePostitData(note);
  const tracker =
    document.createElement('div');
  tracker.className =
    'postit-time';
  const table =
    document.createElement('div');
  table.className =
    'postit-time-table';

  const head =
    document.createElement('div');
  head.className =
    'postit-time-head';
  head.innerHTML = `
    <span>TIME</span>
    <span class="postit-time-minutes">
      <i>10</i><i>20</i><i>30</i>
      <i>40</i><i>50</i><i>60</i>
    </span>
  `;
  table.appendChild(head);

  data.timeSlots.forEach(slot => {
    const row =
      document.createElement('div');
    row.className =
      'postit-time-row';

    const hour =
      document.createElement('span');
    hour.className =
      'postit-time-hour';
    hour.textContent = slot.hour;

    const blocks =
      document.createElement('div');
    blocks.className =
      'postit-time-blocks';

    slot.blocks.forEach(
      (blockColor, blockIndex) => {
        const cell =
          document.createElement(
            readOnly
              ? 'span'
              : 'button'
          );
        const color =
          normalizePostitColor(
            blockColor,
            ''
          );

        cell.className =
          'postit-time-cell'
          + (
            color
              ? ' painted'
              : ''
          );
        cell.style.backgroundColor =
          color;

        if (!readOnly) {
          cell.type = 'button';
          cell.setAttribute(
            'aria-label',
            `${slot.hour}시 ${
              (blockIndex + 1) * 10
            }분 블럭`
          );
          cell.setAttribute(
            'aria-pressed',
            color ? 'true' : 'false'
          );

          cell.addEventListener(
            'pointerdown',
            event => {
              event.preventDefault();
              postitTimePainting = true;
              const currentColor =
                normalizePostitColor(
                  slot.blocks[
                    blockIndex
                  ],
                  ''
                );
              postitTimePaintColor =
                currentColor
                  ? ''
                  : data.accentColor;
              applyPostitTimeBlock(
                slot,
                blockIndex,
                postitTimePaintColor,
                cell
              );
            }
          );
          cell.addEventListener(
            'pointerenter',
            () => {
              if (!postitTimePainting) {
                return;
              }
              applyPostitTimeBlock(
                slot,
                blockIndex,
                postitTimePaintColor,
                cell
              );
            }
          );
          cell.addEventListener(
            'keydown',
            event => {
              if (
                event.key !== 'Enter'
                && event.key !== ' '
              ) {
                return;
              }
              event.preventDefault();
              applyPostitTimeBlock(
                slot,
                blockIndex,
                slot.blocks[blockIndex]
                  ? ''
                  : data.accentColor,
                cell
              );
            }
          );
        }

        blocks.appendChild(cell);
      }
    );

    row.append(hour, blocks);
    table.appendChild(row);
  });

  tracker.appendChild(table);

  renderPostitTimeSummary(
    tracker,
    data
  );

  container.appendChild(tracker);
}

function renderPostitBody(
  container,
  note,
  readOnly = false
) {
  const data =
    ensurePostitData(note);
  container.innerHTML = '';

  if (data.type === 'habit') {
    renderPostitHabit(
      container,
      note,
      readOnly
    );
  } else if (data.type === 'weekly') {
    renderPostitWeekly(
      container,
      note,
      readOnly
    );
  } else if (data.type === 'time') {
    renderPostitTime(
      container,
      note,
      readOnly
    );
  } else {
    renderPostitList(
      container,
      note,
      readOnly
    );
  }

  if (
    data.type !== 'time'
    && data.tags.length
  ) {
    const tags =
      document.createElement('div');
    tags.className =
      'postit-paper-tags';
    tags.innerHTML =
      postitTagsHtml(data.tags);
    container.appendChild(tags);
  }
}

function renderPostitEditor(
  note = (
    typeof getCurrentNote === 'function'
      ? getCurrentNote()
      : null
  )
) {
  if (!note) return;

  const data =
    ensurePostitData(note);
  const paper =
    $('#postitEditorPaper');

  paper.className =
    postitPaperClass(data);
  paper.style.setProperty(
    '--postit-font-size',
    `${data.fontSize}px`
  );
  paper.style.setProperty(
    '--postit-accent',
    data.accentColor
  );

  $('#postitHeadingInput').value =
    data.heading;
  $('#postitFontSelect').value =
    note.fontKey || data.font;
  $('#postitFontSizeSelect').value =
    String(data.fontSize);
  $('#postitTagsInput').value =
    data.tags.join(', ');
  $('#postitTagPreview').innerHTML =
    postitTagsHtml(data.tags);
  $('#postitTagsSection').hidden =
    data.type === 'time';
  $('#postitColorHelp').textContent =
    data.type === 'time'
      ? '색상을 고른 뒤 시간 블럭을 칠하고, 아래에서 프로젝트명을 지정하세요.'
      : '체크 표시와 해빗 도트에 적용돼요.';
  $('#postitTimeProjectsPanel').hidden =
    data.type !== 'time';
  if (data.type === 'time') {
    renderPostitTimeProjects(data);
  }
  $('#postitCustomColor').value =
    data.accentColor;

  document
    .querySelectorAll(
      '[data-postit-type]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.postitType
          === data.type
      );
    });

  document
    .querySelectorAll(
      '[data-postit-color]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.postitColor
          === data.accentColor
      );
    });

  document
    .querySelectorAll(
      '[data-postit-skin]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.postitSkin
          === data.skin
      );
    });

  $('#postitAddRowBtn').textContent =
    data.type === 'habit'
      ? '+ 습관 추가'
      : data.type === 'weekly'
        ? '7일 구성'
        : '+ 항목 추가';
  $('#postitAddRowBtn').hidden =
    data.type === 'time';
  $('#postitAddRowBtn').disabled =
    data.type === 'weekly';

  renderPostitBody(
    $('#postitEditorContent'),
    note
  );
}

function setPostitType(type) {
  const note = getCurrentNote();
  if (!note || !POSTIT_TYPES[type]) {
    return;
  }

  const data =
    ensurePostitData(note);
  const previousDefault =
    POSTIT_TYPES[data.type].heading;

  data.type = type;
  data.skin =
    POSTIT_TYPES[type].skin;

  if (
    !data.heading
    || data.heading === previousDefault
  ) {
    data.heading =
      POSTIT_TYPES[type].heading;
  }

  renderPostitEditor(note);
  schedulePostitSave();
}

function addPostitRow() {
  const note = getCurrentNote();
  if (!note) return;
  const data =
    ensurePostitData(note);

  if (data.type === 'habit') {
    data.habits.push({
      id: uid(),
      text: '',
      checked: []
    });
  } else if (
    data.type !== 'weekly'
    && data.type !== 'time'
  ) {
    data.items.push({
      id: uid(),
      text: '',
      memo: '',
      linkedNoteId: '',
      done: false
    });
  }

  renderPostitEditor(note);
  schedulePostitSave();

  requestAnimationFrame(() => {
    $('#postitEditorContent .postit-list-row:last-child .postit-item-title')
      ?.focus();
  });
}

function postitSearchText(note) {
  const data =
    ensurePostitData(note);
  const parts = [
    data.heading,
    POSTIT_TYPES[data.type].label,
    ...data.tags,
    ...data.items.map(item => item.text),
    ...data.items.map(item => item.memo),
    ...data.weekly.map(item => item.text),
    ...data.habits.map(item => item.text),
    ...data.timeSlots.map(item => item.label),
    ...Object.values(
      data.timeProjects || {}
    )
  ];

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function renderPostitPreview(
  container,
  note
) {
  const data =
    ensurePostitData(note);
  container.className =
    `${postitPaperClass(data)} postit-paper-preview`;
  container.style.setProperty(
    '--postit-font-size',
    `${Math.max(
      10,
      data.fontSize * .68
    )}px`
  );
  container.style.setProperty(
    '--postit-accent',
    data.accentColor
  );

  const heading =
    document.createElement('strong');
  heading.className =
    'postit-preview-heading';
  heading.textContent =
    data.heading;

  const content =
    document.createElement('div');
  content.className =
    'postit-paper-content';
  renderPostitBody(
    content,
    note,
    true
  );

  container.replaceChildren(
    heading,
    content
  );
}

function renderPostitAlbum(notes) {
  const pagination =
    $('#postitAlbumPagination');
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        notes.length
        / POSTIT_PAGE_SIZE
      )
    );

  postitAlbumPage =
    Math.min(
      Math.max(
        1,
        postitAlbumPage
      ),
      totalPages
    );

  const start =
    (postitAlbumPage - 1)
    * POSTIT_PAGE_SIZE;

  notes
    .slice(
      start,
      start + POSTIT_PAGE_SIZE
    )
    .forEach(note => {
      const data =
        ensurePostitData(note);
      const card =
        document.createElement(
          'article'
        );

      card.className =
        'postit-album-card'
        + (
          archiveSelectionMode
            ? ' selection-mode'
            : ''
        )
        + (
          selectedArchiveNoteIds
            .has(note.id)
            ? ' selected'
            : ''
        );

      if (archiveSelectionMode) {
        card.insertAdjacentHTML(
          'beforeend',
          archiveSelectionButton(note.id)
        );
      }

      const open =
        document.createElement('button');
      open.type = 'button';
      open.className =
        'postit-album-open';

      const preview =
        document.createElement('span');
      renderPostitPreview(
        preview,
        note
      );

      const copy =
        document.createElement('span');
      copy.className =
        'postit-album-copy';
      copy.innerHTML = `
        <span class="postit-album-type">
          ${escapeHtml(POSTIT_TYPES[data.type].label)}
        </span>
        <strong>${escapeHtml(note.title || '제목 없음')}</strong>
        <small>${formatDate(note.updatedAt)}</small>
      `;

      open.append(preview, copy);
      open.addEventListener(
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
      card.appendChild(open);

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

      noteGrid.appendChild(card);
    });

  pagination.hidden =
    notes.length === 0;
  pagination.innerHTML = `
    <button
      type="button"
      data-postit-page="${postitAlbumPage - 1}"
      ${postitAlbumPage === 1 ? 'disabled' : ''}
      aria-label="이전 페이지"
    >‹</button>
    <span>
      ${
        Array.from(
          { length: totalPages },
          (_, index) => `
            <button
              type="button"
              class="${index + 1 === postitAlbumPage ? 'active' : ''}"
              data-postit-page="${index + 1}"
            >${index + 1}</button>
          `
        ).join('')
      }
    </span>
    <button
      type="button"
      data-postit-page="${postitAlbumPage + 1}"
      ${postitAlbumPage === totalPages ? 'disabled' : ''}
      aria-label="다음 페이지"
    >›</button>
  `;

  pagination
    .querySelectorAll(
      '[data-postit-page]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          postitAlbumPage =
            Number(
              button.dataset
                .postitPage
            );
          renderFolderGridView();
          folderGridView.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      );
    });
}

/* Legacy stand-alone todo view remains readable for old routes. */
function renderTodos() {
  if (!todoList || !todoEmpty) return;

  todoList.innerHTML = '';
  todoEmpty.hidden =
    todos.length !== 0;

  todos.forEach(todo => {
    const item =
      document.createElement('li');
    item.className =
      'todo-item'
      + (todo.done ? ' done' : '');
    item.innerHTML = `
      <button class="todo-checkbox" type="button" aria-label="완료 체크">
        <svg viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <span class="todo-text"></span>
      <button class="todo-del" type="button" aria-label="삭제">×</button>
    `;
    item.querySelector(
      '.todo-text'
    ).textContent = todo.text;
    item.querySelector(
      '.todo-checkbox'
    ).addEventListener('click', () => {
      todo.done = !todo.done;
      saveTodos();
      renderTodos();
    });
    item.querySelector(
      '.todo-del'
    ).addEventListener('click', () => {
      todos = todos.filter(
        current =>
          current.id !== todo.id
      );
      saveTodos();
      renderTodos();
    });
    todoList.appendChild(item);
  });
}

todoAddForm?.addEventListener(
  'submit',
  event => {
    event.preventDefault();
    const text =
      todoInput.value.trim();
    if (!text) return;
    todos.unshift({
      id: uid(),
      text,
      done: false
    });
    todoInput.value = '';
    saveTodos();
    renderTodos();
  }
);

document
  .querySelectorAll(
    '[data-postit-type]'
  )
  .forEach(button => {
    button.addEventListener(
      'click',
      () => setPostitType(
        button.dataset.postitType
      )
    );
  });

document
  .querySelectorAll(
    '[data-postit-skin]'
  )
  .forEach(button => {
    button.addEventListener(
      'click',
      () => {
        const note =
          getCurrentNote();
        if (!note) return;
        ensurePostitData(note).skin =
          button.dataset.postitSkin;
        renderPostitEditor(note);
        schedulePostitSave();
      }
    );
  });

function setPostitAccentColor(value) {
  const note = getCurrentNote();
  if (!note) return;
  const data =
    ensurePostitData(note);
  data.accentColor =
    normalizePostitColor(value);

  $('#postitEditorPaper')
    .style.setProperty(
      '--postit-accent',
      data.accentColor
    );
  $('#postitCustomColor').value =
    data.accentColor;

  document
    .querySelectorAll(
      '[data-postit-color]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.postitColor
          === data.accentColor
      );
    });

  if (data.type === 'time') {
    renderPostitTimeProjects(data);
  }

  schedulePostitSave();
}

document
  .querySelectorAll(
    '[data-postit-color]'
  )
  .forEach(button => {
    button.addEventListener(
      'click',
      () => setPostitAccentColor(
        button.dataset.postitColor
      )
    );
  });

$('#postitCustomColor')
  ?.addEventListener(
    'input',
    event => {
      setPostitAccentColor(
        event.target.value
      );
    }
  );

function finishPostitTimePainting() {
  const shouldFlush =
    postitTimePainting;
  postitTimePainting = false;
  postitTimePaintColor = '';

  if (!shouldFlush) return;

  const note = getCurrentNote();
  if (
    !note
    || note.template !== 'todo'
  ) {
    return;
  }

  const data = ensurePostitData(note);
  if (data.type !== 'time') return;

  note.updatedAt = Date.now();
  persistPostitTimeSnapshot(note, data);
  saveData();

  if (
    typeof persistDurableState
    === 'function'
  ) {
    persistDurableState(true);
  }
}

document.addEventListener(
  'pointerup',
  finishPostitTimePainting
);
document.addEventListener(
  'pointercancel',
  finishPostitTimePainting
);
window.addEventListener(
  'blur',
  finishPostitTimePainting
);

$('#postitHeadingInput')
  ?.addEventListener(
    'input',
    event => {
      const note =
        getCurrentNote();
      if (!note) return;
      ensurePostitData(note).heading =
        event.target.value;
      schedulePostitSave();
    }
  );

$('#postitFontSelect')
  ?.addEventListener(
    'change',
    event => {
      const note =
        getCurrentNote();
      if (!note) return;
      ensurePostitData(note).font =
        event.target.value;
      note.fontKey =
        event.target.value;
      renderPostitEditor(note);
      if (
        typeof applyEditorFont
        === 'function'
      ) {
        applyEditorFont(note);
      }
      schedulePostitSave();
    }
  );

$('#postitFontSizeSelect')
  ?.addEventListener(
    'change',
    event => {
      const note =
        getCurrentNote();
      if (!note) return;
      ensurePostitData(note).fontSize =
        Number(event.target.value);
      renderPostitEditor(note);
      schedulePostitSave();
    }
  );

$('#postitTagsInput')
  ?.addEventListener(
    'input',
    event => {
      const note =
        getCurrentNote();
      if (!note) return;
      const data =
        ensurePostitData(note);
      data.tags =
        event.target.value
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
      $('#postitTagPreview').innerHTML =
        postitTagsHtml(data.tags);

      const content =
        $('#postitEditorContent');
      content
        .querySelector(
          '.postit-paper-tags'
        )
        ?.remove();

      if (data.tags.length) {
        const tags =
          document.createElement('div');
        tags.className =
          'postit-paper-tags';
        tags.innerHTML =
          postitTagsHtml(data.tags);
        content.appendChild(tags);
      }

      schedulePostitSave();
    }
  );

$('#postitAddRowBtn')
  ?.addEventListener(
    'click',
    addPostitRow
  );

$('#postitNoteLinkCloseBtn')
  ?.addEventListener(
    'click',
    closePostitNoteLinkModal
  );

$('#postitNoteLinkSearch')
  ?.addEventListener(
    'input',
    event =>
      renderPostitNoteLinkResults(
        event.target.value
      )
  );
