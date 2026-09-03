'use strict';

/* ---------------- Calendar ---------------- */

  const CALENDAR_SCHEDULES_PREFIX =
    'archive:schedules:v1:';

  function dateKey(date) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function calendarNoteDateKey(note) {
    const rawTimestamp =
      note?.createdAt
      || note?.updatedAt;
    const timestamp =
      Number(rawTimestamp)
      || Date.parse(rawTimestamp);
    if (!timestamp) return '';
    return dateKey(new Date(timestamp));
  }

  function calendarNotesForDate(key) {
    return (state.notes || [])
      .filter(note =>
        ['memo', 'todo', 'moodboard']
          .includes(note.template || 'memo')
        && calendarNoteDateKey(note) === key
      )
      .sort(
        (first, second) =>
          Number(second.createdAt || second.updatedAt)
          - Number(first.createdAt || first.updatedAt)
      );
  }

  function calendarNoteTypeLabel(note) {
    const template = note.template || 'memo';
    if (template === 'todo') {
      return POSTIT_TYPES[
        ensurePostitData(note).type
      ]?.label || '포스트잇';
    }
    return template === 'moodboard'
      ? '무드보드'
      : '메모';
  }

  function calendarNoteSummary(note) {
    const template = note.template || 'memo';
    if (template === 'todo') {
      const data = ensurePostitData(note);
      if (data.type === 'time') {
        return `총 ${postitTimeTotals(data).totalMinutes}분 기록`;
      }
      if (data.type === 'weekly') {
        return data.weekly
          .map(item => item.text)
          .filter(Boolean)
          .slice(0, 2)
          .join(' · ')
          || '아직 작성된 계획이 없어요.';
      }
      if (data.type === 'habit') {
        return data.habits
          .map(item => item.text)
          .filter(Boolean)
          .slice(0, 2)
          .join(' · ')
          || '아직 작성된 습관이 없어요.';
      }
      return data.items
        .map(item => item.text)
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ')
        || '아직 작성된 항목이 없어요.';
    }
    if (template === 'moodboard') {
      const count =
        note.moodboard?.items?.length || 0;
      return `이미지와 텍스트 ${count}개`;
    }
    return String(
      note.content
      || note.memoData?.html
      || ''
    )
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90)
      || '내용 없는 메모';
  }

  function calendarFeaturedNotes(notes) {
    return notes.filter(note => {
      if (note.template !== 'todo') {
        return false;
      }
      const type =
        ensurePostitData(note).type;
      return type === 'todo'
        || type === 'time';
    });
  }

  function calendarSchedules(entry) {
    const rawNote = String(entry?.note || '');
    if (!rawNote) return [];

    if (
      rawNote.startsWith(
        CALENDAR_SCHEDULES_PREFIX
      )
    ) {
      try {
        const parsed = JSON.parse(
          rawNote.slice(
            CALENDAR_SCHEDULES_PREFIX.length
          )
        );
        if (Array.isArray(parsed)) {
          return parsed
            .map((schedule, index) => ({
              id: String(
                schedule?.id
                || `schedule-${index}`
              ),
              time: String(
                schedule?.time || ''
              ).slice(0, 5),
              text: String(
                schedule?.text || ''
              ).trim()
            }))
            .filter(schedule => schedule.text)
            .sort((first, second) =>
              first.time.localeCompare(second.time)
            );
        }
      } catch (error) {
        console.warn(
          'Calendar schedule parse failed',
          error
        );
      }
    }

    const legacyMatch = rawNote.match(
      /^(\d{1,2}:\d{2})\s+(.+)$/s
    );
    return [{
      id: `legacy-${entry?.id || entry?.entry_date || 'entry'}`,
      time: legacyMatch
        ? legacyMatch[1].padStart(5, '0')
        : '',
      text: legacyMatch
        ? legacyMatch[2].trim()
        : rawNote.trim()
    }];
  }

  function serializeCalendarSchedules(
    schedules
  ) {
    return CALENDAR_SCHEDULES_PREFIX
      + JSON.stringify(schedules);
  }

  function calendarScheduleText(schedule) {
    return [schedule.time, schedule.text]
      .filter(Boolean)
      .join(' ');
  }

  async function loadCalendarEntries() {
    if (!currentUser) return;

    const firstDate = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth(),
      1
    );

    const nextMonth = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth() + 1,
      1
    );

    const { data, error } = await cloud
      .from('calendar_entries')
      .select('*')
      .eq(
        'user_id',
        currentUser.id
      )
      .gte(
        'entry_date',
        dateKey(firstDate)
      )
      .lt(
        'entry_date',
        dateKey(nextMonth)
      );

    if (error) {
      console.error(
        'Calendar load failed',
        error
      );

      return;
    }

    calendarEntries.clear();

    (data || []).forEach(entry => {
      calendarEntries.set(
        entry.entry_date,
        entry
      );
    });

    renderCalendar();
  }

  function renderCalendar() {
    if (
      !calendarGrid
      || !calendarMonthTitle
    ) {
      return;
    }

    const year =
      calendarCursor.getFullYear();

    const month =
      calendarCursor.getMonth();

    calendarMonthTitle.textContent =
      `${year}년 ${month + 1}월`;

    const firstDay =
      new Date(
        year,
        month,
        1
      ).getDay();

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const previousMonthDays =
      new Date(
        year,
        month,
        0
      ).getDate();

    const todayKey =
      dateKey(new Date());

    calendarGrid.innerHTML = '';

    for (
      let index = 0;
      index < 42;
      index += 1
    ) {
      let day;
      let cellDate;
      let outside = false;

      if (index < firstDay) {
        day =
          previousMonthDays
          - firstDay
          + index
          + 1;

        cellDate = new Date(
          year,
          month - 1,
          day
        );

        outside = true;
      } else if (
        index
        >= firstDay + daysInMonth
      ) {
        day =
          index
          - firstDay
          - daysInMonth
          + 1;

        cellDate = new Date(
          year,
          month + 1,
          day
        );

        outside = true;
      } else {
        day =
          index
          - firstDay
          + 1;

        cellDate = new Date(
          year,
          month,
          day
        );
      }

      const key =
        dateKey(cellDate);

      const entry =
        outside
          ? null
          : calendarEntries.get(key);
      const notes =
        outside
          ? []
          : calendarNotesForDate(key);
      const featuredNotes =
        calendarFeaturedNotes(notes);

      const cell =
        document.createElement(
          'button'
        );

      cell.type = 'button';

      cell.className =
        'calendar-day'
        + (
          outside
            ? ' outside'
            : ''
        )
        + (
          index % 7 === 0
            ? ' sunday'
            : ''
        )
        + (
          key === todayKey
            ? ' today'
            : ''
        )
        + (
          entry || notes.length
            ? ' has-entry'
            : ''
        );

      const schedules =
        calendarSchedules(entry);
      const noteHtml = schedules.length
        ? `
          <span class="calendar-day-note">
            ${schedules
              .slice(0, 2)
              .map(schedule => `
                <span>${escapeHtml(calendarScheduleText(schedule))}</span>
              `)
              .join('')}
            ${schedules.length > 2
              ? `<small>+${schedules.length - 2}</small>`
              : ''}
          </span>
        `
        : '';

      const featuredHtml =
        featuredNotes
          .slice(0, 2)
          .map(note => {
            const data =
              ensurePostitData(note);
            const detail =
              data.type === 'time'
                ? `${postitTimeTotals(data).totalMinutes}분`
                : `${
                    data.items.filter(
                      item =>
                        item.text
                        && !item.done
                    ).length
                  }개 남음`;

            return `
              <span class="calendar-day-record calendar-day-record-${data.type}">
                <i></i>
                <span>${escapeHtml(note.title || data.heading)}</span>
                <strong>${detail}</strong>
              </span>
            `;
          })
          .join('');

      const moreHtml =
        featuredNotes.length > 2
          ? `<span class="calendar-day-more">+${featuredNotes.length - 2}</span>`
          : '';

      cell.innerHTML = `
        <span class="calendar-day-number">
          ${day}
        </span>

        ${noteHtml}
        <span class="calendar-day-records">
          ${featuredHtml}
          ${moreHtml}
        </span>
      `;

      cell.addEventListener(
        'click',
        () => openCalendarEntry(
          cellDate
        )
      );

      calendarGrid.appendChild(cell);
    }
  }

  function renderCalendarDateNotes(
    key
  ) {
    const list = $('#calendarDateNotes');
    if (!list) return;

    const notes =
      calendarNotesForDate(key);
    $('#calendarDateNotesCount')
      .textContent = String(notes.length);
    list.innerHTML = '';

    if (!notes.length) {
      list.innerHTML = `
        <p class="calendar-date-notes-empty">
          이 날짜에 올라온 자료가 없어요.
        </p>
      `;
      return;
    }

    notes.forEach(note => {
      const button =
        document.createElement('button');
      button.type = 'button';
      button.className =
        `calendar-date-note calendar-date-note-${note.template || 'memo'}`;
      button.innerHTML = `
        <span class="calendar-date-note-type">
          ${escapeHtml(calendarNoteTypeLabel(note))}
        </span>
        <strong>${escapeHtml(note.title || '제목 없음')}</strong>
        <small>${escapeHtml(calendarNoteSummary(note))}</small>
      `;
      button.addEventListener(
        'click',
        () => {
          closeCalendarEntry();
          openNoteView(note.id);
        }
      );
      list.appendChild(button);
    });
  }

  function renderCalendarSchedules() {
    const section =
      $('#calendarScheduleSection');
    const list =
      $('#calendarScheduleList');
    if (!section || !list) return;

    const schedules = calendarSchedules(
      selectedCalendarEntry
    );
    section.hidden = !schedules.length;
    list.innerHTML = '';

    schedules.forEach(schedule => {
      const row =
        document.createElement('div');
      row.className =
        'calendar-schedule-row';
      row.innerHTML = `
        <time>${escapeHtml(schedule.time || '시간 미정')}</time>
        <span>${escapeHtml(schedule.text)}</span>
        <button type="button" aria-label="${escapeHtml(schedule.text)} 일정 삭제">×</button>
      `;
      row.querySelector('button')
        .addEventListener(
          'click',
          () => deleteCalendarSchedule(
            schedule.id
          )
        );
      list.appendChild(row);
    });
  }

  function openCalendarEntry(date) {
    if (!currentUser) {
      openAuthModal();
      return;
    }

    selectedCalendarDate =
      dateKey(date);

    selectedCalendarEntry =
      calendarEntries.get(
        selectedCalendarDate
      ) || null;

    calendarEntryDate.textContent =
      date.toLocaleDateString(
        'ko-KR',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        }
      );

    calendarEntryTime.value = '';
    calendarEntryNote.value = '';

    calendarEntryMessage.textContent =
      '';
    $('#calendarEntryHeading').textContent =
      '일정 추가';
    renderCalendarSchedules();
    renderCalendarDateNotes(
      selectedCalendarDate
    );

    calendarEntryModal.hidden =
      false;

    scrim.classList.add('visible');

    setTimeout(
      () =>
        calendarEntryTime.focus(),
      50
    );
  }

  function closeCalendarEntry() {
    calendarEntryModal.hidden = true;
    scrim.classList.remove('visible');
  }

  async function saveCalendarEntry(
    event
  ) {
    event.preventDefault();

    if (
      !currentUser
      || !selectedCalendarDate
    ) {
      return;
    }

    const saveButton =
      $('#calendarEntrySaveBtn');

    saveButton.disabled = true;

    calendarEntryMessage.textContent =
      '저장 중…';

    const imagePath =
      selectedCalendarEntry
        ?.image_path
      || null;

    const time =
      calendarEntryTime
        .value
        .trim();
    const scheduleText =
      calendarEntryNote
        .value
        .trim();

    if (!time || !scheduleText) {
      calendarEntryMessage.textContent =
        '시간과 일정을 모두 입력해주세요.';

      saveButton.disabled = false;
      return;
    }

    const schedules = [
      ...calendarSchedules(
        selectedCalendarEntry
      ),
      {
        id: uid(),
        time,
        text: scheduleText
      }
    ].sort((first, second) =>
      first.time.localeCompare(second.time)
    );
    const note =
      serializeCalendarSchedules(
        schedules
      );

    const { error } =
      await cloud
        .from('calendar_entries')
        .upsert(
          {
            user_id: currentUser.id,
            entry_date:
              selectedCalendarDate,
            note,
            image_path: imagePath,
            updated_at:
              new Date()
                .toISOString()
          },
          {
            onConflict:
              'user_id,entry_date'
          }
        );

    saveButton.disabled = false;

    if (error) {
      console.error(
        'Calendar save failed',
        error
      );

      calendarEntryMessage.textContent =
        '일정을 저장하지 못했어요.';

      return;
    }

    await loadCalendarEntries();
    selectedCalendarEntry =
      calendarEntries.get(
        selectedCalendarDate
      ) || null;
    calendarEntryTime.value = '';
    calendarEntryNote.value = '';
    calendarEntryMessage.textContent = '';
    renderCalendarSchedules();
    calendarEntryTime.focus();
  }

  async function deleteCalendarSchedule(
    scheduleId
  ) {
    if (
      !selectedCalendarEntry
      || !currentUser
    ) {
      return;
    }

    const schedules =
      calendarSchedules(
        selectedCalendarEntry
      ).filter(
        schedule =>
          schedule.id !== scheduleId
      );
    const query = cloud
      .from('calendar_entries');
    const result = schedules.length
      ? await query.upsert(
          {
            user_id: currentUser.id,
            entry_date:
              selectedCalendarDate,
            note:
              serializeCalendarSchedules(
                schedules
              ),
            image_path:
              selectedCalendarEntry
                .image_path || null,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              'user_id,entry_date'
          }
        )
      : await query
          .delete()
          .eq(
            'user_id',
            currentUser.id
          )
          .eq(
            'entry_date',
            selectedCalendarDate
          );
    const { error } = result;

    if (error) {
      console.error(
        'Calendar schedule delete failed',
        error
      );

      calendarEntryMessage.textContent =
        '일정을 삭제하지 못했어요.';

      return;
    }

    if (
      !schedules.length
      && selectedCalendarEntry.image_path
    ) {
      await cloud.storage
        .from('calendar-images')
        .remove([
          selectedCalendarEntry
            .image_path
        ]);
    }

    await loadCalendarEntries();
    selectedCalendarEntry =
      calendarEntries.get(
        selectedCalendarDate
      ) || null;
    renderCalendarSchedules();
  }

  function moveCalendarMonth(offset) {
    calendarCursor = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth()
        + offset,
      1
    );

    calendarEntries.clear();
    renderCalendar();

    if (currentUser) {
      loadCalendarEntries();
    }
  }
