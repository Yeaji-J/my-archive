'use strict';

/* ---------------- Rendering ---------------- */

  function render() {
    renderSidebarFolders();
    renderCounts();

    if (currentView === 'chat') {
      folderGridView.hidden = true;
      editorView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = true;
      chatView.hidden = false;

      breadcrumb.textContent = '채팅';

      renderChatRooms();
      return;
    }

    if (currentView === 'calendar') {
      folderGridView.hidden = true;
      editorView.hidden = true;
      chatView.hidden = true;
      todoView.hidden = true;
      calendarView.hidden = false;

      breadcrumb.textContent = '캘린더';

      renderCalendar();
      return;
    }

    if (currentView === 'todo') {
      folderGridView.hidden = true;
      editorView.hidden = true;
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = false;

      breadcrumb.textContent = '할 일';

      renderTodos();
      return;
    }

    chatView.hidden = true;
    calendarView.hidden = true;
    todoView.hidden = true;

    if (editorView.hidden) {
      renderFolderGridView();
    }
  }

  function renderCounts() {
    countAll.textContent =
      state.notes.length;

    countStarred.textContent =
      state.notes.filter(
        note => note.starred
      ).length;
  }

  function renderSidebarFolders() {
    folderList.innerHTML = '';

    state.folders.forEach(folder => {
      const count =
        state.notes.filter(
          note =>
            note.folderId === folder.id
        ).length;

      const item =
        document.createElement('li');

      item.className =
        'folder-item'
        + (
          currentView === folder.id
            ? ' active'
            : ''
        );

      item.innerHTML = `
        <span
          class="folder-dot"
          style="background:${folder.color}"
        ></span>

        <span class="folder-item-name">
          ${escapeHtml(folder.name)}
        </span>

        <span class="folder-item-count">
          ${count}
        </span>

        <button
          class="folder-del"
          aria-label="폴더 삭제"
          title="폴더 삭제"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke-linecap="round"
              stroke-width="2"
            />
          </svg>
        </button>
      `;

      item.addEventListener(
        'click',
        event => {
          if (
            event.target.closest(
              '.folder-del'
            )
          ) {
            return;
          }

          setView(folder.id);
        }
      );

      item
        .querySelector('.folder-del')
        .addEventListener(
          'click',
          event => {
            event.stopPropagation();
            deleteFolder(folder.id);
          }
        );

      folderList.appendChild(item);
    });
  }

  function setView(view) {
    currentView = view;
    closeEditor(false);

    document
      .querySelectorAll('.nav-item')
      .forEach(element => {
        element.classList.toggle(
          'active',
          element.dataset.view === view
        );
      });

    renderSidebarFolders();

    if (view === 'chat') {
      editorView.hidden = true;
      editorView.style.display = 'none';

      folderGridView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = true;
      chatView.hidden = false;

      breadcrumb.textContent = '채팅';

      renderChatRooms();

      if (currentUser) {
        loadChatRooms();
      }
    } else if (view === 'calendar') {
      editorView.hidden = true;
      editorView.style.display = 'none';

      folderGridView.hidden = true;
      chatView.hidden = true;
      todoView.hidden = true;
      calendarView.hidden = false;

      breadcrumb.textContent = '캘린더';

      renderCalendar();

      if (currentUser) {
        loadCalendarEntries();
      }
    } else if (view === 'todo') {
      editorView.hidden = true;
      editorView.style.display = 'none';

      folderGridView.hidden = true;
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = false;

      breadcrumb.textContent = '할 일';

      renderTodos();
    } else {
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = true;
      folderGridView.hidden = false;

      renderFolderGridView();
    }

    closeSidebarMobile();
  }

  function currentBreadcrumb() {
    if (currentView === 'all') {
      return '전체 자료';
    }

    if (currentView === 'starred') {
      return '즐겨찾기';
    }

    const folder =
      state.folders.find(
        item => item.id === currentView
      );

    return folder
      ? folder.name
      : '전체 자료';
  }

  function getFilteredNotes() {
    let notes = state.notes.slice();

    if (currentView === 'starred') {
      notes =
        notes.filter(
          note => note.starred
        );
    } else if (
      currentView !== 'all'
    ) {
      notes =
        notes.filter(
          note =>
            note.folderId === currentView
        );
    }

    if (searchTerm.trim()) {
      const term =
        searchTerm
          .trim()
          .toLowerCase();

      notes = notes.filter(note =>
        note.title
          .toLowerCase()
          .includes(term)
        || note.content
          .toLowerCase()
          .includes(term)
      );
    }

    return notes.sort(
      (first, second) =>
        second.updatedAt
        - first.updatedAt
    );
  }

  function renderFolderGridView() {
    breadcrumb.textContent =
      currentBreadcrumb();

    const showFolders =
      currentView === 'all'
      && !searchTerm.trim();

    folderGrid.style.display =
      showFolders
      && state.folders.length
        ? 'grid'
        : 'none';

    notesDividerWrap.style.display =
      showFolders
      && state.folders.length
        ? 'flex'
        : 'none';

    folderGrid.innerHTML = '';

    if (showFolders) {
      state.folders.forEach(folder => {
        const count =
          state.notes.filter(
            note =>
              note.folderId === folder.id
          ).length;

        const card =
          document.createElement('div');

        card.className = 'folder-card';

        card.style.setProperty(
          '--folder-color',
          folder.color
        );

        card.innerHTML = `
          <button
            class="folder-card-del"
            aria-label="폴더 삭제"
            title="폴더 삭제"
          >
            <svg viewBox="0 0 24 24">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke-linecap="round"
                stroke-width="2"
              />
            </svg>
          </button>

          <div class="folder-icon"></div>

          <div class="folder-card-name">
            ${escapeHtml(folder.name)}
          </div>

          <div class="folder-card-count">
            ${count}개 자료
          </div>
        `;

        card.addEventListener(
          'click',
          event => {
            if (
              event.target.closest(
                '.folder-card-del'
              )
            ) {
              return;
            }

            setView(folder.id);
          }
        );

        card
          .querySelector(
            '.folder-card-del'
          )
          .addEventListener(
            'click',
            event => {
              event.stopPropagation();
              deleteFolder(folder.id);
            }
          );

        folderGrid.appendChild(card);
      });
    }

    const notes = getFilteredNotes();

    noteGrid.classList.toggle(
      'list-mode',
      !gridMode
    );

    noteGrid.innerHTML = '';

    emptyState.hidden =
      notes.length !== 0;

    notes.forEach(note => {
      const folder =
        state.folders.find(
          item =>
            item.id === note.folderId
        );

      const card =
        document.createElement('div');

      card.className = 'note-card';

      card.style.setProperty(
        '--folder-color',
        folder?.color || '#dce8f3'
      );

      card.classList.toggle(
        'no-folder',
        !folder
      );

      card.innerHTML = `
        <div class="note-card-top">
          <div class="note-card-title">
            ${escapeHtml(
              note.title || '제목 없음'
            )}
          </div>

          ${
            note.starred
              ? `
                <span class="note-card-star">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.6l1.4-6.6-5-4.6 6.6-.7z"
                    />
                  </svg>
                </span>
              `
              : ''
          }
        </div>

        <div class="note-card-snippet">
          ${
            escapeHtml(note.content || '')
            || '<span style="opacity:.5">내용 없음</span>'
          }
        </div>

        <div class="note-card-bottom">
          ${
            folder
              ? `
                <span
                  class="note-card-folder-dot"
                  style="background:${folder.color}"
                ></span>

                <span class="note-card-date">
                  ${escapeHtml(folder.name)}
                  · ${formatDate(note.updatedAt)}
                </span>
              `
              : `
                <span class="note-card-date">
                  ${formatDate(note.updatedAt)}
                </span>
              `
          }
        </div>
      `;

      card.addEventListener(
        'click',
        () => openEditor(note.id)
      );

      noteGrid.appendChild(card);
    });
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    const sameYear =
      date.getFullYear()
      === now.getFullYear();

    return date.toLocaleDateString(
      'ko-KR',
      {
        year:
          sameYear
            ? undefined
            : 'numeric',

        month: 'long',
        day: 'numeric'
      }
    );
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]
    );
  }

  /* ---------------- Editor ---------------- */

  function openEditor(noteId) {
    currentNoteId = noteId;

    const note =
      state.notes.find(
        item => item.id === noteId
      );

    if (!note) return;

    noteTitle.value = note.title;
    noteContent.value = note.content;

    updateEditorMeta(note);
    populateFolderSelect(note.folderId);

    starBtn.classList.toggle(
      'active',
      Boolean(note.starred)
    );

    folderGridView.hidden = true;
    chatView.hidden = true;
    calendarView.hidden = true;
    todoView.hidden = true;

    editorView.hidden = false;
    editorView.style.display = 'flex';

    noteTitle.focus();
  }

  function updateEditorMeta(note) {
    noteMeta.textContent =
      `마지막 수정: ${
        formatDate(note.updatedAt)
      }`;
  }

  function populateFolderSelect(
    selectedId
  ) {
    folderSelect.innerHTML =
      '<option value="">폴더 없음</option>'
      + state.folders
        .map(folder => `
          <option
            value="${folder.id}"
            ${
              folder.id === selectedId
                ? 'selected'
                : ''
            }
          >
            ${escapeHtml(folder.name)}
          </option>
        `)
        .join('');
  }

  function closeEditor(
    rerender = true
  ) {
    if (currentNoteId) {
      persistCurrentNote();
    }

    currentNoteId = null;

    editorView.hidden = true;
    editorView.style.display = 'none';

    if (
      currentView !== 'chat'
      && currentView !== 'calendar'
      && currentView !== 'todo'
    ) {
      folderGridView.hidden = false;
    }

    if (currentView === 'todo') {
      todoView.hidden = false;
      renderTodos();
    }

    if (
      rerender
      && currentView !== 'calendar'
      && currentView !== 'todo'
    ) {
      renderFolderGridView();
    }

    renderSidebarFolders();
    renderCounts();
  }

  function persistCurrentNote() {
    const note =
      state.notes.find(
        item =>
          item.id === currentNoteId
      );

    if (!note) return;

    const changed =
      note.title !== noteTitle.value
      || note.content !== noteContent.value;

    note.title = noteTitle.value;
    note.content = noteContent.value;

    if (changed) {
      note.updatedAt = Date.now();
      updateEditorMeta(note);
    }

    saveData();
  }

  function createNote() {
    if (
      currentView === 'chat'
      || currentView === 'calendar'
      || currentView === 'todo'
    ) {
      setView('all');
    }

    const excludedViews = [
      'all',
      'starred',
      'chat',
      'calendar',
      'todo'
    ];

    const folderId =
      !excludedViews.includes(currentView)
        ? currentView
        : state.folders[0]?.id || '';

    const note = {
      id: uid(),
      title: '',
      content: '',
      folderId,
      starred: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    state.notes.unshift(note);

    saveData();
    render();
    openEditor(note.id);
  }

  function deleteCurrentNote() {
    if (!currentNoteId) return;

    state.notes =
      state.notes.filter(
        note =>
          note.id !== currentNoteId
      );

    saveData();

    currentNoteId = null;
    editorView.hidden = true;
    editorView.style.display = 'none';
    folderGridView.hidden = false;

    render();
  }
