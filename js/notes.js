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
      if (
        typeof closeQuickChatSubscription
        === 'function'
      ) {
        closeQuickChatSubscription();
      }
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

      breadcrumb.textContent = '포스트잇';

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
      if (
        typeof closeQuickChatSubscription
        === 'function'
      ) {
        closeQuickChatSubscription();
      }
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

      breadcrumb.textContent = '포스트잇';

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
        notes = notes.filter(note => {
          if (
            browseTemplate === 'todo'
          ) {
            const tags =
              ensurePostitData(note).tags;

            return browseSecondaryFilter
              === '태그 없음'
                ? tags.length === 0
                : tags.includes(
                    browseSecondaryFilter
                  );
          }

          return getBrowseSecondaryValue(
            note
          ) === browseSecondaryFilter;
        });
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
    if ((note.template || 'memo') === 'todo') {
      return ensurePostitData(note).tags[0] || '태그 없음';
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
      && ['todo', 'links', 'collection'].includes(browseTemplate);

    archiveSecondaryFilters.hidden = !supportsSecondary;
    archiveSecondaryFilters.innerHTML = '';

    if (supportsSecondary) {
      const values = [
        ...new Set(
          state.notes
            .filter(
              note =>
                (note.template || 'memo')
                === browseTemplate
            )
            .flatMap(note => {
              if (
                browseTemplate
                === 'todo'
              ) {
                const tags =
                  ensurePostitData(note)
                    .tags;

                return tags.length
                  ? tags
                  : ['태그 없음'];
              }

              return [
                getBrowseSecondaryValue(
                  note
                )
              ];
            })
        )
      ];

      ['all', ...values].forEach(value => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.secondaryFilter = value;
        button.classList.toggle('active', value === browseSecondaryFilter);
        button.textContent = value === 'all' ? '전체' : value;
        button.addEventListener('click', () => {
          browseSecondaryFilter = value;
          memoAlbumPage = 1;
          postitAlbumPage = 1;
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
      const data =
        ensurePostitData(note);

      if (data.type === 'weekly') {
        return data.weekly
          .map(item => item.text)
          .filter(Boolean)
          .join(' · ')
          || '비어 있는 위클리 플랜';
      }

      if (data.type === 'habit') {
        return data.habits
          .map(item => item.text)
          .filter(Boolean)
          .join(' · ')
          || '비어 있는 해빗 트래커';
      }

      if (data.type === 'time') {
        return data.timeSlots
          .map(item => item.label)
          .filter(Boolean)
          .join(' · ')
          || '비어 있는 타임 트래커';
      }

      return data.items
        .map(item => item.text)
        .filter(Boolean)
        .join(' · ')
        || '비어 있는 포스트잇';
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
      todo: 'POST-IT',
      moodboard: 'MOODBOARD',
      links: 'LINK',
      collection: note.collectionData?.type?.toUpperCase?.() || 'COLLECTION'
    })[note.template || 'memo'];
  }

  function isTemplateArchiveView() {
    return (
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate !== 'all'
    );
  }

  function resetArchiveSelection() {
    archiveSelectionMode = false;
    selectedArchiveNoteIds.clear();
  }

  function setArchiveSelectionMode(enabled) {
    archiveSelectionMode = Boolean(enabled);
    selectedArchiveNoteIds.clear();
    renderFolderGridView();
  }

  function toggleArchiveNoteSelection(noteId) {
    if (selectedArchiveNoteIds.has(noteId)) {
      selectedArchiveNoteIds.delete(noteId);
    } else {
      selectedArchiveNoteIds.add(noteId);
    }

    renderFolderGridView();
  }

  function archiveSelectionButton(noteId) {
    const selected =
      selectedArchiveNoteIds.has(noteId);

    return `
      <button
        class="archive-card-check${selected ? ' selected' : ''}"
        type="button"
        data-note-select="${escapeHtml(noteId)}"
        aria-label="${selected ? '선택 해제' : '자료 선택'}"
        aria-pressed="${selected}"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      </button>
    `;
  }

  function renderArchiveBulkBar(notes) {
    const bar = $('#archiveBulkBar');
    const visible =
      isTemplateArchiveView();

    bar.hidden = !visible;

    if (!visible) {
      resetArchiveSelection();
      return;
    }

    const availableIds =
      new Set(notes.map(note => note.id));

    [...selectedArchiveNoteIds]
      .forEach(noteId => {
        if (!availableIds.has(noteId)) {
          selectedArchiveNoteIds.delete(noteId);
        }
      });

    const count =
      selectedArchiveNoteIds.size;
    const allSelected =
      notes.length > 0
      && count === notes.length;

    $('#archiveSelectModeBtn').textContent =
      archiveSelectionMode
        ? '선택 종료'
        : '선택';

    $('#archiveSelectAllBtn').hidden =
      !archiveSelectionMode;
    $('#archiveSelectAllBtn').textContent =
      allSelected
        ? '전체 선택 해제'
        : '전체 선택';

    $('#archiveClearSelectionBtn').hidden =
      !archiveSelectionMode
      || count === 0;

    $('#archiveSelectedCount').hidden =
      !archiveSelectionMode;
    $('#archiveSelectedCount').textContent =
      `${count}개 선택`;

    const deleteButton =
      $('#archiveBulkDeleteBtn');
    deleteButton.hidden =
      !archiveSelectionMode;
    deleteButton.disabled =
      count === 0;
  }

  async function deleteNotesByIds(noteIds) {
    const ids =
      new Set(noteIds.filter(Boolean));

    if (!ids.size) return false;

    noteDeleteInProgress = true;
    cloudMutationRevision += 1;
    clearTimeout(cloudSaveTimer);

    try {
      state.notes =
        state.notes.filter(
          note => !ids.has(note.id)
        );

      if (ids.has(currentNoteId)) {
        currentNoteId = null;
      }

      if (ids.has(currentNoteViewId)) {
        currentNoteViewId = null;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

      if (currentUser) {
        setSyncStatus(
          '삭제 내용 저장 중…',
          'syncing'
        );

        const saved =
          await pushCloudData();

        if (!saved) {
          alert(
            '이 브라우저에서는 삭제되었지만 클라우드 동기화에 실패했어요. 네트워크를 확인한 뒤 다시 시도해주세요.'
          );
        }
      }

      return true;
    } finally {
      noteDeleteInProgress = false;
    }
  }

  async function deleteSelectedArchiveNotes() {
    const ids =
      [...selectedArchiveNoteIds];

    if (
      !ids.length
      || !confirm(
        `선택한 자료 ${ids.length}개를 삭제할까요? 삭제한 자료는 복구할 수 없어요.`
      )
    ) {
      return;
    }

    await deleteNotesByIds(ids);
    resetArchiveSelection();
    render();
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
    const postitAlbumMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate === 'todo';
    const moodboardAlbumMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate === 'moodboard';
    const linkArchiveMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate === 'links';
    const collectionAlbumMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate === 'collection';
    const templateListMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate !== 'all';
    const specializedTemplateMode =
      moodboardAlbumMode
      || linkArchiveMode
      || collectionAlbumMode;

    $('#templateListBar').hidden =
      !templateListMode;

    if (templateListMode) {
      const query =
        templateListSearchTerm
          .trim()
          .toLowerCase();

      if (query) {
        notes = notes.filter(note =>
          templateSearchText(note)
            .includes(query)
        );
      }

      const listMeta = {
        memo: ['01 · MEMO ALBUM', '메모'],
        todo: ['02 · POST-IT ALBUM', '포스트잇'],
        moodboard: ['03 · MOODBOARD', '무드보드'],
        links: ['04 · LINK ARCHIVE', '링크'],
        collection: ['05 · COLLECTION', '컬렉션']
      }[browseTemplate];

      $('#templateListTitle').textContent =
        listMeta?.[0] || 'TEMPLATE ARCHIVE';
      $('#templateListResultCount')
        .textContent =
          `${notes.length}개의 ${
            listMeta?.[1] || '자료'
          }`;
    }

    renderArchiveBulkBar(notes);

    noteGrid.classList.toggle(
      'list-mode',
      !gridMode
      && !memoAlbumMode
      && !postitAlbumMode
      && !specializedTemplateMode
    );
    noteGrid.classList.toggle(
      'memo-album-grid',
      memoAlbumMode
    );
    noteGrid.classList.toggle(
      'postit-album-grid',
      postitAlbumMode
    );
    noteGrid.classList.toggle(
      'moodboard-album-grid',
      moodboardAlbumMode
    );
    noteGrid.classList.toggle(
      'link-archive-list',
      linkArchiveMode
    );
    noteGrid.classList.toggle(
      'collection-album-grid',
      collectionAlbumMode
    );

    noteGrid.innerHTML = '';

    emptyState.hidden =
      notes.length !== 0;

    if (memoAlbumMode) {
      $('#postitAlbumPagination')
        .hidden = true;
      $('#templateAlbumPagination')
        .hidden = true;
      renderMemoAlbum(notes);
      return;
    }

    $('#memoAlbumPagination').hidden = true;

    if (postitAlbumMode) {
      $('#templateAlbumPagination')
        .hidden = true;
      renderPostitAlbum(notes);
      return;
    }

    $('#postitAlbumPagination').hidden = true;

    if (moodboardAlbumMode) {
      renderMoodboardAlbum(notes);
      return;
    }

    if (linkArchiveMode) {
      renderLinkArchiveList(notes);
      return;
    }

    if (collectionAlbumMode) {
      renderCollectionAlbum(notes);
      return;
    }

    $('#templateAlbumPagination').hidden =
      true;

    notes.forEach(note => {
      const folder =
        state.folders.find(
          item =>
            item.id === note.folderId
        );

      const card =
        document.createElement('div');

      card.className =
        'note-card'
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

      card.style.setProperty(
        '--folder-color',
        folder?.color || '#dce8f3'
      );

      card.classList.toggle(
        'no-folder',
        !folder
      );

      card.innerHTML = `
        ${
          archiveSelectionMode
            ? archiveSelectionButton(note.id)
            : ''
        }
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
        event => {
          if (
            event.target.closest(
              '[data-note-select]'
            )
            || archiveSelectionMode
          ) {
            toggleArchiveNoteSelection(
              note.id
            );
            return;
          }

          openNoteView(note.id);
        }
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
      pushArchiveRoute(`/note/${encodeURIComponent(noteId)}`);
    }
    currentNoteId = noteId;
    currentNoteViewId = null;
    editorReturnsToView = returnToView;

    noteTitle.value = note.title || '';
    note.template =
      typeof note.template === 'string'
        ? note.template
        : Object.prototype
          .hasOwnProperty.call(
            note,
            'template'
          )
          ? ''
          : 'memo';

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

    if (!note.template) {
      noteTitle.focus();
    } else if (note.template === 'memo') {
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

  function createNote(template = '') {
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
      folderId,
      starred: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (template) {
      resetNoteForTemplate(
        note,
        template
      );
    }

    state.notes.unshift(note);

    saveData();
    render();
    openEditor(note.id);
  }

  async function deleteCurrentNote() {
    if (!currentNoteId) return;

    const deletedNoteId =
      currentNoteId;

    currentNoteId = null;
    currentNoteViewId = null;
    editorReturnsToView = false;
    editorView.hidden = true;
    editorView.style.display = 'none';
    folderGridView.hidden = false;

    await deleteNotesByIds([
      deletedNoteId
    ]);

    render();
  }
