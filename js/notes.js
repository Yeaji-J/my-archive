'use strict';

/* ---------------- Rendering ---------------- */

  function render() {
    if (
      currentView === 'chat'
      && !CHAT_FEATURE_VISIBLE
    ) {
      currentView = 'home';
    }
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

    const entries =
      orderedFolderEntries();

    function sidebarFolderIsVisible(folder) {
      const visited = new Set();
      let parentId = folderParentId(folder);

      while (parentId) {
        if (
          visited.has(parentId)
          || !expandedSidebarFolderIds
            .has(parentId)
        ) {
          return false;
        }
        visited.add(parentId);
        const parent = state.folders.find(
          item => item.id === parentId
        );
        parentId = parent
          ? folderParentId(parent)
          : '';
      }

      return true;
    }

    const activeFolder =
      state.folders.find(
        folder => folder.id === currentView
      );

    let activeParent = activeFolder;
    const activeAncestors = new Set();
    while (activeParent) {
      const parentId =
        folderParentId(activeParent);
      if (!parentId || activeAncestors.has(parentId)) {
        break;
      }
      activeAncestors.add(parentId);
      expandedSidebarFolderIds.add(parentId);
      activeParent = state.folders.find(
        folder => folder.id === parentId
      );
    }

    entries.forEach(({ folder, depth }) => {
      if (!sidebarFolderIsVisible(folder)) {
        return;
      }

      const hasChildren =
        state.folders.some(
          item =>
            folderParentId(item)
              === folder.id
        );
      const expanded =
        expandedSidebarFolderIds
          .has(folder.id);
      const count =
        folderNoteCount(folder.id);

      const item =
        document.createElement('li');

      item.className =
        'folder-item'
        + (count > 0 ? ' has-content' : '')
        + (
          currentView === folder.id
            ? ' active'
            : ''
        );

      item.style.setProperty(
        '--folder-depth',
        depth
      );

      item.innerHTML = `
        <button
          class="folder-toggle ${expanded ? 'expanded' : ''}"
          type="button"
          aria-label="${hasChildren ? (expanded ? '하위 폴더 접기' : '하위 폴더 펼치기') : ''}"
          ${hasChildren ? '' : 'disabled'}
        >
          ${hasChildren ? '›' : ''}
        </button>

        <span
          class="folder-dot"
          style="--folder-color:${folder.color}"
        ></span>

        <span class="folder-item-name">
          ${escapeHtml(folder.name)}
        </span>

        <span class="folder-item-count">
          ${count}
        </span>

        <button
          class="folder-add-child"
          aria-label="${escapeHtml(folder.name)}에 하위 폴더 추가"
          title="하위 폴더 추가"
          type="button"
        >+</button>

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
              '.folder-del, .folder-add-child, .folder-toggle'
            )
          ) {
            return;
          }

          if (hasChildren) {
            expandedSidebarFolderIds.add(
              folder.id
            );
          }
          setView(folder.id);
        }
      );

      item
        .querySelector('.folder-toggle')
        .addEventListener(
          'click',
          event => {
            event.stopPropagation();
            if (!hasChildren) return;
            if (expanded) {
              expandedSidebarFolderIds.delete(
                folder.id
              );
            } else {
              expandedSidebarFolderIds.add(
                folder.id
              );
            }
            renderSidebarFolders();
          }
        );

      item
        .querySelector('.folder-add-child')
        .addEventListener(
          'click',
          event => {
            event.stopPropagation();
            openFolderModal(folder.id);
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
          template === 'all'
            ? state.notes.length
            : state.notes.filter(
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
    if (
      view === 'chat'
      && !CHAT_FEATURE_VISIBLE
    ) {
      view = 'home';
    }
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
      ? folderPathLabel(folder.id)
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
            noteIsInFolderTree(
              note,
              currentView
            )
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

  function archivePaperTextLength(note) {
    return templateSearchText(note)
      .replace(/\s+/g, ' ')
      .trim()
      .length;
  }

  function templateOverviewSize(
    note
  ) {
    const template =
      note.template || 'memo';
    const textLength =
      archivePaperTextLength(note);
    const sizes = {
      memo: {
        width: 230,
        minHeight: 220,
        maxHeight: 340,
        charsPerStep: 120,
        stepHeight: 32
      },
      todo: {
        width: 205,
        minHeight: 270,
        maxHeight: 340,
        charsPerStep: 110,
        stepHeight: 28
      },
      moodboard: {
        width: 290,
        minHeight: 210,
        maxHeight: 250,
        charsPerStep: 150,
        stepHeight: 20
      },
      links: {
        width: 250,
        minHeight: 145,
        maxHeight: 200,
        charsPerStep: 100,
        stepHeight: 22
      },
      collection: {
        width: 150,
        minHeight: 225,
        maxHeight: 280,
        charsPerStep: 140,
        stepHeight: 20
      }
    };
    const size =
      sizes[template] || sizes.memo;
    const contentHeight =
      Math.ceil(
        textLength
        / Math.max(
          1,
          size.charsPerStep
        )
      )
      * size.stepHeight;

    return {
      width: size.width,
      height: Math.max(
        size.minHeight,
        Math.min(
          size.maxHeight,
          size.minHeight
          + contentHeight
        )
      )
    };
  }

  function applyTemplateOverviewPresentation(
    element,
    note
  ) {
    const size =
      templateOverviewSize(note);

    element.classList.add(
      'archive-paper-item'
    );
    element.style.setProperty(
      '--paper-width',
      `${size.width}px`
    );
    element.style.setProperty(
      '--paper-height',
      `${size.height}px`
    );
  }

  function updateTemplateOverviewHeight(
    board = noteGrid
  ) {
    const cards = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ];
    const bottom =
      cards.reduce(
        (maximum, card) =>
          Math.max(
            maximum,
            (
              parseFloat(
                card.style.top
              ) || 0
            )
            + (
              card.offsetHeight
              || parseFloat(
                card.style.getPropertyValue(
                  '--paper-height'
                )
              )
              || 0
            )
          ),
        0
      );

    board.style.height =
      `${Math.max(
        420,
        bottom + 54
      )}px`;
  }

  function bindTemplateOverviewDrag(
    card,
    note,
    board,
    nextZIndex
  ) {
    let drag = null;

    const pointFromEvent =
      event => {
        const touch =
          event.touches?.[0]
          || event.changedTouches?.[0];

        return {
          x:
            touch?.clientX
            ?? event.clientX,
          y:
            touch?.clientY
            ?? event.clientY
        };
      };

    const removeDragListeners =
      () => {
        document.removeEventListener(
          'mousemove',
          moveDrag
        );
        document.removeEventListener(
          'mouseup',
          finishDrag
        );
        document.removeEventListener(
          'touchmove',
          moveDrag
        );
        document.removeEventListener(
          'touchend',
          finishDrag
        );
        document.removeEventListener(
          'touchcancel',
          finishDrag
        );
      };

    const finishDrag =
      event => {
        if (!drag) return;

        const moved = drag.moved;
        drag = null;
        card.classList.remove(
          'dragging'
        );
        removeDragListeners();

        if (!moved) return;

        card.dataset.dragged = 'true';
        note.overviewLayout = {
          version: 3,
          x:
            parseFloat(
              card.style.left
            ) || 0,
          y:
            parseFloat(
              card.style.top
            ) || 0,
          z:
            Number(
              card.style.zIndex
            ) || 1,
          boardWidth:
            board.clientWidth
            || board.getBoundingClientRect()
              .width
            || 0
        };
        saveData();
        event.preventDefault();
      };

    const moveDrag =
      event => {
        if (!drag) return;

        const point =
          pointFromEvent(event);
        const deltaX =
          point.x - drag.startClientX;
        const deltaY =
          point.y - drag.startClientY;

        if (
          !drag.moved
          && Math.hypot(
            deltaX,
            deltaY
          ) < 3
        ) {
          return;
        }

        drag.moved = true;

        const boardWidth =
          board.clientWidth
          || board.getBoundingClientRect()
            .width;
        const cardWidth =
          card.getBoundingClientRect()
            .width
          || card.offsetWidth
          || templateOverviewSize(
            note
          ).width;
        const maximumX =
          Math.max(
            0,
            boardWidth - cardWidth
          );
        const nextX =
          Math.max(
            0,
            Math.min(
              maximumX,
              drag.startX + deltaX
            )
          );
        const nextY =
          Math.max(
            0,
            drag.startY + deltaY
          );

        card.style.left =
          `${nextX}px`;
        card.style.top =
          `${nextY}px`;
        updateTemplateOverviewHeight(
          board
        );
        event.preventDefault();
      };

    const startDrag =
      event => {
        if (
          event.type === 'mousedown'
          && event.button !== 0
        ) {
          return;
        }

        removeDragListeners();

        const point =
          pointFromEvent(event);
        drag = {
          startClientX: point.x,
          startClientY: point.y,
          startX:
            parseFloat(
              card.style.left
            ) || 0,
          startY:
            parseFloat(
              card.style.top
            ) || 0,
          moved: false
        };

        card.classList.add('dragging');
        card.style.zIndex =
          String(nextZIndex());

        if (
          event.type === 'touchstart'
        ) {
          document.addEventListener(
            'touchmove',
            moveDrag,
            { passive: false }
          );
          document.addEventListener(
            'touchend',
            finishDrag
          );
          document.addEventListener(
            'touchcancel',
            finishDrag
          );
        } else {
          document.addEventListener(
            'mousemove',
            moveDrag
          );
          document.addEventListener(
            'mouseup',
            finishDrag
          );
        }

        event.stopPropagation();
        event.preventDefault();
      };

    card.addEventListener(
      'dragstart',
      event => event.preventDefault()
    );
    card.addEventListener(
      'mousedown',
      startDrag
    );
    card.addEventListener(
      'touchstart',
      startDrag,
      { passive: false }
    );
  }

  function setupTemplateOverviewBoard(
    notes
  ) {
    const board = noteGrid;
    const cards = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ];

    if (
      !board.classList.contains(
        'template-overview-board'
      )
    ) {
      return;
    }

    const boardWidth =
      Math.max(
        280,
        board.clientWidth
        || board.getBoundingClientRect()
          .width
        || 960
      );
    const edge = 12;
    const columns =
      Math.max(
        1,
        Math.min(
          5,
          Math.floor(
            boardWidth / 220
          )
        )
      );
    const laneWidth =
      boardWidth / columns;
    const rowStep = 238;
    const seededValue =
      (value, salt) => {
        const source =
          `${value}:${salt}`;
        let hash = 2166136261;

        for (
          let index = 0;
          index < source.length;
          index += 1
        ) {
          hash ^=
            source.charCodeAt(index);
          hash =
            Math.imul(
              hash,
              16777619
            );
        }

        return (
          (hash >>> 0) % 10000
        ) / 10000;
      };

    cards.forEach(
      (card, index) => {
        const note = notes[index];
        const size =
          templateOverviewSize(note);
        const saved =
          note.overviewLayout
            ?.version === 5
            ? note.overviewLayout
            : null;
        const scale =
          saved?.boardWidth > 0
            ? boardWidth
              / saved.boardWidth
            : 1;
        const cardWidth =
          Math.min(
            saved?.width > 0
              ? saved.width * scale
              : size.width,
            boardWidth
          );
        let x;
        let y;
        let z;

        if (saved) {
          x = Math.max(
            0,
            Math.min(
              (Number(saved.x) || 0)
              * scale,
              Math.max(
                0,
                boardWidth - cardWidth
              )
            )
          );
          y = Math.max(
            0,
            Number(saved.y) || 0
          );
          z =
            Number(saved.z)
            || index + 1;
        } else {
          const column =
            index % columns;
          const row =
            Math.floor(
              index / columns
            );
          const jitterX =
            (
              seededValue(
                note.id,
                'x'
              ) - .5
            )
            * Math.min(
              76,
              laneWidth * .34
            );
          const jitterY =
            (
              seededValue(
                note.id,
                'y'
              ) - .5
            ) * 92;
          const baseX =
            column * laneWidth
            + (
              laneWidth
              - cardWidth
            ) / 2;

          x = Math.max(
            0,
            Math.min(
              boardWidth - cardWidth,
              baseX + jitterX
            )
          );
          y = Math.max(
            12,
            28
            + row * rowStep
            + jitterY
          );
          z =
            10
            + Math.floor(
              seededValue(
                note.id,
                'z'
              ) * 70
            );
        }

        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
        card.style.width =
          `${cardWidth}px`;
        card.title =
          '끌어서 원하는 위치에 놓기';
        card.style.zIndex =
          String(z);
      }
    );

    updateTemplateOverviewHeight(
      board
    );
  }

  function alignTemplateOverviewBoard() {
    const board = noteGrid;
    const cards = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ];

    if (
      !board.classList.contains(
        'template-overview-board'
      )
      || !cards.length
    ) {
      return;
    }

    const width =
      Math.max(
        280,
        board.clientWidth
        || board.getBoundingClientRect()
          .width
        || 960
      );
    const edge = 12;
    const columnGap = 18;
    const rowGap = 32;
    const columns =
      width >= 1080
        ? 5
        : Math.max(
            1,
            Math.min(
              4,
              Math.floor(
                width / 220
              )
            )
          );
    const slotWidth =
      (
        width
        - edge * 2
        - columnGap
          * (columns - 1)
      ) / columns;
    const rows = [];

    cards.forEach(
      (card, index) => {
        const note =
          state.notes.find(
            item =>
              item.id
              === card.dataset.noteId
          );

        if (!note) return;

        const row =
          Math.floor(
            index / columns
          );
        const size =
          templateOverviewSize(note);

        rows[row] =
          Math.max(
            rows[row] || 0,
            size.height
          );
      }
    );

    const rowTops = [];
    let nextTop = 20;

    rows.forEach(
      (height, index) => {
        rowTops[index] = nextTop;
        nextTop +=
          height + rowGap;
      }
    );

    cards.forEach(
      (card, index) => {
        const note =
          state.notes.find(
            item =>
              item.id
              === card.dataset.noteId
          );

        if (!note) return;

        const size =
          templateOverviewSize(note);
        const displayWidth =
          Math.min(
            size.width,
            Math.max(
              110,
              slotWidth - 4
            )
          );
        const column =
          index % columns;
        const row =
          Math.floor(
            index / columns
          );
        const x =
          edge
          + column
            * (
              slotWidth
              + columnGap
            )
          + (
            slotWidth
            - displayWidth
          ) / 2;
        const y =
          rowTops[row] || 20;

        note.overviewLayout = {
          version: 5,
          mode: 'aligned',
          x,
          y,
          z: index + 1,
          width: displayWidth,
          boardWidth: width
        };
      }
    );

    saveData();
    renderFolderGridView();
  }

  function archivePaperHoverMeta(
    note,
    label =
      templateCardLabel(note)
  ) {
    return `
      <span class="archive-paper-meta">
        <small>${escapeHtml(label)}</small>
        <strong>
          ${escapeHtml(note.title || '제목 없음')}
        </strong>
        <time>${formatDate(note.updatedAt)}</time>
      </span>
    `;
  }

  function folderPreviewMarkup(note) {
    const template =
      note.template || 'memo';

    if (template === 'collection') {
      const data =
        note.collectionData || {};

      return data.cover
        ? `
          <img
            class="folder-preview-cover"
            src="${escapeHtml(data.cover)}"
            alt=""
          >
        `
        : `
          <span class="folder-preview-empty">
            ${escapeHtml(data.type || 'COLLECTION')}
          </span>
        `;
    }

    if (template === 'moodboard') {
      const data =
        note.moodboard || {
          items: [],
          skin: 'plain',
          drawing: ''
        };

      return `
        <span class="folder-preview-board moodboard-skin-${escapeHtml(data.skin || 'plain')}">
          ${
            data.drawing
              ? `
                <img
                  class="folder-preview-drawing"
                  src="${escapeHtml(data.drawing)}"
                  alt=""
                >
              `
              : ''
          }
          ${
            (data.items || [])
              .slice(0, 8)
              .map(moodboardPreviewItem)
              .join('')
          }
          ${
            !data.drawing
            && !(data.items || []).length
              ? '<span class="folder-preview-empty">MOODBOARD</span>'
              : ''
          }
        </span>
      `;
    }

    if (template === 'memo') {
      const memo =
        ensureMemoData(note);

      return `
        <span class="folder-preview-memo memo-skin-${escapeHtml(memo.skin)}">
          <span class="folder-preview-memo-copy">
            ${
              sanitizeMemoHtml(memo.html)
              || '<span class="folder-preview-empty">아직 작성된 내용이 없어요.</span>'
            }
          </span>
        </span>
      `;
    }

    if (template === 'todo') {
      const data =
        ensurePostitData(note);

      return `
        <span class="folder-preview-postit postit-skin-${escapeHtml(data.skin)}">
          <b>${escapeHtml(data.heading || 'POST-IT')}</b>
          <span>
            ${escapeHtml(noteCardPreview(note))}
          </span>
        </span>
      `;
    }

    const data =
      note.linkData || {};
    let domain = '';

    try {
      domain =
        new URL(data.url).hostname
          .replace(/^www\./, '');
    } catch (_error) {
      domain = data.url || '';
    }

    return `
      <span class="folder-preview-link">
        <span>↗</span>
        <b>${escapeHtml(domain || 'SAVED LINK')}</b>
        <small>${escapeHtml(data.description || '바로가기를 저장한 링크예요.')}</small>
      </span>
    `;
  }

  const FOLDER_SNAPSHOT_WIDTH = 720;

  function fitFolderTemplateSnapshot(
    viewport
  ) {
    if (!viewport?.isConnected) return;
    const width = viewport.clientWidth;
    if (!width) return;
    viewport.style.setProperty(
      '--folder-snapshot-scale',
      width / FOLDER_SNAPSHOT_WIDTH
    );
  }

  function renderFolderTemplateSnapshot(
    viewport,
    note
  ) {
    if (!viewport || !note) return;
    const template = note.template || 'memo';
    const page = document.createElement('span');
    page.className =
      `folder-snapshot-page folder-snapshot-${template}`;
    page.style.setProperty(
      '--archive-note-font',
      typeof archiveFontStack === 'function'
        ? archiveFontStack(noteFontKey(note))
        : '"Pretendard", sans-serif'
    );

    if (template === 'memo') {
      const memo = ensureMemoData(note);
      page.classList.add(
        `memo-skin-${memo.skin}`
      );
      page.innerHTML = `
        <strong class="folder-snapshot-title">
          ${escapeHtml(note.title || '제목 없음')}
        </strong>
        <span class="folder-snapshot-memo-body">
          ${sanitizeMemoHtml(memo.html) || '<p>아직 작성된 내용이 없어요.</p>'}
        </span>
      `;
    } else if (template === 'todo') {
      const data = ensurePostitData(note);
      page.className +=
        ` ${postitPaperClass(data)}`;
      page.style.setProperty(
        '--postit-font-size',
        `${data.fontSize}px`
      );
      page.style.setProperty(
        '--postit-accent',
        data.accentColor
      );
      const heading =
        document.createElement('strong');
      heading.className =
        'folder-snapshot-postit-heading';
      heading.textContent =
        data.heading || 'POST-IT';
      const content =
        document.createElement('span');
      content.className =
        'postit-paper-content folder-snapshot-postit-body';
      renderPostitBody(content, note, true);
      page.append(heading, content);
    } else if (template === 'moodboard') {
      const data = ensureMoodboard(note);
      page.classList.add(
        `moodboard-skin-${data.skin}`
      );
      if (data.drawing) {
        const drawing = document.createElement('img');
        drawing.className =
          'folder-snapshot-moodboard-drawing';
        drawing.src = data.drawing;
        drawing.alt = '';
        page.appendChild(drawing);
      }
      data.items.forEach(item => {
        const element = document.createElement('span');
        element.className =
          `folder-snapshot-moodboard-item ${item.type}`;
        element.style.left =
          `${(Number(item.x) || 0) * .72}px`;
        element.style.top =
          `${(Number(item.y) || 0) * .68}px`;
        element.style.width =
          `${(Number(item.width) || (item.type === 'image' ? 240 : 220)) * .72}px`;
        element.style.height = item.height
          ? `${Number(item.height) * .68}px`
          : 'auto';
        element.style.transform =
          `rotate(${Number(item.rotation) || 0}deg)`;
        if (item.type === 'image') {
          const image = document.createElement('img');
          image.src = item.src || '';
          image.alt = '';
          element.appendChild(image);
        } else {
          element.textContent = item.text || '';
          element.style.fontSize =
            `${Number(item.fontSize) || 21}px`;
          element.style.fontWeight =
            String(item.fontWeight || 400);
          if (
            typeof archiveFontStack
              === 'function'
          ) {
            element.style.fontFamily =
              archiveFontStack(
                item.fontKey || note.fontKey
              );
          }
        }
        page.appendChild(element);
      });
    } else if (template === 'links') {
      const data = ensureLinkData(note);
      page.innerHTML = `
        <span class="folder-snapshot-link-kicker">SAVED LINK</span>
        <strong class="folder-snapshot-link-title">${escapeHtml(data.siteName || note.title || '제목 없음')}</strong>
        <span class="folder-snapshot-link-url">${escapeHtml(data.url || '주소 없음')}</span>
        <p>${escapeHtml(data.description || '아직 메모가 없어요.')}</p>
        <small>${escapeHtml(data.category || '미분류')}</small>
      `;
    } else {
      const data = ensureCollectionData(note);
      page.innerHTML = `
        <span class="folder-snapshot-collection-cover">
          ${
            data.cover
              ? `<img src="${escapeHtml(data.cover)}" alt="">`
              : `<span>${escapeHtml(data.type || 'COLLECTION')}</span>`
          }
        </span>
        <span class="folder-snapshot-collection-copy">
          <small>${escapeHtml(data.type || '기타')}</small>
          <strong>${escapeHtml(note.title || '제목 없음')}</strong>
          <p>${escapeHtml(data.oneLine || data.content || '아직 기록이 없어요.')}</p>
          <span>${(data.tags || []).map(tag => `#${escapeHtml(tag)}`).join(' ')}</span>
        </span>
      `;
    }

    viewport.replaceChildren(page);
    requestAnimationFrame(() => {
      fitFolderTemplateSnapshot(
        viewport
      );
    });
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
      const deletedAt = Date.now();
      state.deletedNotes =
        normalizeDeletionMap(
          state.deletedNotes
        );
      ids.forEach(id => {
        state.deletedNotes[id] = Math.max(
          Number(state.deletedNotes[id]) || 0,
          deletedAt
        );
      });

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

      saveData();
      clearTimeout(cloudSaveTimer);
      await persistDurableState(
        true,
        lastLocalSavedAt
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
        folderNoteCount(
          selectedFolder.id
        );

      const contextIcon =
        $('#folderContextIcon');

      contextIcon.style.setProperty(
          '--folder-color',
          selectedFolder.color
        );

      contextIcon.classList.toggle(
        'is-open',
        selectedCount > 0
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
        : 'none';

    notesDividerWrap.querySelector('span').textContent =
      '모든 자료';

    folderGrid.innerHTML = '';

    if (showFolders) {
      state.folders
        .filter(
          folder => !folderParentId(folder)
        )
        .forEach(folder => {
        const count =
          folderNoteCount(folder.id);

        const card =
          document.createElement('div');

        card.className =
          'folder-card'
          + (count > 0 ? ' has-content' : '');

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

          <div class="folder-icon folder-visual">
            <i class="folder-back"></i>
            <i class="folder-paper"></i>
            <i class="folder-front"></i>
          </div>

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
    const folderListMode =
      browseMode === 'folder';
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
    const templateOverviewMode =
      currentView === 'all'
      && browseMode === 'template'
      && browseTemplate === 'all';
    const specializedTemplateMode =
      moodboardAlbumMode
      || linkArchiveMode
      || collectionAlbumMode;

    $('#templateListBar').hidden =
      !templateListMode;

    $('#folderListToolbar').hidden =
      !folderListMode;

    $('#templateOverviewTools').hidden =
      !templateOverviewMode;

    if (folderListMode) {
      $('#folderListResultCount')
        .textContent =
          `${notes.length}개의 자료`;

      document
        .querySelectorAll(
          '[data-folder-view]'
        )
        .forEach(button => {
          button.classList.toggle(
            'active',
            button.dataset.folderView
              === folderNoteViewMode
          );
        });
    }

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
    noteGrid.classList.toggle(
      'template-overview-board',
      templateOverviewMode
    );
    if (!templateOverviewMode) {
      noteGrid.style.removeProperty(
        'height'
      );
    }
    noteGrid.classList.toggle(
      'folder-preview-grid',
      folderListMode
      && folderNoteViewMode === 'preview'
    );
    noteGrid.classList.toggle(
      'folder-text-list',
      folderListMode
      && folderNoteViewMode === 'text'
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

    notes.forEach((note, index) => {
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
      card.style.setProperty(
        '--archive-note-font',
        typeof archiveFontStack
          === 'function'
          ? archiveFontStack(noteFontKey(note))
          : '"Pretendard", sans-serif'
      );

      card.classList.toggle(
        'no-folder',
        !folder
      );

      if (templateOverviewMode) {
        const template =
          note.template || 'memo';

        card.classList.add(
          'template-overview-paper',
          `template-overview-${template}`
        );
        card.dataset.noteId =
          note.id;
        applyTemplateOverviewPresentation(
          card,
          note
        );
        card.innerHTML = `
          <div class="template-overview-surface">
            ${folderPreviewMarkup(note)}
          </div>
          ${
            note.starred
              ? `
                <span
                  class="template-overview-star"
                  aria-label="즐겨찾기"
                >★</span>
              `
              : ''
          }
          ${
            archivePaperHoverMeta(
              note,
              templateCardLabel(note)
            )
          }
        `;
      } else if (
        folderListMode
        && folderNoteViewMode === 'preview'
      ) {
        card.classList.add(
          'folder-preview-card'
        );

        card.innerHTML = `
          <div class="folder-preview-media">
            <span
              class="folder-preview-snapshot"
              data-folder-snapshot
            ></span>
            ${
              note.starred
                ? `
                  <span class="folder-preview-star">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.6l1.4-6.6-5-4.6 6.6-.7z"/>
                    </svg>
                  </span>
                `
                : ''
            }
          </div>
          <div class="folder-preview-copy">
            <span>${escapeHtml(templateCardLabel(note))}</span>
            <strong>${escapeHtml(note.title || '제목 없음')}</strong>
            <small>
              ${escapeHtml(folder?.name || '폴더 없음')}
              · ${formatDate(note.updatedAt)}
            </small>
          </div>
        `;
      } else if (
        folderListMode
        && folderNoteViewMode === 'text'
      ) {
        card.classList.add(
          'folder-text-row'
        );

        card.innerHTML = `
          <span class="folder-text-template">
            ${escapeHtml(templateCardLabel(note))}
          </span>
          <strong class="folder-text-title">
            ${escapeHtml(note.title || '제목 없음')}
          </strong>
          <span class="folder-text-summary">
            ${escapeHtml(noteCardPreview(note) || '내용 없음')}
          </span>
          <span class="folder-text-folder">
            <i style="--folder-color:${escapeHtml(folder?.color || '#C3C2D9')}"></i>
            ${escapeHtml(folder?.name || '폴더 없음')}
          </span>
          <time>${formatDate(note.updatedAt)}</time>
          ${
            note.starred
              ? '<span class="folder-text-star">★</span>'
              : '<span class="folder-text-star"></span>'
          }
        `;
      } else {
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
      }

      const snapshotViewport =
        card.querySelector(
          '[data-folder-snapshot]'
        );
      if (snapshotViewport) {
        renderFolderTemplateSnapshot(
          snapshotViewport,
          note
        );
      }

      card.addEventListener(
        'click',
        event => {
          if (
            card.dataset.dragged
            === 'true'
          ) {
            card.dataset.dragged =
              'false';
            event.preventDefault();
            return;
          }

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

    if (templateOverviewMode) {
      if (
        typeof window
          .initializeTemplateOverviewBoard
        === 'function'
      ) {
        window
          .initializeTemplateOverviewBoard(
            notes
          );
      } else {
        requestAnimationFrame(
          () =>
            setupTemplateOverviewBoard(
              notes
            )
        );
      }
    }
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

    if (
      typeof applyEditorFont
      === 'function'
    ) {
      applyEditorFont(note);
    }

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
    let selectedFolder =
      state.folders.find(
        folder => folder.id === selectedId
      );
    const visited = new Set();

    while (selectedFolder) {
      const parentId =
        folderParentId(selectedFolder);
      if (!parentId || visited.has(parentId)) {
        break;
      }
      visited.add(parentId);
      selectedFolder = state.folders.find(
        folder => folder.id === parentId
      ) || selectedFolder;
    }

    const rootId = selectedFolder?.id || '';
    folderSelect.innerHTML =
      '<option value="">폴더 없음</option>'
      + state.folders
        .filter(folder => !folderParentId(folder))
        .map(folder => `
          <option
            value="${folder.id}"
            ${
              folder.id === rootId
                ? 'selected'
                : ''
            }
          >
            ${escapeHtml(folder.name)}
          </option>
        `)
        .join('');

    populateSubfolderSelect(
      rootId,
      selectedId
    );
  }

  function populateSubfolderSelect(
    rootId,
    selectedId = rootId
  ) {
    const descendantIds = rootId
      ? folderDescendantIds(rootId)
      : new Set();
    const descendants =
      orderedFolderEntries().filter(
        ({ folder }) =>
          folder.id !== rootId
          && descendantIds.has(folder.id)
      );

    subfolderSelect.hidden =
      !rootId || !descendants.length;
    subfolderSelect.disabled =
      subfolderSelect.hidden;

    if (subfolderSelect.hidden) {
      subfolderSelect.innerHTML = '';
      return;
    }

    const rootFolder = state.folders.find(
      folder => folder.id === rootId
    );
    subfolderSelect.innerHTML = `
      <option value="${rootId}">
        ${escapeHtml(rootFolder?.name || '상위 폴더')}에 바로 저장
      </option>
      ${
        descendants
          .map(({ folder, depth }) => `
            <option value="${folder.id}">
              ${'　'.repeat(Math.max(0, depth - 1))}${escapeHtml(folder.name)}
            </option>
          `)
          .join('')
      }
    `;
    subfolderSelect.value =
      descendantIds.has(selectedId)
        ? selectedId
        : rootId;
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

  let folderSnapshotResizeFrame = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(
      folderSnapshotResizeFrame
    );
    folderSnapshotResizeFrame =
      requestAnimationFrame(() => {
        document
          .querySelectorAll(
            '[data-folder-snapshot]'
          )
          .forEach(
            fitFolderTemplateSnapshot
          );
      });
  });
