'use strict';

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
