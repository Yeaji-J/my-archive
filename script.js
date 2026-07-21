(() => {
  'use strict';

  const STORAGE_KEY = 'archive.data.v1';
  const TODO_KEY = 'archive.todos.v1';

  const SUPABASE_URL =
    'https://qkujxjidngqwvibkqbre.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_v7DldiFXJPfbb0J95PKW_Q_Pmf0YR-a';

  const cloud = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const FOLDER_COLORS = [
    '#c9dff2',
    '#cfe7dc',
    '#f3dfbd',
    '#f4e7b9',
    '#e6d3ef',
    '#cce6ee',
    '#efd2d0',
    '#d9d5ef'
  ];

  /* ---------------- Data layer ---------------- */

  function loadData() {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY);

      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      console.warn(
        'Could not read storage',
        error
      );
    }

    return seedData();
  }

  function seedData() {
    const now = Date.now();
    const firstFolderId = uid();
    const secondFolderId = uid();

    return {
      folders: [
        {
          id: firstFolderId,
          name: '레퍼런스',
          color: '#c9dff2'
        },
        {
          id: secondFolderId,
          name: '아이디어',
          color: '#f3dfbd'
        }
      ],

      notes: [
        {
          id: uid(),
          title: '환영합니다 👋',
          folderId: firstFolderId,
          starred: true,
          content:
            'Archive는 자료와 정보를 폴더로 정리하는 개인용 공간이에요.\n\n'
            + '왼쪽에서 새 폴더를 만들고, 오른쪽 위 "+ 새 자료" 버튼으로 기록을 남겨보세요.',
          createdAt: now,
          updatedAt: now
        },
        {
          id: uid(),
          title: '아이디어 메모',
          folderId: secondFolderId,
          starred: false,
          content:
            '떠오르는 생각을 가볍게 적어두는 공간.',
          createdAt: now,
          updatedAt: now
        }
      ]
    };
  }

  function saveData() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

    scheduleCloudSave();
  }

  function loadTodos() {
    try {
      const raw =
        localStorage.getItem(TODO_KEY);

      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      console.warn(
        'Could not read todos',
        error
      );
    }

    return [];
  }

  function saveTodos() {
    localStorage.setItem(
      TODO_KEY,
      JSON.stringify(todos)
    );
  }

  let currentUser = null;
  let cloudSaveTimer = null;
  let pullingCloudData = false;
  let folderDeleteInProgress = false;

  function setSyncStatus(
    message,
    type = ''
  ) {
    const element =
      document.querySelector('#syncStatus');

    if (!element) return;

    element.textContent = message;

    element.className =
      'sync-status'
      + (type ? ` ${type}` : '');
  }

  function scheduleCloudSave() {
    if (
      !currentUser
      || pullingCloudData
    ) {
      return;
    }

    clearTimeout(cloudSaveTimer);

    setSyncStatus(
      '저장 중…',
      'syncing'
    );

    cloudSaveTimer =
      setTimeout(
        pushCloudData,
        450
      );
  }

  async function pushCloudData() {
    if (!currentUser) return;

    const { error } = await cloud
      .from('archive_data')
      .upsert(
        {
          user_id: currentUser.id,
          data: state,
          updated_at:
            new Date().toISOString()
        },
        {
          onConflict: 'user_id'
        }
      );

    if (error) {
      console.error(
        'Cloud save failed',
        error
      );

      setSyncStatus(
        '동기화 실패',
        'error'
      );

      return;
    }

    setSyncStatus(
      '모든 기기에 저장됨'
    );
  }

  async function pullCloudData() {
    if (!currentUser) return;

    setSyncStatus(
      '동기화 중…',
      'syncing'
    );

    const { data, error } = await cloud
      .from('archive_data')
      .select('data')
      .eq(
        'user_id',
        currentUser.id
      )
      .maybeSingle();

    if (error) {
      console.error(
        'Cloud load failed',
        error
      );

      setSyncStatus(
        'DB 설정 필요',
        'error'
      );

      return;
    }

    if (data?.data) {
      pullingCloudData = true;
      state = data.data;

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

      pullingCloudData = false;

      closeEditor(false);
      render();

      setSyncStatus(
        '모든 기기와 동기화됨'
      );
    } else {
      await pushCloudData();
    }
  }

  function uid() {
    return (
      Math.random()
        .toString(36)
        .slice(2, 10)
      + Date.now()
        .toString(36)
    );
  }

  let state = loadData();
  let todos = loadTodos();

  /* ---------------- App state ---------------- */

  let currentView = 'all';
  let currentNoteId = null;
  let searchTerm = '';
  let gridMode = true;
  let pendingFolderColor =
    FOLDER_COLORS[0];

  let chatRooms = [];
  let activeRoomId = null;
  let currentProfile = null;
  let messageSubscription = null;

  const renderedMessageIds =
    new Set();

  let calendarCursor = new Date();
  calendarCursor.setDate(1);

  let calendarEntries = new Map();
  let selectedCalendarDate = null;
  let selectedCalendarFile = null;
  let selectedCalendarEntry = null;

  /* ---------------- DOM refs ---------------- */

  const $ =
    selector =>
      document.querySelector(selector);

  const sidebar = $('#sidebar');
  const folderList = $('#folderList');
  const folderGrid = $('#folderGrid');
  const noteGrid = $('#noteGrid');
  const emptyState = $('#emptyState');

  const notesDividerWrap =
    $('#notesDividerWrap');

  const breadcrumb = $('#breadcrumb');
  const searchInput = $('#searchInput');
  const countAll = $('#countAll');
  const countStarred = $('#countStarred');

  const folderGridView =
    $('#folderGridView');

  const chatView = $('#chatView');
  const editorView = $('#editorView');

  const noteTitle = $('#noteTitle');
  const noteContent = $('#noteContent');
  const noteMeta = $('#noteMeta');

  const folderSelect =
    $('#folderSelect');

  const starBtn = $('#starBtn');
  const scrim = $('#scrim');

  const folderModal =
    $('#folderModal');

  const folderNameInput =
    $('#folderNameInput');

  const colorSwatches =
    $('#colorSwatches');

  const viewToggleBtn =
    $('#viewToggleBtn');

  const authBtn = $('#authBtn');
  const accountAvatar =
    $('#accountAvatar');

  const accountName =
    $('#accountName');

  const authModal = $('#authModal');
  const authForm = $('#authForm');
  const authEmail = $('#authEmail');
  const authPassword =
    $('#authPassword');

  const authMessage =
    $('#authMessage');

  const authSubmitBtn =
    $('#authSubmitBtn');

  const authSwitchBtn =
    $('#authSwitchBtn');

  const countChats = $('#countChats');

  const chatRoomList =
    $('#chatRoomList');

  const chatLoginState =
    $('#chatLoginState');

  const chatProfileLabel =
    $('#chatProfileLabel');

  const chatConversation =
    $('#chatConversation');

  const chatEmptyConversation =
    $('#chatEmptyConversation');

  const chatActive = $('#chatActive');
  const chatMessages =
    $('#chatMessages');

  const chatInput = $('#chatInput');

  const newChatModal =
    $('#newChatModal');

  const profileModal =
    $('#profileModal');

  const userSearchInput =
    $('#userSearchInput');

  const userSearchResults =
    $('#userSearchResults');

  const calendarView =
    $('#calendarView');

  const calendarGrid =
    $('#calendarGrid');

  const calendarMonthTitle =
    $('#calendarMonthTitle');

  const todoView = $('#todoView');
  const todoList = $('#todoList');
  const todoInput = $('#todoInput');
  const todoAddForm = $('#todoAddForm');
  const todoEmpty = $('#todoEmpty');

  const calendarEntryModal =
    $('#calendarEntryModal');

  const calendarEntryDate =
    $('#calendarEntryDate');

  const calendarEntryNote =
    $('#calendarEntryNote');

  const calendarPhotoInput =
    $('#calendarPhotoInput');

  const calendarPhotoEmpty =
    $('#calendarPhotoEmpty');

  const calendarPhotoPreview =
    $('#calendarPhotoPreview');

  const calendarEntryMessage =
    $('#calendarEntryMessage');

  let authMode = 'signin';

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

  /* ---------------- To-do list ---------------- */

  function renderTodos() {
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
        <button
          class="todo-checkbox"
          aria-label="완료 체크"
          title="완료 체크"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M5 13l4 4L19 7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <span class="todo-text"></span>

        <button
          class="todo-del"
          aria-label="삭제"
          title="삭제"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke-linecap="round"
              stroke-width="2.2"
            />
          </svg>
        </button>
      `;

      item.querySelector(
        '.todo-text'
      ).textContent = todo.text;

      item
        .querySelector('.todo-checkbox')
        .addEventListener(
          'click',
          () => {
            todo.done = !todo.done;
            saveTodos();
            renderTodos();
          }
        );

      item
        .querySelector('.todo-del')
        .addEventListener(
          'click',
          () => {
            todos =
              todos.filter(
                current =>
                  current.id !== todo.id
              );

            saveTodos();
            renderTodos();
          }
        );

      todoList.appendChild(item);
    });
  }

  todoAddForm.addEventListener(
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

  /* ---------------- Folders ---------------- */

  async function deleteFolder(
    folderId
  ) {
    const folder =
      state.folders.find(
        item => item.id === folderId
      );

    if (!folder) return;

    const count =
      state.notes.filter(
        note =>
          note.folderId === folderId
      ).length;

    const message =
      count > 0
        ? `"${folder.name}" 폴더를 삭제할까요? 안의 자료 ${count}개는 "폴더 없음"으로 이동합니다.`
        : `"${folder.name}" 폴더를 삭제할까요?`;

    folderDeleteInProgress = true;

    const shouldDelete =
      confirm(message);

    if (!shouldDelete) {
      folderDeleteInProgress = false;
      return;
    }

    state.folders =
      state.folders.filter(
        item => item.id !== folderId
      );

    state.notes.forEach(note => {
      if (note.folderId === folderId) {
        note.folderId = '';
      }
    });

    if (currentView === folderId) {
      currentView = 'all';
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

    render();

    clearTimeout(cloudSaveTimer);

    if (currentUser) {
      setSyncStatus(
        '저장 중…',
        'syncing'
      );

      await pushCloudData();
    }

    folderDeleteInProgress = false;
  }

  function openFolderModal() {
    folderNameInput.value = '';

    pendingFolderColor =
      FOLDER_COLORS[0];

    colorSwatches.innerHTML =
      FOLDER_COLORS
        .map(
          (color, index) => `
            <div
              class="color-swatch ${
                index === 0
                  ? 'selected'
                  : ''
              }"
              data-color="${color}"
              style="background:${color}"
            ></div>
          `
        )
        .join('');

    colorSwatches
      .querySelectorAll('.color-swatch')
      .forEach(swatch => {
        swatch.addEventListener(
          'click',
          () => {
            colorSwatches
              .querySelectorAll(
                '.color-swatch'
              )
              .forEach(element => {
                element.classList.remove(
                  'selected'
                );
              });

            swatch.classList.add(
              'selected'
            );

            pendingFolderColor =
              swatch.dataset.color;
          }
        );
      });

    folderModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () => folderNameInput.focus(),
      50
    );
  }

  function closeFolderModal() {
    folderModal.hidden = true;
    scrim.classList.remove('visible');
  }

  /* ---------------- Account ---------------- */

  function openProfileModal() {
    if (!currentUser) return;

    $('#profileModalTitle').textContent =
      currentProfile
        ? '프로필 수정'
        : '채팅 프로필 만들기';

    $('#profileModalDesc').textContent =
      currentProfile
        ? '친구에게 표시되는 프로필을 수정할 수 있어요.'
        : '친구가 알아볼 수 있는 이름을 정해주세요.';

    $('#profileNameInput').value =
      currentProfile?.display_name
      || currentUser.email
        ?.split('@')[0]
      || '';

    const baseUsername = (
      currentUser.email?.split('@')[0]
      || 'user'
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 14)
      || 'user';

    $('#profileUsernameInput').value =
      currentProfile?.username
      || (
        `${baseUsername}_${
          currentUser.id.slice(0, 4)
        }`
      ).slice(0, 20);

    $('#profileMessage').textContent = '';

    profileModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () =>
        $('#profileNameInput').focus(),
      50
    );
  }

  function closeProfileModal() {
    /*
     * 최초 프로필 생성 전에는
     * 설정창을 닫지 못하게 합니다.
     */
    if (!currentProfile) return;

    profileModal.hidden = true;
    scrim.classList.remove('visible');
  }

  function openAuthModal() {
    if (currentUser) {
      openProfileModal();
      return;
    }

    authMessage.textContent = '';

    authModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () => authEmail.focus(),
      50
    );
  }

  function closeAuthModal() {
    authModal.hidden = true;
    scrim.classList.remove('visible');
  }

  function updateAuthMode() {
    const signup =
      authMode === 'signup';

    $('#authTitle').textContent =
      signup
        ? 'Archive 계정 만들기'
        : 'Archive에 로그인';

    $('#authDesc').textContent =
      signup
        ? '한 번 가입하면 모든 기기에서 자료가 연결돼요.'
        : '어떤 브라우저에서도 같은 자료를 확인하세요.';

    authSubmitBtn.textContent =
      signup
        ? '계정 만들기'
        : '로그인';

    authSwitchBtn.textContent =
      signup
        ? '이미 계정이 있나요? 로그인'
        : '처음이신가요? 계정 만들기';

    authPassword.autocomplete =
      signup
        ? 'new-password'
        : 'current-password';

    authMessage.textContent = '';
  }

  async function submitAuth(event) {
    event.preventDefault();

    authSubmitBtn.disabled = true;

    authMessage.classList.remove(
      'success'
    );

    authMessage.textContent = '';

    const credentials = {
      email: authEmail.value.trim(),
      password: authPassword.value
    };

    const result =
      authMode === 'signup'
        ? await cloud.auth.signUp({
            ...credentials,
            options: {
              emailRedirectTo:
                location.href.split('#')[0]
            }
          })
        : await cloud.auth
            .signInWithPassword(
              credentials
            );

    authSubmitBtn.disabled = false;

    if (result.error) {
      authMessage.textContent =
        result.error.message;

      return;
    }

    if (
      authMode === 'signup'
      && !result.data.session
    ) {
      authMessage.classList.add(
        'success'
      );

      authMessage.textContent =
        '인증 메일을 보냈어요. 메일의 링크를 눌러 가입을 완료해주세요.';

      return;
    }

    closeAuthModal();
  }

  async function applySession(session) {
    const nextUser =
      session?.user || null;

    const changed =
      nextUser?.id
      !== currentUser?.id;

    currentUser = nextUser;

    authBtn.title =
      currentUser
        ? '프로필 수정'
        : '로그인';

    if (
      currentUser
      && changed
    ) {
      await pullCloudData();
      await ensureChatProfile();
      await loadChatRooms();
      await loadCalendarEntries();
    }

    if (!currentUser) {
      setSyncStatus(
        '이 브라우저에 저장됨'
      );

      currentProfile = null;
      chatRooms = [];
      activeRoomId = null;

      closeMessageSubscription();

      chatActive.hidden = true;

      chatEmptyConversation.hidden =
        false;

      chatConversation
        .parentElement
        .classList.remove(
          'mobile-conversation'
        );

      renderChatRooms();

      calendarEntries.clear();
      renderCalendar();
    }

    renderAccountButton();
  }

  async function initCloud() {
    const { data } =
      await cloud.auth.getSession();

    await applySession(data.session);

    cloud.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(
          () => applySession(session),
          0
        );
      }
    );
  }

  function createFolder() {
    const name =
      folderNameInput.value.trim();

    if (!name) {
      folderNameInput.focus();
      return;
    }

    const folder = {
      id: uid(),
      name,
      color: pendingFolderColor
    };

    state.folders.push(folder);

    saveData();
    closeFolderModal();
    render();
    setView(folder.id);
  }

  /* ---------------- 1:1 Chat ---------------- */

  function initials(name) {
    return String(name || '?')
      .trim()
      .slice(0, 1)
      .toUpperCase();
  }

  function avatarGradient(id) {
    const palettes = [
      ['#bfd9ef', '#89acd2'],
      ['#f3d7b9', '#e6ad82'],
      ['#dfcfeb', '#b89bcc'],
      ['#c8e5d5', '#92bea7'],
      ['#efd0d5', '#d998a3'],
      ['#cce2ee', '#97b9d3']
    ];

    const hash =
      [...String(id)].reduce(
        (total, character) =>
          total
          + character.charCodeAt(0),
        0
      );

    const [firstColor, secondColor] =
      palettes[
        hash % palettes.length
      ];

    return `
      linear-gradient(
        145deg,
        ${firstColor},
        ${secondColor}
      )
    `;
  }

  function renderAccountButton() {
    const label =
      currentProfile?.display_name
      || currentUser?.email
        ?.split('@')[0]
      || '로그인';

    accountName.textContent = label;

    accountAvatar.textContent =
      currentUser
        ? initials(label)
        : '';

    if (currentUser) {
      accountAvatar.style.background =
        avatarGradient(currentUser.id);
    }

    authBtn.classList.toggle(
      'logged-in',
      Boolean(currentUser)
    );
  }

  function avatarHtml(profile) {
    return `
      <span
        class="chat-avatar"
        style="background:${
          avatarGradient(profile.id)
        }"
      >
        ${
          escapeHtml(
            initials(profile.display_name)
          )
        }
      </span>
    `;
  }

  async function ensureChatProfile() {
    if (!currentUser) return;

    const { data, error } =
      await cloud
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (error) {
      console.error(
        'Profile load failed',
        error
      );

      return;
    }

    currentProfile = data || null;

    renderAccountButton();

    if (!currentProfile) {
      openProfileModal();
    }

    renderChatRooms();
  }

  async function saveChatProfile(event) {
    event.preventDefault();

    const displayName =
      $('#profileNameInput')
        .value
        .trim();

    const username =
      $('#profileUsernameInput')
        .value
        .trim()
        .toLowerCase();

    const message =
      $('#profileMessage');

    message.textContent = '';

    if (
      !/^[a-z0-9_]{3,20}$/
        .test(username)
    ) {
      message.textContent =
        '사용자 이름은 영문 소문자, 숫자, 밑줄로 3~20자 입력해주세요.';

      return;
    }

    const { data, error } =
      await cloud
        .from('profiles')
        .upsert({
          id: currentUser.id,
          username,
          display_name: displayName
        })
        .select()
        .single();

    if (error) {
      message.textContent =
        error.code === '23505'
          ? '이미 사용 중인 사용자 이름이에요.'
          : error.message;

      return;
    }

    currentProfile = data;

    renderAccountButton();

    profileModal.hidden = true;
    scrim.classList.remove('visible');

    renderChatRooms();
    await loadChatRooms();
  }

  async function loadChatRooms() {
    if (!currentUser) return;

    const {
      data: memberships,
      error
    } = await cloud
      .from('chat_members')
      .select('room_id')
      .eq(
        'user_id',
        currentUser.id
      );

    if (error) {
      console.error(
        'Chat list failed',
        error
      );

      return;
    }

    const rooms =
      await Promise.all(
        (memberships || [])
          .map(async membership => {
            const roomId =
              membership.room_id;

            const [
              { data: members },
              { data: latest }
            ] = await Promise.all([
              cloud
                .from('chat_members')
                .select('user_id')
                .eq('room_id', roomId)
                .neq(
                  'user_id',
                  currentUser.id
                ),

              cloud
                .from('messages')
                .select(
                  'body,created_at'
                )
                .eq('room_id', roomId)
                .order(
                  'created_at',
                  {
                    ascending: false
                  }
                )
                .limit(1)
            ]);

            const otherUserId =
              members?.[0]?.user_id;

            if (!otherUserId) {
              return null;
            }

            const { data: profile } =
              await cloud
                .from('profiles')
                .select('*')
                .eq(
                  'id',
                  otherUserId
                )
                .maybeSingle();

            if (!profile) {
              return null;
            }

            return {
              id: roomId,
              profile,
              latest:
                latest?.[0] || null
            };
          })
      );

    chatRooms =
      rooms
        .filter(Boolean)
        .sort(
          (first, second) =>
            new Date(
              second.latest?.created_at
              || 0
            )
            - new Date(
              first.latest?.created_at
              || 0
            )
        );

    renderChatRooms();
  }

  function renderChatRooms() {
    countChats.textContent =
      chatRooms.length;

    const loggedIn =
      Boolean(currentUser);

    chatLoginState.hidden =
      loggedIn;

    chatRoomList.style.display =
      loggedIn
        ? 'block'
        : 'none';

    $('#newChatBtn').disabled =
      !loggedIn;

    chatProfileLabel.textContent =
      currentProfile
        ? `${
            currentProfile.display_name
          } · @${
            currentProfile.username
          }`
        : (
          loggedIn
            ? '프로필을 설정해주세요'
            : '로그인 후 이용할 수 있어요'
        );

    chatRoomList.innerHTML = '';

    if (
      loggedIn
      && !chatRooms.length
    ) {
      chatRoomList.innerHTML = `
        <p class="search-guide">
          아직 채팅방이 없어요.<br>
          새 채팅을 시작해보세요.
        </p>
      `;

      return;
    }

    chatRooms.forEach(room => {
      const button =
        document.createElement('button');

      button.className =
        'chat-room-item'
        + (
          room.id === activeRoomId
            ? ' active'
            : ''
        );

      button.innerHTML = `
        ${avatarHtml(room.profile)}

        <span class="chat-room-copy">
          <span class="chat-room-top">
            <strong>
              ${
                escapeHtml(
                  room.profile.display_name
                )
              }
            </strong>

            <span class="chat-room-time">
              ${
                room.latest
                  ? chatListTime(
                      room.latest.created_at
                    )
                  : ''
              }
            </span>
          </span>

          <span class="chat-room-preview">
            ${
              escapeHtml(
                room.latest?.body
                || '새로운 대화를 시작해보세요.'
              )
            }
          </span>
        </span>
      `;

      button.addEventListener(
        'click',
        () => openChatRoom(room.id)
      );

      chatRoomList.appendChild(button);
    });
  }

  function chatListTime(value) {
    const date = new Date(value);
    const now = new Date();

    if (
      date.toDateString()
      === now.toDateString()
    ) {
      return date.toLocaleTimeString(
        'ko-KR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
    }

    return date.toLocaleDateString(
      'ko-KR',
      {
        month: 'numeric',
        day: 'numeric'
      }
    );
  }

  function messageTime(value) {
    return new Date(value)
      .toLocaleTimeString(
        'ko-KR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }

  async function openChatRoom(roomId) {
    const room =
      chatRooms.find(
        item => item.id === roomId
      );

    if (!room) return;

    activeRoomId = roomId;

    renderedMessageIds.clear();
    renderChatRooms();

    chatEmptyConversation.hidden = true;
    chatActive.hidden = false;

    $('#chatHeaderName').textContent =
      room.profile.display_name;

    $('#chatHeaderUsername').textContent =
      `@${room.profile.username}`;

    $('#chatHeaderAvatar').textContent =
      initials(
        room.profile.display_name
      );

    $('#chatHeaderAvatar')
      .style.background =
        avatarGradient(room.profile.id);

    chatConversation
      .parentElement
      .classList.add(
        'mobile-conversation'
      );

    chatMessages.innerHTML = `
      <p class="search-guide">
        대화를 불러오는 중…
      </p>
    `;

    const { data, error } =
      await cloud
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order(
          'created_at',
          {
            ascending: true
          }
        )
        .limit(500);

    if (error) {
      console.error(
        'Message load failed',
        error
      );

      chatMessages.innerHTML = `
        <p class="search-guide">
          메시지를 불러오지 못했어요.
        </p>
      `;

      return;
    }

    chatMessages.innerHTML = '';

    (data || []).forEach(
      appendMessage
    );

    scrollChatToBottom();
    subscribeToMessages(roomId);
  }

  function appendMessage(message) {
    const messageId =
      String(message.id);

    if (
      renderedMessageIds.has(messageId)
    ) {
      return;
    }

    renderedMessageIds.add(messageId);

    const row =
      document.createElement('div');

    row.className =
      'message-row'
      + (
        message.user_id
          === currentUser?.id
          ? ' mine'
          : ''
      );

    row.innerHTML = `
      <div class="message-bubble">
        ${escapeHtml(message.body)}
      </div>

      <time class="message-time">
        ${messageTime(message.created_at)}
      </time>
    `;

    chatMessages.appendChild(row);
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop =
        chatMessages.scrollHeight;
    });
  }

  function closeMessageSubscription() {
    if (!messageSubscription) return;

    cloud.removeChannel(
      messageSubscription
    );

    messageSubscription = null;
  }

  function subscribeToMessages(roomId) {
    closeMessageSubscription();

    messageSubscription =
      cloud
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter:
              `room_id=eq.${roomId}`
          },
          payload => {
            if (
              activeRoomId !== roomId
            ) {
              return;
            }

            appendMessage(payload.new);
            scrollChatToBottom();
            loadChatRooms();
          }
        )
        .subscribe();
  }

  async function sendChatMessage(event) {
    event.preventDefault();

    const body =
      chatInput.value.trim();

    if (
      !body
      || !activeRoomId
      || !currentUser
    ) {
      return;
    }

    chatInput.value = '';
    chatInput.style.height = 'auto';

    const { data, error } =
      await cloud
        .from('messages')
        .insert({
          room_id: activeRoomId,
          user_id: currentUser.id,
          body
        })
        .select()
        .single();

    if (error) {
      console.error(
        'Message send failed',
        error
      );

      alert(
        '메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.'
      );

      chatInput.value = body;
      return;
    }

    appendMessage(data);
    scrollChatToBottom();
    loadChatRooms();
  }

  function openNewChat() {
    if (!currentUser) {
      openAuthModal();
      return;
    }

    if (!currentProfile) {
      ensureChatProfile();
      return;
    }

    userSearchInput.value = '';

    userSearchResults.innerHTML = `
      <p class="search-guide">
        두 글자 이상 입력해주세요.
      </p>
    `;

    newChatModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () => userSearchInput.focus(),
      50
    );
  }

  function closeNewChat() {
    newChatModal.hidden = true;
    scrim.classList.remove('visible');
  }

  let searchUserTimer = null;

  function searchChatUsers() {
    clearTimeout(searchUserTimer);

    searchUserTimer =
      setTimeout(
        async () => {
          const term =
            userSearchInput
              .value
              .trim()
              .replace(
                /[%_,()]/g,
                ''
              );

          if (term.length < 2) {
            userSearchResults.innerHTML = `
              <p class="search-guide">
                두 글자 이상 입력해주세요.
              </p>
            `;

            return;
          }

          userSearchResults.innerHTML = `
            <p class="search-guide">
              검색 중…
            </p>
          `;

          const { data, error } =
            await cloud
              .from('profiles')
              .select('*')
              .neq(
                'id',
                currentUser.id
              )
              .or(
                `username.ilike.%${term}%,display_name.ilike.%${term}%`
              )
              .limit(20);

          if (
            error
            || !data?.length
          ) {
            userSearchResults.innerHTML = `
              <p class="search-guide">
                검색 결과가 없어요.
              </p>
            `;

            return;
          }

          userSearchResults.innerHTML = '';

          data.forEach(profile => {
            const button =
              document.createElement(
                'button'
              );

            button.className =
              'user-result';

            button.innerHTML = `
              ${avatarHtml(profile)}

              <span>
                <strong>
                  ${
                    escapeHtml(
                      profile.display_name
                    )
                  }
                </strong>

                <span>
                  @${
                    escapeHtml(
                      profile.username
                    )
                  }
                </span>
              </span>
            `;

            button.addEventListener(
              'click',
              () =>
                createDirectChat(
                  profile.id
                )
            );

            userSearchResults
              .appendChild(button);
          });
        },
        300
      );
  }

  async function createDirectChat(
    otherUserId
  ) {
    const { data, error } =
      await cloud.rpc(
        'create_direct_chat',
        {
          other_user: otherUserId
        }
      );

    if (error) {
      console.error(
        'Chat creation failed',
        error
      );

      alert(
        '채팅방을 만들지 못했어요.'
      );

      return;
    }

    closeNewChat();

    await loadChatRooms();
    await openChatRoom(data);
  }
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

  function previewCalendarPhoto() {
    const file =
      calendarPhotoInput
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

  /* ---------------- Sidebar mobile ---------------- */

  function closeSidebarMobile() {
    sidebar.classList.remove(
      'mobile-open'
    );
  }

  /* ---------------- Event wiring ---------------- */

  document
    .querySelectorAll('.nav-item')
    .forEach(button => {
      button.addEventListener(
        'click',
        () =>
          setView(
            button.dataset.view
          )
      );
    });

  $('#collapseBtn')
    .addEventListener(
      'click',
      () => {
        sidebar.classList.add(
          'collapsed'
        );
      }
    );

  $('#sidebarOpenBtn')
    .addEventListener(
      'click',
      () => {
        sidebar.classList.remove(
          'collapsed'
        );
      }
    );

  $('#sidebarToggleMobile')
    .addEventListener(
      'click',
      () => {
        sidebar.classList.toggle(
          'mobile-open'
        );
      }
    );

  searchInput.addEventListener(
    'input',
    event => {
      searchTerm =
        event.target.value;

      renderFolderGridView();
    }
  );

  $('#addFolderBtn')
    .addEventListener(
      'click',
      openFolderModal
    );

  $('#folderCancelBtn')
    .addEventListener(
      'click',
      closeFolderModal
    );

  $('#folderCreateBtn')
    .addEventListener(
      'click',
      createFolder
    );

  folderNameInput.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Enter') {
        createFolder();
      }
    }
  );

  scrim.addEventListener(
    'click',
    () => {
      if (!authModal.hidden) {
        closeAuthModal();
      }

      if (!folderModal.hidden) {
        closeFolderModal();
      }

      if (!newChatModal.hidden) {
        closeNewChat();
      }

      if (
        !calendarEntryModal.hidden
      ) {
        closeCalendarEntry();
      }

      if (
        !profileModal.hidden
        && currentProfile
      ) {
        closeProfileModal();
      }
    }
  );

  authBtn.addEventListener(
    'click',
    openAuthModal
  );

  $('#authCloseBtn')
    .addEventListener(
      'click',
      closeAuthModal
    );

  authForm.addEventListener(
    'submit',
    submitAuth
  );

  authSwitchBtn.addEventListener(
    'click',
    () => {
      authMode =
        authMode === 'signin'
          ? 'signup'
          : 'signin';

      updateAuthMode();
    }
  );

  $('#chatLoginBtn')
    .addEventListener(
      'click',
      openAuthModal
    );

  $('#newChatBtn')
    .addEventListener(
      'click',
      openNewChat
    );

  $('#newChatCloseBtn')
    .addEventListener(
      'click',
      closeNewChat
    );

  userSearchInput.addEventListener(
    'input',
    searchChatUsers
  );

  $('#profileForm')
    .addEventListener(
      'submit',
      saveChatProfile
    );

  $('#profileCloseBtn')
    .addEventListener(
      'click',
      closeProfileModal
    );

  $('#profileLogoutBtn')
    .addEventListener(
      'click',
      async () => {
        if (!currentUser) return;

        const shouldLogout =
          confirm(
            `${currentUser.email} 계정에서 로그아웃할까요?`
          );

        if (!shouldLogout) return;

        profileModal.hidden = true;

        scrim.classList.remove(
          'visible'
        );

        await cloud.auth.signOut();
      }
    );

  $('#chatForm')
    .addEventListener(
      'submit',
      sendChatMessage
    );

  $('#chatMobileBack')
    .addEventListener(
      'click',
      () => {
        chatConversation
          .parentElement
          .classList.remove(
            'mobile-conversation'
          );
      }
    );

  chatInput.addEventListener(
    'input',
    () => {
      chatInput.style.height =
        'auto';

      chatInput.style.height =
        `${Math.min(
          chatInput.scrollHeight,
          100
        )}px`;
    }
  );

  chatInput.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter'
        && !event.shiftKey
      ) {
        event.preventDefault();

        $('#chatForm')
          .requestSubmit();
      }
    }
  );

  $('#newNoteBtnSide')
    .addEventListener(
      'click',
      createNote
    );

  $('#newNoteBtnTop')
    .addEventListener(
      'click',
      createNote
    );

  $('#emptyAddBtn')
    .addEventListener(
      'click',
      createNote
    );

  $('#backBtn')
    .addEventListener(
      'click',
      () => closeEditor()
    );

  $('#deleteBtn')
    .addEventListener(
      'click',
      () => {
        const shouldDelete =
          confirm(
            '이 자료를 삭제할까요?'
          );

        if (shouldDelete) {
          deleteCurrentNote();
        }
      }
    );

  $('#calendarPrevBtn')
    .addEventListener(
      'click',
      () =>
        moveCalendarMonth(-1)
    );

  $('#calendarNextBtn')
    .addEventListener(
      'click',
      () =>
        moveCalendarMonth(1)
    );

  $('#calendarTodayBtn')
    .addEventListener(
      'click',
      () => {
        calendarCursor =
          new Date();

        calendarCursor.setDate(1);

        calendarEntries.clear();
        renderCalendar();

        if (currentUser) {
          loadCalendarEntries();
        }
      }
    );

  $('#homeBtn')
    .addEventListener(
      'click',
      () => {
        setView('all');
      }
    );

  $('#calendarEntryCloseBtn')
    .addEventListener(
      'click',
      closeCalendarEntry
    );

  $('#calendarEntryForm')
    .addEventListener(
      'submit',
      saveCalendarEntry
    );

  $('#calendarEntryDeleteBtn')
    .addEventListener(
      'click',
      deleteCalendarEntry
    );

  calendarPhotoInput
    .addEventListener(
      'change',
      previewCalendarPhoto
    );

  starBtn.addEventListener(
    'click',
    () => {
      const note =
        state.notes.find(
          item =>
            item.id === currentNoteId
        );

      if (!note) return;

      note.starred = !note.starred;

      starBtn.classList.toggle(
        'active',
        note.starred
      );

      saveData();
    }
  );

  folderSelect.addEventListener(
    'change',
    () => {
      const note =
        state.notes.find(
          item =>
            item.id === currentNoteId
        );

      if (!note) return;

      note.folderId =
        folderSelect.value;

      note.updatedAt = Date.now();

      saveData();
    }
  );

  let autosaveTimer = null;

  [
    noteTitle,
    noteContent
  ].forEach(element => {
    element.addEventListener(
      'input',
      () => {
        clearTimeout(
          autosaveTimer
        );

        autosaveTimer =
          setTimeout(
            persistCurrentNote,
            400
          );
      }
    );
  });

  viewToggleBtn.addEventListener(
    'click',
    () => {
      gridMode = !gridMode;

      viewToggleBtn.classList.toggle(
        'active-grid',
        !gridMode
      );

      renderFolderGridView();
    }
  );

  document.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Escape') {
        if (!folderModal.hidden) {
          closeFolderModal();
        } else if (
          !authModal.hidden
        ) {
          closeAuthModal();
        } else if (
          !newChatModal.hidden
        ) {
          closeNewChat();
        } else if (
          !calendarEntryModal.hidden
        ) {
          closeCalendarEntry();
        } else if (
          !profileModal.hidden
          && currentProfile
        ) {
          closeProfileModal();
        } else if (
          !editorView.hidden
        ) {
          closeEditor();
        }
      }

      if (
        (
          event.metaKey
          || event.ctrlKey
        )
        && event.key
          .toLowerCase() === 'k'
      ) {
        event.preventDefault();
        searchInput.focus();
      }
    }
  );

  window.addEventListener(
    'beforeunload',
    () => {
      if (currentNoteId) {
        persistCurrentNote();
      }
    }
  );

  window.addEventListener(
    'focus',
    () => {
      if (
        currentUser
        && editorView.hidden
        && !folderDeleteInProgress
      ) {
        pullCloudData();
      }
    }
  );

  /* ---------------- Init ---------------- */

  render();
  initCloud();
})();