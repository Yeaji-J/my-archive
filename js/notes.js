'use strict';

/* ---------------- Rendering ---------------- */

  function render() {
    renderSidebarFolders();
    renderSidebarTemplateLinks();
    renderCounts();
    document.body.classList.toggle(
      'chat-view-active',
      currentView === 'chat'
    );

    if (currentView === 'chat') {
      $('#quickChatNote').hidden = true;
    }

    if (currentView === 'home') {
      noteDetailView.hidden = true;
      folderGridView.hidden = true;
      editorView.hidden = true;
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = true;
      homeView.hidden = false;
      breadcrumb.textContent = '홈';
      renderHomeDashboard();
      return;
    }

    homeView.hidden = true;

    if (currentView === 'chat') {
      noteDetailView.hidden = true;
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
      noteDetailView.hidden = true;
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
      noteDetailView.hidden = true;
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

  function renderSidebarTemplateLinks() {
    document
      .querySelectorAll('[data-sidebar-template]')
      .forEach(button => {
        const template =
          button.dataset.sidebarTemplate;
        const count =
          state.notes.filter(
            note =>
              (note.template || 'memo')
              === template
          ).length;

        const countElement =
          button.querySelector(
            `[data-template-count="${template}"]`
          );

        if (countElement) {
          countElement.textContent = count;
        }

        button.classList.toggle(
          'active',
          currentView === 'all'
          && browseMode === 'template'
          && browseTemplate === template
        );
      });
  }

  function setView(view, updateHistory = true) {
    if (updateHistory && typeof pushArchiveRoute === 'function') {
      pushArchiveRoute(routeForView(view));
    }
    currentView = view;
    document.body.classList.toggle(
      'chat-view-active',
      view === 'chat'
    );

    if (view === 'chat') {
      $('#quickChatNote').hidden = true;
    }
    if (view !== 'all') {
      browseMode = 'folder';
    }
    currentNoteViewId = null;
    noteDetailView.hidden = true;
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
    renderSidebarTemplateLinks();

    if (view === 'home') {
      editorView.hidden = true;
      editorView.style.display = 'none';
      folderGridView.hidden = true;
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = true;
      homeView.hidden = false;
      breadcrumb.textContent = '홈';
      renderHomeDashboard();
    } else if (view === 'chat') {
      homeView.hidden = true;
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
      homeView.hidden = true;
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
      homeView.hidden = true;
      editorView.hidden = true;
      editorView.style.display = 'none';

      folderGridView.hidden = true;
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = false;

      breadcrumb.textContent = '할 일';

      renderTodos();
    } else {
      homeView.hidden = true;
      chatView.hidden = true;
      calendarView.hidden = true;
      todoView.hidden = true;
      folderGridView.hidden = false;

      renderFolderGridView();
    }

    closeSidebarMobile();
  }

  function currentBreadcrumb() {
    if (currentView === 'home') {
      return '홈';
    }
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

    if (
      currentView === 'all'
      && browseMode === 'template'
    ) {
      if (browseTemplate !== 'all') {
        notes = notes.filter(
          note => (note.template || 'memo') === browseTemplate
        );
      }

      if (browseSecondaryFilter !== 'all') {
        notes = notes.filter(
          note => getBrowseSecondaryValue(note) === browseSecondaryFilter
        );
      }
    } else if (currentView === 'starred') {
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

      notes = notes.filter(note => {
        const searchable = typeof templateSearchText === 'function'
          ? templateSearchText(note)
          : `${note.title || ''} ${note.content || ''}`.toLowerCase();
        return searchable.includes(term);
      });
    }

    return notes.sort(
      (first, second) =>
        second.updatedAt
        - first.updatedAt
    );
  }

  function getBrowseSecondaryValue(note) {
    if ((note.template || 'memo') === 'collection') {
      return note.collectionData?.type || '기타';
    }
    if ((note.template || 'memo') === 'links') {
      return note.linkData?.category || '미분류';
    }
    return 'all';
  }

  function renderArchiveBrowserControls() {
    archiveViewSwitch
      .querySelectorAll('[data-browse-mode]')
      .forEach(button => {
        button.classList.toggle('active', button.dataset.browseMode === browseMode);
      });

    archiveTemplateFilters.hidden = browseMode !== 'template';
    archiveTemplateFilters
      .querySelectorAll('[data-template-filter]')
      .forEach(button => {
        button.classList.toggle('active', button.dataset.templateFilter === browseTemplate);
      });

    const supportsSecondary =
      browseMode === 'template'
      && ['links', 'collection'].includes(browseTemplate);

    archiveSecondaryFilters.hidden = !supportsSecondary;
    archiveSecondaryFilters.innerHTML = '';

    if (supportsSecondary) {
      const values = [...new Set(
        state.notes
          .filter(note => (note.template || 'memo') === browseTemplate)
          .map(getBrowseSecondaryValue)
      )];

      ['all', ...values].forEach(value => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.secondaryFilter = value;
        button.classList.toggle('active', value === browseSecondaryFilter);
        button.textContent = value === 'all' ? '전체' : value;
        button.addEventListener('click', () => {
          browseSecondaryFilter = value;
          renderFolderGridView();
        });
        archiveSecondaryFilters.appendChild(button);
      });
    }

    renderSidebarTemplateLinks();
  }

  function noteCardPreview(note) {
    const template = note.template || 'memo';
    if (template === 'todo') {
      const remaining = todos.filter(todo => !todo.done).length;
      return `남은 할 일 ${remaining}개 · 전체 ${todos.length}개`;
    }
    if (template === 'moodboard') {
      const board = note.moodboard || { items: [] };
      return `이미지와 텍스트 ${board.items?.length || 0}개가 담긴 무드보드`;
    }
    if (template === 'links') {
      return note.linkData?.description || note.linkData?.url || '저장된 링크';
    }
    if (template === 'collection') {
      return note.collectionData?.oneLine || note.collectionData?.content || '컬렉션 기록';
    }
    return note.content || '';
  }

  function templateCardLabel(note) {
    return ({
      memo: 'MEMO',
      todo: 'TO DO',
      moodboard: 'MOODBOARD',
      links: 'LINK',
      collection: note.collectionData?.type?.toUpperCase?.() || 'COLLECTION'
    })[note.template || 'memo'];
  }

  function renderFolderGridView() {
    renderArchiveBrowserControls();

    breadcrumb.textContent =
      currentBreadcrumb();

    const selectedFolder =
      state.folders.find(
        folder => folder.id === currentView
      );

    const folderContext =
      $('#folderContext');

    folderContext.hidden =
      !selectedFolder;

    if (selectedFolder) {
      const selectedCount =
        state.notes.filter(
          note =>
            note.folderId === selectedFolder.id
        ).length;

      $('#folderContextIcon')
        .style.setProperty(
          '--folder-color',
          selectedFolder.color
        );

      $('#folderContextName').textContent =
        selectedFolder.name;

      $('#folderContextCount').textContent =
        `${selectedCount}개 자료`;
    }

    const showFolders =
      currentView === 'all'
      && browseMode === 'folder'
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
        : browseMode === 'template'
          ? 'flex'
          : 'none';

    notesDividerWrap.querySelector('span').textContent =
      browseMode === 'template'
        ? browseTemplate === 'all'
          ? '모든 템플릿'
          : templateCardLabel({ template: browseTemplate })
        : '모든 자료';

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

    let notes = getFilteredNotes();
    const memoAlbumMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate === 'memo';

    $('#memoAlbumBar').hidden =
      !memoAlbumMode;

    if (memoAlbumMode) {
      const query =
        memoAlbumSearchTerm
          .trim()
          .toLowerCase();

      if (query) {
        notes = notes.filter(note =>
          `${note.title || ''} ${note.content || ''}`
            .toLowerCase()
            .includes(query)
        );
      }

      $('#memoAlbumResultCount').textContent =
        `${notes.length}개의 메모`;
    }

    noteGrid.classList.toggle(
      'list-mode',
      !gridMode && !memoAlbumMode
    );
    noteGrid.classList.toggle(
      'memo-album-grid',
      memoAlbumMode
    );

    noteGrid.innerHTML = '';

    emptyState.hidden =
      notes.length !== 0;

    if (memoAlbumMode) {
      renderMemoAlbum(notes);
      return;
    }

    $('#memoAlbumPagination').hidden = true;

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
        <span class="note-card-template">${escapeHtml(templateCardLabel(note))}</span>
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
            escapeHtml(noteCardPreview(note))
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
        () => openNoteView(note.id)
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

  function openEditor(noteId, returnToView = false, updateHistory = true) {
    const note =
      state.notes.find(
        item => item.id === noteId
      );

    if (!note) return;

    if (updateHistory && typeof pushArchiveRoute === 'function') {
      pushArchiveRoute(`/note/${encodeURIComponent(noteId)}/edit`);
    }
    currentNoteId = noteId;
    currentNoteViewId = null;
    editorReturnsToView = returnToView;

    noteTitle.value = note.title || '';
    note.template = note.template || 'memo';

    updateEditorMeta(note);
    populateFolderSelect(note.folderId);

    starBtn.classList.toggle(
      'active',
      Boolean(note.starred)
    );

    folderGridView.hidden = true;
    noteDetailView.hidden = true;
    homeView.hidden = true;
    chatView.hidden = true;
    calendarView.hidden = true;
    todoView.hidden = true;

    editorView.hidden = false;
    editorView.style.display = 'flex';

    setEditorTemplate(note.template, false);

    if (note.template === 'memo') {
      noteTitle.focus();
    }
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
    const closingNoteId = currentNoteId;
    const shouldReturnToView = editorReturnsToView && rerender;

    if (currentNoteId) {
      persistCurrentNote();
    }

    currentNoteId = null;
    editorReturnsToView = false;

    editorView.hidden = true;
    editorView.style.display = 'none';

    if (shouldReturnToView && closingNoteId) {
      openNoteView(closingNoteId);
      return;
    }

    if (
      currentView !== 'home'
      && currentView !== 'chat'
      && currentView !== 'calendar'
      && currentView !== 'todo'
    ) {
      folderGridView.hidden = false;
    }

    if (currentView === 'todo') {
      todoView.hidden = false;
      renderTodos();
    }

    if (currentView === 'home') {
      homeView.hidden = false;
      renderHomeDashboard();
    }

    if (
      rerender
      && currentView !== 'home'
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

    const previousMemoHtml =
      note.memoData?.html || '';
    const previousContent =
      note.content || '';

    if ((note.template || 'memo') === 'memo') {
      persistMemoEditor(note);
    }

    const changed =
      note.title !== noteTitle.value
      || previousMemoHtml !== (note.memoData?.html || '')
      || previousContent !== (note.content || '');

    note.title = noteTitle.value;

    if (changed) {
      note.updatedAt = Date.now();
      updateEditorMeta(note);
    }

    saveData();
  }

  function createNote(template = 'memo') {
    if (
      currentView === 'home'
      || currentView === 'chat'
      || currentView === 'calendar'
      || currentView === 'todo'
    ) {
      setView('all');
    }

    const excludedViews = [
      'all',
      'home',
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
      template,
      memoData: template === 'memo'
        ? {
            html: '',
            skin: 'pink-grid',
            columns: 1
          }
        : undefined,
      moodboard: template === 'moodboard'
        ? { items: [], drawing: '' }
        : undefined,
      linkData: template === 'links'
        ? { url: '', siteName: '', description: '', memo: '', category: '' }
        : undefined,
      collectionData: template === 'collection'
        ? { type: '책', cover: '', oneLine: '', tags: [], content: '', fields: [] }
        : undefined,
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
    currentNoteViewId = null;
    editorReturnsToView = false;
    editorView.hidden = true;
    editorView.style.display = 'none';
    folderGridView.hidden = false;

    render();
  }
