'use strict';

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
        () => {
          if (button.dataset.view === 'all') {
            browseMode = 'folder';
            browseSecondaryFilter = 'all';
          }
          setView(
            button.dataset.view
          );
        }
      );
        });

      document
        .querySelectorAll('[data-sidebar-template]')
        .forEach(button => {
          button.addEventListener('click', () => {
            browseMode = 'template';
            browseTemplate =
              button.dataset.sidebarTemplate;
            browseSecondaryFilter = 'all';
            memoAlbumPage = 1;
            memoAlbumSearchTerm = '';
            $('#memoAlbumSearch').value = '';
            setView('all');
          });
        });

      archiveViewSwitch
        .querySelectorAll('[data-browse-mode]')
        .forEach(button => {
          button.addEventListener('click', () => {
            browseMode = button.dataset.browseMode;
            browseSecondaryFilter = 'all';
            memoAlbumPage = 1;
            memoAlbumSearchTerm = '';
            $('#memoAlbumSearch').value = '';
            if (currentView !== 'all') {
              setView('all');
            } else {
              renderFolderGridView();
            }
          });
        });

      $('#folderContextBack')
        .addEventListener(
          'click',
          () => setView('all')
        );

      archiveTemplateFilters
        .querySelectorAll('[data-template-filter]')
        .forEach(button => {
          button.addEventListener('click', () => {
            browseMode = 'template';
            browseTemplate = button.dataset.templateFilter;
            browseSecondaryFilter = 'all';
            memoAlbumPage = 1;
            memoAlbumSearchTerm = '';
            $('#memoAlbumSearch').value = '';
            renderFolderGridView();
          });
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

  $('#memoAlbumSearch')
    .addEventListener(
      'input',
      event => {
        memoAlbumSearchTerm =
          event.target.value;
        memoAlbumPage = 1;
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
            'list-wing-open'
          );
      }
    );

  $('#chatWingToggle')
    .addEventListener(
      'click',
      event => {
        const shell =
          chatConversation.parentElement;
        const open =
          shell.classList.toggle(
            'list-wing-open'
          );
        event.currentTarget
          .setAttribute(
            'aria-expanded',
            String(open)
          );
      }
    );

  $('#chatPhotoInput')
    .addEventListener(
      'change',
      event => {
        prepareChatPhoto(
          event.target.files?.[0]
        );
      }
    );

  $('#chatAttachmentRemove')
    .addEventListener(
      'click',
      clearPendingChatImage
    );

  $('#chatDrawBtn')
    .addEventListener(
      'click',
      openChatDrawing
    );

  $('#chatDrawingClose')
    .addEventListener(
      'click',
      closeChatDrawing
    );

  $('#chatDrawingCancel')
    .addEventListener(
      'click',
      closeChatDrawing
    );

  $('#chatDrawingAttach')
    .addEventListener(
      'click',
      attachChatDrawing
    );

  $('#chatDrawingClear')
    .addEventListener(
      'click',
      resetChatDrawing
    );

  $('#chatDrawingEraser')
    .addEventListener(
      'click',
      event => {
        chatDrawingEraser =
          !chatDrawingEraser;
        event.currentTarget
          .classList.toggle(
            'active',
            chatDrawingEraser
          );
      }
    );

  document
    .querySelectorAll(
      '[data-chat-draw-color]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          chatDrawingColor =
            button.dataset
              .chatDrawColor;
          chatDrawingEraser = false;
          $('#chatDrawingEraser')
            .classList.remove(
              'active'
            );
          document
            .querySelectorAll(
              '[data-chat-draw-color]'
            )
            .forEach(item =>
              item.classList.toggle(
                'active',
                item === button
              )
            );
        }
      );
    });

  document
    .querySelectorAll(
      '[data-chat-draw-width]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          chatDrawingWidth =
            Number(
              button.dataset
                .chatDrawWidth
            );
          document
            .querySelectorAll(
              '[data-chat-draw-width]'
            )
            .forEach(item =>
              item.classList.toggle(
                'active',
                item === button
              )
            );
        }
      );
    });

  const chatDrawingCanvas =
    $('#chatDrawingCanvas');

  chatDrawingCanvas
    .addEventListener(
      'pointerdown',
      beginChatDrawing
    );
  chatDrawingCanvas
    .addEventListener(
      'pointermove',
      continueChatDrawing
    );
  chatDrawingCanvas
    .addEventListener(
      'pointerup',
      endChatDrawing
    );
  chatDrawingCanvas
    .addEventListener(
      'pointercancel',
      endChatDrawing
    );

  $('#chatDrawingModal')
    .addEventListener(
      'click',
      event => {
        if (
          event.target
          === event.currentTarget
        ) {
          closeChatDrawing();
        }
      }
    );

  function closeChatImageLightbox() {
    $('#chatImageLightbox').hidden = true;
    $('#chatImageLightboxImage')
      .removeAttribute('src');
  }

  $('#chatImageLightboxClose')
    .addEventListener(
      'click',
      closeChatImageLightbox
    );

  $('#chatImageLightbox')
    .addEventListener(
      'click',
      event => {
        if (
          event.target
          === event.currentTarget
        ) {
          closeChatImageLightbox();
        }
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
    'paste',
    event => {
      const imageItem = [
        ...(event.clipboardData?.items || [])
      ].find(
        item =>
          item.type.startsWith('image/')
      );

      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      event.preventDefault();
      prepareChatPhoto(file);
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
          goBackInArchive
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
            setView('home');
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

  bindImageDropTarget(
    $('#calendarPhotoPicker'),
    files =>
      previewCalendarPhoto(files[0]),
    {
      onError: message => {
        calendarEntryMessage
          .textContent = message;
      }
    }
  );

  calendarEntryModal
    .addEventListener(
      'paste',
      event => {
        const images =
          clipboardImageFiles(
            event.clipboardData
          );

        if (!images.length) return;

        event.preventDefault();
        previewCalendarPhoto(
          images[0]
        );
      }
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
        if (
          !$('#chatDrawingModal')
            .hidden
        ) {
          closeChatDrawing();
        } else if (!$('#chatImageLightbox').hidden) {
          closeChatImageLightbox();
        } else if (!folderModal.hidden) {
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
              goBackInArchive();
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
