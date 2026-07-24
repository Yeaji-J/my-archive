'use strict';

/* ---------------- 02 Post-it template ---------------- */

const POSTIT_PAGE_SIZE = 12;
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
const POSTIT_FONTS = [
  'pretendard',
  'handwriting',
  'serif'
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
    { length: 21 },
    (_, index) => ({
      id: uid(),
      hour: String(
        (index + 5) % 24
      ).padStart(2, '0'),
      label: '',
      blocks: Array(6).fill('')
    })
  );
}

function normalizePostitColor(
  value,
  fallback = '#7F9FC0'
) {
  const color =
    String(value || '').trim();

  return /^#[0-9a-f]{6}$/i.test(color)
    ? color.toUpperCase()
    : fallback;
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
      accentColor: '#7F9FC0',
      tags: [],
      items: blankPostitItems(10),
      weekly: blankWeeklyRows(),
      habitMonth: postitMonthValue(),
      habits: blankHabitRows(),
      timeSlots: blankTimeSlots()
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

  data.items.forEach(item => {
    item.id = item.id || uid();
    item.text = item.text || '';
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
  data.timeSlots =
    blankTimeSlots().map(
      (fallback, index) => {
        const current =
          data.timeSlots[index]
          || {};
        const blocks =
          Array.from(
            { length: 6 },
            (_, blockIndex) =>
              normalizePostitColor(
                current.blocks
                  ?.[blockIndex],
                ''
              )
          );

        return {
          id: current.id || fallback.id,
          hour: fallback.hour,
          label:
            String(current.label || ''),
          blocks
        };
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
  clearTimeout(postitSaveTimer);
  postitSaveTimer = setTimeout(() => {
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
    saveData();

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

    row.append(check, input);

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
  slot.blocks[blockIndex] = color;
  cell.classList.toggle(
    'painted',
    Boolean(color)
  );
  cell.style.backgroundColor =
    color || '';
  cell.setAttribute(
    'aria-pressed',
    color ? 'true' : 'false'
  );
  schedulePostitSave();
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
    <span>NOTE</span>
  `;
  tracker.appendChild(head);

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
              postitTimePaintColor =
                color === data.accentColor
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
                  === data.accentColor
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

    const label =
      document.createElement(
        readOnly ? 'span' : 'input'
      );
    label.className =
      'postit-time-label';

    if (readOnly) {
      label.textContent =
        slot.label || '';
    } else {
      label.type = 'text';
      label.maxLength = 40;
      label.value =
        slot.label || '';
      label.placeholder = '일정';
      label.addEventListener(
        'input',
        event => {
          slot.label =
            event.target.value;
          schedulePostitSave();
        }
      );
    }

    row.append(hour, blocks, label);
    tracker.appendChild(row);
  });

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

  if (data.tags.length) {
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
    data.font;
  $('#postitFontSizeSelect').value =
    String(data.fontSize);
  $('#postitTagsInput').value =
    data.tags.join(', ');
  $('#postitTagPreview').innerHTML =
    postitTagsHtml(data.tags);
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
        : data.type === 'time'
          ? '10분 단위 구성'
        : '+ 항목 추가';
  $('#postitAddRowBtn').disabled =
    data.type === 'weekly'
    || data.type === 'time';

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
      done: false
    });
  }

  renderPostitEditor(note);
  schedulePostitSave();

  requestAnimationFrame(() => {
    $('#postitEditorContent input:last-of-type')
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
    ...data.weekly.map(item => item.text),
    ...data.habits.map(item => item.text),
    ...data.timeSlots.map(item => item.label)
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
  ensurePostitData(note).accentColor =
    normalizePostitColor(value);
  renderPostitEditor(note);
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

document.addEventListener(
  'pointerup',
  () => {
    postitTimePainting = false;
    postitTimePaintColor = '';
  }
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
      renderPostitEditor(note);
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
