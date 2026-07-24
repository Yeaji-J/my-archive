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

  /* ---------------- Image input helpers ---------------- */

  function clipboardImageFiles(clipboardData) {
    return [
      ...(clipboardData?.items || [])
    ]
      .filter(
        item =>
          item.kind === 'file'
          && item.type.startsWith('image/')
      )
      .map(item => item.getAsFile())
      .filter(Boolean);
  }

  function imageMimeFromUrl(url) {
    const extension = String(url)
      .split(/[?#]/)[0]
      .split('.')
      .pop()
      .toLowerCase();

    return {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif'
    }[extension] || '';
  }

  function draggedImageUrls(dataTransfer) {
    const urls = [];
    const html =
      dataTransfer?.getData('text/html')
      || '';

    if (html) {
      const documentFragment =
        new DOMParser()
          .parseFromString(
            html,
            'text/html'
          );

      documentFragment
        .querySelectorAll('img[src]')
        .forEach(image => {
          urls.push(
            image.getAttribute('src')
          );
        });
    }

    const uriList =
      dataTransfer
        ?.getData('text/uri-list')
        ?.split(/\r?\n/)
        .filter(
          value =>
            value
            && !value.startsWith('#')
        )
      || [];

    urls.push(...uriList);

    const plain =
      dataTransfer
        ?.getData('text/plain')
        ?.trim();

    if (
      plain
      && /^(https?:|data:image\/|blob:)/i
        .test(plain)
    ) {
      urls.push(plain);
    }

    return [
      ...new Set(
        urls
          .filter(Boolean)
          .map(url => {
            try {
              return new URL(
                url,
                location.href
              ).href;
            } catch (_error) {
              return '';
            }
          })
          .filter(Boolean)
      )
    ];
  }

  async function imageFileFromUrl(
    url,
    index = 0
  ) {
    const response = await fetch(
      url,
      {
        mode: 'cors',
        credentials: 'omit'
      }
    );

    if (!response.ok) {
      throw new Error(
        `Image request failed: ${response.status}`
      );
    }

    const blob = await response.blob();
    const type =
      blob.type.startsWith('image/')
        ? blob.type
        : imageMimeFromUrl(url);

    if (!type) {
      throw new Error(
        'Dropped URL is not an image.'
      );
    }

    const extension =
      type.split('/')[1]
        .replace('jpeg', 'jpg')
        .replace(/[^a-z0-9]/gi, '')
      || 'jpg';

    return new File(
      [blob],
      `dragged-image-${Date.now()}-${index}.${extension}`,
      { type }
    );
  }

  async function droppedImageFiles(
    dataTransfer
  ) {
    const localFiles = [
      ...(dataTransfer?.files || [])
    ].filter(
      file =>
        file.type.startsWith('image/')
    );

    if (localFiles.length) {
      return localFiles;
    }

    const urls =
      draggedImageUrls(dataTransfer);

    const results =
      await Promise.allSettled(
        urls.map(imageFileFromUrl)
      );

    return results
      .filter(
        result =>
          result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  function bindImageDropTarget(
    target,
    onImages,
    options = {}
  ) {
    const activeClass =
      options.activeClass
      || 'image-drag-over';

    target.addEventListener(
      'dragover',
      event => {
        event.preventDefault();
        event.dataTransfer.dropEffect =
          'copy';
        target.classList.add(
          activeClass
        );
      }
    );

    target.addEventListener(
      'dragleave',
      event => {
        if (
          !target.contains(
            event.relatedTarget
          )
        ) {
          target.classList.remove(
            activeClass
          );
        }
      }
    );

    target.addEventListener(
      'drop',
      async event => {
        event.preventDefault();
        target.classList.remove(
          activeClass
        );

        const files =
          await droppedImageFiles(
            event.dataTransfer
          );

        if (!files.length) {
          options.onError?.(
            '이 사이트의 사진은 직접 가져올 수 없어요. 이미지를 복사해 Ctrl+V로 붙여넣거나 파일로 저장한 뒤 다시 시도해주세요.'
          );
          return;
        }

        await onImages(files, event);
      }
    );
  }

  /* ---------------- Data layer ---------------- */

  const LOCAL_SAVED_AT_KEY =
    'archive.data.savedAt.v1';
  const ARCHIVE_DB_NAME =
    'archive-durable-storage';
  const ARCHIVE_DB_VERSION = 1;
  const ARCHIVE_STORE_NAME =
    'snapshots';
  const ARCHIVE_STATE_RECORD =
    'main';

  let localDataWasLoaded = false;
  let lastLocalSavedAt = 0;
  let durableSaveTimer = null;
  let durableSavePromise =
    Promise.resolve();

  function loadData() {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY);

      if (raw) {
        localDataWasLoaded = true;
        lastLocalSavedAt =
          Number(
            localStorage.getItem(
              LOCAL_SAVED_AT_KEY
            )
          ) || 0;
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

  function stateLatestTimestamp(
    targetState
  ) {
    return Math.max(
      0,
      ...(
        targetState?.notes || []
      ).map(
        note =>
          Number(note.updatedAt) || 0
      )
    );
  }

  function cloneArchiveState(
    targetState = state
  ) {
    if (
      typeof structuredClone
      === 'function'
    ) {
      return structuredClone(targetState);
    }

    return JSON.parse(
      JSON.stringify(targetState)
    );
  }

  function openArchiveDatabase() {
    return new Promise(
      (resolve, reject) => {
        if (!window.indexedDB) {
          reject(
            new Error(
              'IndexedDB is unavailable'
            )
          );
          return;
        }

        const request =
          indexedDB.open(
            ARCHIVE_DB_NAME,
            ARCHIVE_DB_VERSION
          );

        request.onupgradeneeded =
          () => {
            const database =
              request.result;

            if (
              !database.objectStoreNames
                .contains(
                  ARCHIVE_STORE_NAME
                )
            ) {
              database.createObjectStore(
                ARCHIVE_STORE_NAME
              );
            }
          };

        request.onsuccess =
          () => resolve(
            request.result
          );
        request.onerror =
          () => reject(
            request.error
          );
      }
    );
  }

  async function readDurableState() {
    const database =
      await openArchiveDatabase();

    try {
      return await new Promise(
        (resolve, reject) => {
          const transaction =
            database.transaction(
              ARCHIVE_STORE_NAME,
              'readonly'
            );
          const request =
            transaction
              .objectStore(
                ARCHIVE_STORE_NAME
              )
              .get(
                ARCHIVE_STATE_RECORD
              );

          request.onsuccess =
            () => resolve(
              request.result || null
            );
          request.onerror =
            () => reject(
              request.error
            );
        }
      );
    } finally {
      database.close();
    }
  }

  async function writeDurableState(
    snapshot,
    savedAt
  ) {
    const database =
      await openArchiveDatabase();

    try {
      await new Promise(
        (resolve, reject) => {
          const transaction =
            database.transaction(
              ARCHIVE_STORE_NAME,
              'readwrite'
            );

          transaction
            .objectStore(
              ARCHIVE_STORE_NAME
            )
            .put(
              {
                state: snapshot,
                savedAt
              },
              ARCHIVE_STATE_RECORD
            );

          transaction.oncomplete =
            () => resolve();
          transaction.onerror =
            () => reject(
              transaction.error
            );
          transaction.onabort =
            () => reject(
              transaction.error
            );
        }
      );
    } finally {
      database.close();
    }
  }

  function persistDurableState(
    immediate = false,
    savedAt = lastLocalSavedAt
  ) {
    clearTimeout(durableSaveTimer);

    const persist = () => {
      const snapshot =
        cloneArchiveState();
      const snapshotSavedAt =
        savedAt || Date.now();

      durableSavePromise =
        durableSavePromise
          .catch(() => {})
          .then(
            async () => {
              await writeDurableState(
                snapshot,
                snapshotSavedAt
              );

              if (!currentUser) {
                setSyncStatus(
                  '이 브라우저에 저장됨'
                );
              }
            }
          )
          .catch(error => {
            console.error(
              'Durable archive save failed',
              error
            );
          });

      return durableSavePromise;
    };

    if (immediate) {
      return persist();
    }

    durableSaveTimer =
      setTimeout(persist, 120);

    return durableSavePromise;
  }

  async function restoreDurableState() {
    try {
      const record =
        await readDurableState();

      if (!record?.state) {
        if (localDataWasLoaded) {
          persistDurableState(
            true,
            lastLocalSavedAt
              || stateLatestTimestamp(
                state
              )
              || Date.now()
          );
        }
        return;
      }

      const localTimestamp =
        lastLocalSavedAt
        || stateLatestTimestamp(state);
      const durableTimestamp =
        Number(record.savedAt) || 0;

      if (
        !localDataWasLoaded
        || durableTimestamp
          > localTimestamp
      ) {
        state = record.state;
        localDataWasLoaded = true;
        lastLocalSavedAt =
          durableTimestamp;

        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
          );
          localStorage.setItem(
            LOCAL_SAVED_AT_KEY,
            String(
              durableTimestamp
            )
          );
        } catch (error) {
          console.warn(
            'Local archive restore cache failed',
            error
          );
        }
      } else if (
        localTimestamp
        > durableTimestamp
      ) {
        persistDurableState(
          true,
          localTimestamp
        );
      }
    } catch (error) {
      console.warn(
        'Could not restore durable archive',
        error
      );
    }
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
    cloudMutationRevision += 1;
    const savedAt = Date.now();
    lastLocalSavedAt = savedAt;
    let localStorageSaved = false;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
      localStorage.setItem(
        LOCAL_SAVED_AT_KEY,
        String(savedAt)
      );
      localStorageSaved = true;
      localDataWasLoaded = true;
    } catch (error) {
      console.warn(
        'Local archive save failed',
        error
      );

      /*
       * 이미지가 많이 포함되면 브라우저 저장 한도를
       * 넘을 수 있습니다. 이 경우에도 아래의 클라우드
       * 저장은 반드시 계속 진행합니다.
       */
      if (!currentUser) {
        setSyncStatus(
          '브라우저 저장공간 부족',
          'error'
        );
      }
    }

    persistDurableState(
      false,
      savedAt
    );

    if (
      localStorageSaved
      && !currentUser
    ) {
      setSyncStatus(
        '이 브라우저에 저장됨'
      );
    }

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
  let cloudSaveInFlight = null;
  let cloudSaveQueued = false;
  let pullingCloudData = false;
  let folderDeleteInProgress = false;
  let cloudMutationRevision = 0;

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

  function scheduleCloudSave(
    delay = 450
  ) {
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
        delay
      );
  }

  async function pushCloudData() {
    if (!currentUser) return true;

    if (cloudSaveInFlight) {
      cloudSaveQueued = true;
      return cloudSaveInFlight;
    }

    const savingRevision =
      cloudMutationRevision;
    const snapshot =
      cloneArchiveState();

    cloudSaveInFlight =
      (async () => {
        const { error } = await cloud
          .from('archive_data')
          .upsert(
            {
              user_id: currentUser.id,
              data: snapshot,
              updated_at:
                new Date()
                  .toISOString()
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

          return false;
        }

        if (
          savingRevision
          === cloudMutationRevision
        ) {
          setSyncStatus(
            '모든 기기에 저장됨'
          );
        }

        return true;
      })();

    let result = false;

    try {
      result =
        await cloudSaveInFlight;
    } catch (error) {
      console.error(
        'Cloud save request failed',
        error
      );
      setSyncStatus(
        '동기화 실패',
        'error'
      );
    } finally {
      cloudSaveInFlight = null;
    }

    if (
      cloudSaveQueued
      || savingRevision
        !== cloudMutationRevision
    ) {
      cloudSaveQueued = false;
      scheduleCloudSave(0);
    }

    return result;
  }

  async function pullCloudData() {
    if (!currentUser) return;

    if (currentNoteId) {
      persistCurrentNote();
    }

    const requestedAtRevision =
      cloudMutationRevision;

    setSyncStatus(
      '동기화 중…',
      'syncing'
    );

    const { data, error } = await cloud
      .from('archive_data')
      .select('data,updated_at')
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

    if (
      requestedAtRevision
      !== cloudMutationRevision
    ) {
      return;
    }

    if (data?.data) {
      const cloudSavedAt =
        Date.parse(data.updated_at || '')
        || stateLatestTimestamp(
          data.data
        );
      const localSavedAt =
        lastLocalSavedAt
        || stateLatestTimestamp(state);

      if (
        localDataWasLoaded
        && localSavedAt
          > cloudSavedAt
      ) {
        await pushCloudData();
        return;
      }

      pullingCloudData = true;
      state = data.data;
      lastLocalSavedAt =
        cloudSavedAt || Date.now();
      localDataWasLoaded = true;

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(state)
        );
        localStorage.setItem(
          LOCAL_SAVED_AT_KEY,
          String(lastLocalSavedAt)
        );
      } catch (storageError) {
        console.warn(
          'Cloud data local cache failed',
          storageError
        );
      }

      await persistDurableState(
        true,
        lastLocalSavedAt
      );

      pullingCloudData = false;

      closeEditor(false);
      render();

      if (typeof syncArchiveRouteFromLocation === 'function') {
        syncArchiveRouteFromLocation();
      }

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

  let currentView = 'home';
  let currentNoteId = null;
  let currentNoteViewId = null;
  let editorReturnsToView = false;
  let searchTerm = '';
  let gridMode = true;
  let browseMode = 'folder';
  let folderNoteViewMode = (() => {
    try {
      const saved =
        localStorage.getItem(
          'archive.folder-note-view.v1'
        );

      return [
        'mixed',
        'preview',
        'text'
      ].includes(saved)
        ? saved
        : 'mixed';
    } catch (_error) {
      return 'mixed';
    }
  })();
  let browseTemplate = 'all';
  let browseSecondaryFilter = 'all';
  let memoAlbumPage = 1;
  let postitAlbumPage = 1;
  let templateListSearchTerm = '';
  let archiveSelectionMode = false;
  const selectedArchiveNoteIds = new Set();
  let noteDeleteInProgress = false;
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
  const archiveViewSwitch = $('#archiveViewSwitch');
  const archiveTemplateFilters = $('#archiveTemplateFilters');
  const archiveSecondaryFilters = $('#archiveSecondaryFilters');

  const notesDividerWrap =
    $('#notesDividerWrap');

  const breadcrumb = $('#breadcrumb');
  const searchInput = $('#searchInput');
  const countAll = $('#countAll');
  const countStarred = $('#countStarred');

  const folderGridView =
    $('#folderGridView');

  const homeView = $('#homeView');

  const chatView = $('#chatView');
  const editorView = $('#editorView');
  const noteDetailView = $('#noteDetailView');

  const noteTitle = $('#noteTitle');
  const noteContent = $('#noteContent');
  const noteMeta = $('#noteMeta');

  const memoEditorPanel = $('#memoEditorPanel');
  const todoEditorPanel = $('#todoEditorPanel');
  const moodboardEditorPanel = $('#moodboardEditorPanel');
  const linkEditorPanel = $('#linkEditorPanel');
  const collectionEditorPanel = $('#collectionEditorPanel');
  const editorTemplateMessage = $('#editorTemplateMessage');

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

  const homeShortcutBtn =
    $('#homeShortcutBtn');

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
