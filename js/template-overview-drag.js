'use strict';

/*
 * 템플릿별 → 전체 자유 배치 전용 이벤트입니다.
 * 다른 화면 스크립트의 실행 여부와 관계없이 마지막에
 * 독립적으로 연결되도록 문서 이벤트 위임을 사용합니다.
 */
(() => {
  let activeDrag = null;
  let highestZ = 100;

  const boardWidth =
    board =>
      board.clientWidth
      || board.getBoundingClientRect().width
      || 0;

  const cardWidth =
    card =>
      card.getBoundingClientRect().width
      || card.offsetWidth
      || parseFloat(
        card.style.getPropertyValue(
          '--paper-width'
        )
      )
      || 0;

  const eventPoint =
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

  const findNote =
    card =>
      state.notes.find(
        note =>
          note.id
          === card.dataset.noteId
      );

  const updateBoardHeight =
    board => {
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
    };

  const stopListening =
    () => {
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
    };

  const finishDrag =
    event => {
      if (!activeDrag) return;

      const {
        card,
        board,
        moved
      } = activeDrag;

      activeDrag = null;
      stopListening();
      card.classList.remove('dragging');

      if (!moved) return;

      card.dataset.dragged = 'true';

      const note = findNote(card);

      if (note) {
        note.overviewLayout = {
          version: 4,
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
            boardWidth(board)
        };

        saveData();
      }

      event.preventDefault();
      event.stopPropagation();
    };

  const moveDrag =
    event => {
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
        ) < 2
      ) {
        return;
      }

      activeDrag.moved = true;

      const maximumX =
        Math.max(
          0,
          boardWidth(
            activeDrag.board
          )
          - cardWidth(
            activeDrag.card
          )
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
    };

  const startDrag =
    event => {
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
      ) {
        return;
      }

      const board =
        card.closest(
          '.template-overview-board'
        );

      if (!board) return;

      stopListening();

      const point =
        eventPoint(event);

      highestZ =
        Math.max(
          highestZ + 1,
          ...[
            ...board.querySelectorAll(
              '.template-overview-paper'
            )
          ].map(
            item =>
              Number(
                item.style.zIndex
              ) || 0
          )
        );

      activeDrag = {
        card,
        board,
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
        String(highestZ);

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
    };

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

      if (!resetButton) return;

      state.notes.forEach(note => {
        delete note.overviewLayout;
      });

      saveData();
      renderFolderGridView();

      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
})();
