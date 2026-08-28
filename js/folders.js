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
      folderNoteCount(folderId);

    const directCount =
      state.notes.filter(
        note => note.folderId === folderId
      ).length;

    const childCount =
      state.folders.filter(
        item =>
          folderParentId(item) === folderId
      ).length;

    const message =
      count > 0 || childCount > 0
        ? `"${folder.name}" 폴더를 삭제할까요? 직접 담긴 자료 ${directCount}개와 하위 폴더 ${childCount}개는 한 단계 위로 이동합니다.`
        : `"${folder.name}" 폴더를 삭제할까요?`;

    folderDeleteInProgress = true;

    const shouldDelete =
      confirm(message);

    if (!shouldDelete) {
      folderDeleteInProgress = false;
      return;
    }

    const parentId =
      folderParentId(folder);
    const deletedAt = Date.now();

    state.folders.forEach(item => {
      if (
        folderParentId(item) === folderId
      ) {
        item.parentId = parentId;
        item.updatedAt = deletedAt;
      }
    });

    state.folders =
      state.folders.filter(
        item => item.id !== folderId
      );

    state.notes.forEach(note => {
      if (note.folderId === folderId) {
        note.folderId = parentId;
        note.updatedAt = deletedAt;
      }
    });

    state.deletedFolders =
      normalizeDeletionMap(
        state.deletedFolders
      );
    state.deletedFolders[folderId] =
      deletedAt;

    expandedSidebarFolderIds.delete(
      folderId
    );

    if (currentView === folderId) {
      currentView = 'all';
    }

    saveData();
    render();

    if (currentUser) {
      clearTimeout(cloudSaveTimer);
      await pushCloudData();
    }

    folderDeleteInProgress = false;
  }

  function openFolderModal(
    parentId = ''
  ) {
    const requestedParentId =
      typeof parentId === 'string'
        ? parentId
        : '';
    folderNameInput.value = '';

    pendingFolderColor =
      FOLDER_COLORS[0];

    folderParentSelect.innerHTML =
      '<option value="">상위 폴더 없음</option>'
      + orderedFolderEntries()
        .map(({ folder, depth }) => `
          <option value="${folder.id}">
            ${'　'.repeat(depth)}${escapeHtml(folder.name)}
          </option>
        `)
        .join('');
    folderParentSelect.value =
      state.folders.some(
        folder =>
          folder.id === requestedParentId
      )
        ? requestedParentId
        : '';

    const parentFolder = state.folders.find(
      folder =>
        folder.id === folderParentSelect.value
    );
    folderModal.querySelector('h3').textContent =
      parentFolder
        ? `${parentFolder.name}에 하위 폴더 추가`
        : '새 폴더';

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
