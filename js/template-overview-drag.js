'use strict';

/*
 * 템플릿별 → 전체 자유 배치
 *
 * - 좌표를 자료 데이터와 전용 localStorage 양쪽에 저장합니다.
 * - 보드 너비가 실제로 계산된 뒤에만 좌표를 적용합니다.
 * - 자동 정렬은 재렌더링 없이 현재 카드에 즉시 적용합니다.
 */
(() => {
  const LAYOUT_KEY =
    'archive.template-overview-layout.v2';
  const LAYOUT_VERSION = 6;
  const DESKTOP_COLUMNS = 5;

  let activeDrag = null;
  let highestZ = 100;
  let initializeToken = 0;

  function readLayoutStore() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(
          LAYOUT_KEY
        ) || '{}'
      );

      return (
        parsed
        && typeof parsed === 'object'
      )
        ? parsed
        : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLayoutStore(store) {
    try {
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify(store)
      );
    } catch (error) {
      console.warn(
        'Template layout save failed',
        error
      );
    }
  }

  function readStateLayoutStore() {
    if (
      !state.templateOverviewLayouts
      || typeof
        state.templateOverviewLayouts
        !== 'object'
    ) {
      state.templateOverviewLayouts = {};
    }

    return state.templateOverviewLayouts;
  }

  function findNote(card) {
    return state.notes.find(
      note =>
        String(note.id)
        === card.dataset.noteId
    );
  }

  function boardWidth(board) {
    return Math.round(
      board.getBoundingClientRect()
        .width
      || board.clientWidth
      || 0
    );
  }

  function cardSize(
    card,
    note
  ) {
    const fallback =
      typeof templateOverviewSize
        === 'function'
        ? templateOverviewSize(note)
        : {
            width: 220,
            height: 280
          };

    return {
      width:
        card.getBoundingClientRect()
          .width
        || card.offsetWidth
        || parseFloat(
          card.style.getPropertyValue(
            '--paper-width'
          )
        )
        || fallback.width,
      height:
        card.getBoundingClientRect()
          .height
        || card.offsetHeight
        || parseFloat(
          card.style.getPropertyValue(
            '--paper-height'
          )
        )
        || fallback.height
    };
  }

  function seededValue(
    value,
    salt
  ) {
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
  }

  function updateBoardHeight(board) {
    const cards = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ];
    const bottom =
      cards.reduce(
        (maximum, card) => {
          const note = findNote(card);
          const size =
            cardSize(card, note);

          return Math.max(
            maximum,
            (
              parseFloat(
                card.style.top
              ) || 0
            ) + size.height
          );
        },
        0
      );

    board.style.height =
      `${Math.max(
        420,
        bottom + 54
      )}px`;
  }

  function normalizedLayout(
    layout
  ) {
    if (
      !layout
      || typeof layout !== 'object'
    ) {
      return null;
    }

    const version =
      Number(layout.version) || 0;

    if (
      version < 5
      || !Number.isFinite(
        Number(layout.x)
      )
      || !Number.isFinite(
        Number(layout.y)
      )
    ) {
      return null;
    }

    return layout;
  }

  function savedLayout(
    note,
    store
  ) {
    const stateStore =
      readStateLayoutStore();

    return (
      normalizedLayout(
        store[String(note.id)]
      )
      || normalizedLayout(
        stateStore[String(note.id)]
      )
      || normalizedLayout(
        note.overviewLayout
      )
    );
  }

  function resolvedPosition(
    layout,
    width,
    displayWidth
  ) {
    const savedBoardWidth =
      Number(layout.boardWidth)
      || width;
    const savedWidth =
      Number(layout.width)
      || displayWidth;
    const oldMaximumX =
      Math.max(
        1,
        savedBoardWidth
        - savedWidth
      );
    const newMaximumX =
      Math.max(
        0,
        width - displayWidth
      );
    const xRatio =
      Number.isFinite(
        Number(layout.xRatio)
      )
        ? Number(layout.xRatio)
        : (
            Number(layout.x)
            || 0
          ) / oldMaximumX;

    return {
      x:
        Math.max(
          0,
          Math.min(
            newMaximumX,
            xRatio * newMaximumX
          )
        ),
      y:
        Math.max(
          0,
          Number(layout.y) || 0
        ),
      z:
        Math.max(
          1,
          Number(layout.z) || 1
        )
    };
  }

  function persistCardLayout(
    card,
    board,
    mode = 'manual',
    store = readLayoutStore()
  ) {
    const note = findNote(card);

    if (!note) return store;

    const width =
      boardWidth(board);
    const size =
      cardSize(card, note);
    const x =
      parseFloat(
        card.style.left
      ) || 0;
    const maximumX =
      Math.max(
        1,
        width - size.width
      );
    const layout = {
      version: LAYOUT_VERSION,
      mode,
      x,
      xRatio:
        Math.max(
          0,
          Math.min(
            1,
            x / maximumX
          )
        ),
      y:
        parseFloat(
          card.style.top
        ) || 0,
      z:
        Number(
          card.style.zIndex
        ) || 1,
      width: size.width,
      boardWidth: width
    };

    note.overviewLayout = layout;
    store[String(note.id)] =
      layout;
    readStateLayoutStore()[
      String(note.id)
    ] = layout;

    return store;
  }

  function persistBoard(
    board,
    mode
  ) {
    let store =
      readLayoutStore();

    board
      .querySelectorAll(
        '.template-overview-paper'
      )
      .forEach(card => {
        store =
          persistCardLayout(
            card,
            board,
            mode,
            store
          );
      });

    writeLayoutStore(store);

    if (
      typeof saveData
      === 'function'
    ) {
      saveData();
    }
  }

  function randomPosition(
    note,
    index,
    width,
    cardWidth
  ) {
    const columns =
      Math.max(
        1,
        Math.min(
          DESKTOP_COLUMNS,
          Math.floor(
            width / 205
          )
        )
      );
    const laneWidth =
      width / columns;
    const column =
      index % columns;
    const row =
      Math.floor(
        index / columns
      );
    const overlap =
      Math.min(
        72,
        laneWidth * .32
      );
    const baseX =
      column * laneWidth
      + (
        laneWidth - cardWidth
      ) / 2;
    const x =
      baseX
      + (
        seededValue(
          note.id,
          'x'
        ) - .5
      ) * overlap;
    const y =
      24
      + row * 245
      + (
        seededValue(
          note.id,
          'y'
        ) - .5
      ) * 86;

    return {
      x:
        Math.max(
          0,
          Math.min(
            width - cardWidth,
            x
          )
        ),
      y: Math.max(12, y),
      z:
        10
        + Math.floor(
          seededValue(
            note.id,
            'z'
          ) * 70
        )
    };
  }

  function initializeBoard(
    notes = state.notes,
    attempt = 0,
    token = initializeToken
  ) {
    const board =
      document.querySelector(
        '#noteGrid.template-overview-board'
      );

    if (
      !board
      || token !== initializeToken
    ) {
      return;
    }

    const width =
      boardWidth(board);

    if (width < 1) {
      if (attempt < 12) {
        setTimeout(
          () =>
            initializeBoard(
              notes,
              attempt + 1,
              token
            ),
          40
        );
      }
      return;
    }

    const notesById =
      new Map(
        notes.map(
          note => [
            String(note.id),
            note
          ]
        )
      );
    const store =
      readLayoutStore();
    const cards = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ];

    cards.forEach(
      (card, index) => {
        const note =
          notesById.get(
            card.dataset.noteId
          )
          || findNote(card);

        if (!note) return;

        const fallback =
          typeof templateOverviewSize
            === 'function'
            ? templateOverviewSize(note)
            : {
                width: 220
              };
        const layout =
          savedLayout(note, store);
        const displayWidth =
          Math.min(
            Number(layout?.width)
              || fallback.width,
            width
          );
        const position =
          layout
            ? resolvedPosition(
                layout,
                width,
                displayWidth
              )
            : randomPosition(
                note,
                index,
                width,
                displayWidth
              );

        card.style.left =
          `${position.x}px`;
        card.style.top =
          `${position.y}px`;
        card.style.width =
          `${displayWidth}px`;
        card.style.zIndex =
          String(position.z);
        card.title =
          '끌어서 원하는 위치에 놓기';

        highestZ =
          Math.max(
            highestZ,
            position.z
          );
      }
    );

    updateBoardHeight(board);
  }

  function requestInitialize(
    notes = state.notes
  ) {
    initializeToken += 1;
    const token =
      initializeToken;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initializeBoard(
          notes,
          0,
          token
        );
      });
    });
  }

  function restoreVisibleBoard() {
    const board =
      document.querySelector(
        '#noteGrid.template-overview-board'
      );

    if (
      !board
      || !board.querySelector(
        '.template-overview-paper'
      )
    ) {
      return;
    }

    const visibleNotes = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ]
      .map(findNote)
      .filter(Boolean);

    requestInitialize(
      visibleNotes
    );
  }

  function alignedColumns(width) {
    if (width >= 720) {
      return DESKTOP_COLUMNS;
    }

    return Math.max(
      1,
      Math.min(
        4,
        Math.floor(
          width / 170
        )
      )
    );
  }

  function alignBoard() {
    const board =
      document.querySelector(
        '#noteGrid.template-overview-board'
      );

    if (!board) return;

    const cards = [
      ...board.querySelectorAll(
        '.template-overview-paper'
      )
    ];
    const width =
      boardWidth(board);

    if (
      !cards.length
      || width < 1
    ) {
      return;
    }

    const columns =
      alignedColumns(width);
    const edge = 12;
    const columnGap = 16;
    const rowGap = 30;
    const slotWidth =
      (
        width
        - edge * 2
        - columnGap
          * (columns - 1)
      ) / columns;
    const rowHeights = [];

    cards.forEach(
      (card, index) => {
        const note = findNote(card);
        const size =
          cardSize(card, note);
        const row =
          Math.floor(
            index / columns
          );

        rowHeights[row] =
          Math.max(
            rowHeights[row] || 0,
            size.height
          );
      }
    );

    const rowTops = [];
    let nextTop = 20;

    rowHeights.forEach(
      (height, row) => {
        rowTops[row] =
          nextTop;
        nextTop +=
          height + rowGap;
      }
    );

    cards.forEach(
      (card, index) => {
        const note = findNote(card);
        const original =
          typeof templateOverviewSize
            === 'function'
            ? templateOverviewSize(note)
            : cardSize(card, note);
        const displayWidth =
          Math.min(
            original.width,
            Math.max(
              96,
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

        card.style.left = `${x}px`;
        card.style.top =
          `${rowTops[row] || 20}px`;
        card.style.width =
          `${displayWidth}px`;
        card.style.zIndex =
          String(index + 1);
        card.dataset.dragged =
          'false';
      }
    );

    updateBoardHeight(board);
    persistBoard(board, 'aligned');
  }

  function eventPoint(event) {
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
  }

  function removeDragListeners() {
    window.removeEventListener(
      'mousemove',
      moveDrag,
      true
    );
    window.removeEventListener(
      'mouseup',
      finishDrag,
      true
    );
    window.removeEventListener(
      'touchmove',
      moveDrag,
      true
    );
    window.removeEventListener(
      'touchend',
      finishDrag,
      true
    );
    window.removeEventListener(
      'touchcancel',
      finishDrag,
      true
    );
  }

  function moveDrag(event) {
    if (!activeDrag) return;

    const point =
      eventPoint(event);
    const deltaX =
      point.x
      - activeDrag.startClientX;
    const deltaY =
      point.y
      - activeDrag.startClientY;

    if (
      !activeDrag.moved
      && Math.hypot(
        deltaX,
        deltaY
      ) < 3
    ) {
      return;
    }

    activeDrag.moved = true;

    const width =
      boardWidth(
        activeDrag.board
      );
    const size =
      cardSize(
        activeDrag.card,
        activeDrag.note
      );
    const maximumX =
      Math.max(
        0,
        width - size.width
      );

    activeDrag.card.style.left =
      `${Math.max(
        0,
        Math.min(
          maximumX,
          activeDrag.startX
          + deltaX
        )
      )}px`;
    activeDrag.card.style.top =
      `${Math.max(
        0,
        activeDrag.startY
        + deltaY
      )}px`;

    updateBoardHeight(
      activeDrag.board
    );

    event.preventDefault();
    event.stopPropagation();
  }

  function finishDrag(event) {
    if (!activeDrag) return;

    const drag =
      activeDrag;
    activeDrag = null;
    removeDragListeners();
    drag.card.classList.remove(
      'dragging'
    );

    if (!drag.moved) return;

    drag.card.dataset.dragged =
      'true';

    const store =
      persistCardLayout(
        drag.card,
        drag.board,
        'manual'
      );

    writeLayoutStore(store);

    if (
      typeof saveData
      === 'function'
    ) {
      saveData();
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function startDrag(event) {
    const card =
      event.target.closest(
        '.template-overview-paper'
      );

    if (
      !card
      || (
        event.type === 'mousedown'
        && event.button !== 0
      )
      || event.target.closest(
        'button, a, input, select, textarea, [data-note-select]'
      )
    ) {
      return;
    }

    const board =
      card.closest(
        '.template-overview-board'
      );
    const note =
      findNote(card);

    if (
      !board
      || !note
    ) {
      return;
    }

    removeDragListeners();

    const point =
      eventPoint(event);

    highestZ += 1;
    card.style.zIndex =
      String(highestZ);

    activeDrag = {
      card,
      board,
      note,
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

    card.classList.add(
      'dragging'
    );

    if (
      event.type === 'touchstart'
    ) {
      window.addEventListener(
        'touchmove',
        moveDrag,
        {
          capture: true,
          passive: false
        }
      );
      window.addEventListener(
        'touchend',
        finishDrag,
        true
      );
      window.addEventListener(
        'touchcancel',
        finishDrag,
        true
      );
    } else {
      window.addEventListener(
        'mousemove',
        moveDrag,
        true
      );
      window.addEventListener(
        'mouseup',
        finishDrag,
        true
      );
    }

    event.preventDefault();
    event.stopPropagation();
  }

  document.addEventListener(
    'mousedown',
    startDrag,
    true
  );
  document.addEventListener(
    'touchstart',
    startDrag,
    {
      capture: true,
      passive: false
    }
  );
  document.addEventListener(
    'dragstart',
    event => {
      if (
        event.target.closest(
          '.template-overview-paper'
        )
      ) {
        event.preventDefault();
      }
    },
    true
  );
  document.addEventListener(
    'click',
    event => {
      const resetButton =
        event.target.closest(
          '#templateOverviewResetBtn'
        );

      if (resetButton) {
        alignBoard();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const draggedCard =
        event.target.closest(
          '.template-overview-paper[data-dragged="true"]'
        );

      if (draggedCard) {
        draggedCard.dataset.dragged =
          'false';
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  window
    .addEventListener(
      'resize',
      () => {
        const board =
          document.querySelector(
            '#noteGrid.template-overview-board'
          );

        if (board) {
          requestInitialize();
        }
      }
    );

  const boardObserver =
    new MutationObserver(
      mutations => {
        const needsRestore =
          mutations.some(
            mutation =>
              mutation.type
                === 'childList'
              && (
                mutation.target.id
                  === 'noteGrid'
                || mutation.target.closest?.(
                  '#noteGrid'
                )
              )
          );

        if (needsRestore) {
          restoreVisibleBoard();
        }
      }
    );

  boardObserver.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  [
    'pageshow',
    'popstate',
    'hashchange'
  ].forEach(eventName => {
    window.addEventListener(
      eventName,
      restoreVisibleBoard
    );
  });

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState
        === 'visible'
      ) {
        restoreVisibleBoard();
      }
    }
  );

  window.initializeTemplateOverviewBoard =
    requestInitialize;
  window.alignTemplateOverviewBoard =
    alignBoard;

  /*
   * 초기 render()가 이 파일보다 먼저 실행된 경우에도
   * 현재 화면의 저장 좌표를 즉시 되살립니다.
   */
  restoreVisibleBoard();
})();
