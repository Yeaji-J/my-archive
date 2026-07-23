'use strict';

/* ---------------- Calendar ---------------- */

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

    await Promise.all(
      (data || []).map(
        async entry => {
          if (entry.image_path) {
            const { data: signedData } =
              await cloud.storage
                .from('calendar-images')
                .createSignedUrl(
                  entry.image_path,
                  3600
                );

            entry.image_url =
              signedData?.signedUrl
              || '';
          }

          calendarEntries.set(
            entry.entry_date,
            entry
          );
        }
      )
    );

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
          entry
            ? ' has-entry'
            : ''
        );

      const photoHtml =
        entry?.image_url
          ? `
            <img
              class="calendar-day-photo"
              src="${entry.image_url}"
              alt=""
            >
          `
          : '';

      const noteHtml =
        entry?.note
          ? `
            <span class="calendar-day-note">
              ${escapeHtml(entry.note)}
            </span>
          `
          : '';

      cell.innerHTML = `
        <span class="calendar-day-number">
          ${day}
        </span>

        ${photoHtml}
        ${noteHtml}
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

    selectedCalendarFile = null;

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

    calendarEntryNote.value =
      selectedCalendarEntry?.note
      || '';

    calendarPhotoInput.value = '';

    calendarEntryMessage.textContent =
      '';

    showCalendarPreview(
      selectedCalendarEntry?.image_url
      || ''
    );

    $('#calendarEntryDeleteBtn')
      .classList.toggle(
        'visible',
        Boolean(
          selectedCalendarEntry
        )
      );

    calendarEntryModal.hidden =
      false;

    scrim.classList.add('visible');

    setTimeout(
      () =>
        calendarEntryNote.focus(),
      50
    );
  }

  function showCalendarPreview(url) {
    calendarPhotoPreview.hidden =
      !url;

    calendarPhotoEmpty.hidden =
      Boolean(url);

    if (url) {
      calendarPhotoPreview.src = url;
    } else {
      calendarPhotoPreview
        .removeAttribute('src');
    }
  }

  function closeCalendarEntry() {
    calendarEntryModal.hidden = true;
    scrim.classList.remove('visible');

    selectedCalendarFile = null;
  }

  function previewCalendarPhoto(
    source
  ) {
    const file =
      source?.type
        ?.startsWith('image/')
        ? source
        : calendarPhotoInput
          .files?.[0];

    if (!file) return;

    calendarEntryMessage.textContent =
      '';

    if (
      !file.type.startsWith('image/')
    ) {
      calendarEntryMessage.textContent =
        '이미지 파일만 첨부할 수 있어요.';

      calendarPhotoInput.value = '';
      return;
    }

    if (
      file.size
      > 5 * 1024 * 1024
    ) {
      calendarEntryMessage.textContent =
        '사진은 5MB 이하로 선택해주세요.';

      calendarPhotoInput.value = '';
      return;
    }

    selectedCalendarFile = file;

    const previewUrl =
      URL.createObjectURL(file);

    showCalendarPreview(previewUrl);
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

    let imagePath =
      selectedCalendarEntry
        ?.image_path
      || null;

    if (selectedCalendarFile) {
      const extension = (
        selectedCalendarFile.name
          .split('.')
          .pop()
        || 'jpg'
      )
        .replace(
          /[^a-z0-9]/gi,
          ''
        )
        .toLowerCase();

      const newPath =
        `${currentUser.id}/`
        + `${selectedCalendarDate}-`
        + `${Date.now()}.${extension}`;

      const {
        error: uploadError
      } = await cloud.storage
        .from('calendar-images')
        .upload(
          newPath,
          selectedCalendarFile,
          {
            contentType:
              selectedCalendarFile.type,

            upsert: false
          }
        );

      if (uploadError) {
        console.error(
          'Calendar photo upload failed',
          uploadError
        );

        calendarEntryMessage.textContent =
          '사진 업로드에 실패했어요.';

        saveButton.disabled = false;
        return;
      }

      if (imagePath) {
        await cloud.storage
          .from('calendar-images')
          .remove([imagePath]);
      }

      imagePath = newPath;
    }

    const note =
      calendarEntryNote
        .value
        .trim();

    if (
      !note
      && !imagePath
    ) {
      calendarEntryMessage.textContent =
        '기록이나 사진을 하나 이상 추가해주세요.';

      saveButton.disabled = false;
      return;
    }

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
        '기록을 저장하지 못했어요.';

      return;
    }

    closeCalendarEntry();

    await loadCalendarEntries();
  }

  async function deleteCalendarEntry() {
    if (!selectedCalendarEntry) {
      return;
    }

    const shouldDelete =
      confirm(
        '이 날짜의 기록을 삭제할까요?'
      );

    if (!shouldDelete) return;

    const { error } =
      await cloud
        .from('calendar_entries')
        .delete()
        .eq(
          'user_id',
          currentUser.id
        )
        .eq(
          'entry_date',
          selectedCalendarDate
        );

    if (error) {
      console.error(
        'Calendar delete failed',
        error
      );

      calendarEntryMessage.textContent =
        '기록을 삭제하지 못했어요.';

      return;
    }

    if (
      selectedCalendarEntry.image_path
    ) {
      await cloud.storage
        .from('calendar-images')
        .remove([
          selectedCalendarEntry
            .image_path
        ]);
    }

    closeCalendarEntry();

    await loadCalendarEntries();
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
