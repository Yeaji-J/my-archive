'use strict';

/* ---------------- Links / Collection / Template search ---------------- */

let templateDataSaveTimer = null;
const TEMPLATE_ALBUM_PAGE_SIZE = {
  moodboard: 6,
  collection: 15
};
const templateAlbumPages = {
  moodboard: 1,
  collection: 1
};

function scheduleTemplateDataSave(
  targetNote = getCurrentNote()
) {
  const note = targetNote;
  if (!note) return;

  note.updatedAt = Date.now();
  updateEditorMeta(note);
  saveData();

  clearTimeout(templateDataSaveTimer);
  templateDataSaveTimer = setTimeout(() => {
    if (getCurrentNote()?.id === note.id) {
      renderTemplateLibraryBar(
        note.template || 'memo'
      );
    }
  }, 350);
}

function ensureLinkData(note) {
  if (!note.linkData) {
    note.linkData = { url: '', siteName: '', description: '', category: '' };
  }
  return note.linkData;
}

function renderLinkEditor() {
  const note = getCurrentNote();
  if (!note) return;
  const data = ensureLinkData(note);
  $('#linkUrlInput').value = data.url || '';
  $('#linkSiteNameInput').value = data.siteName || '';
  $('#linkDescriptionInput').value = data.description || '';
  $('#linkCategoryInput').value = data.category || '';
  updateLinkPreview();
}

function updateLinkPreview() {
  const note = getCurrentNote();
  if (!note) return;
  const data = ensureLinkData(note);
  const card = $('#linkPreviewCard');
  let parsed = null;
  try { parsed = new URL(data.url); } catch (_error) { parsed = null; }

  card.href = parsed ? parsed.href : '#';
  $('#linkPreviewTitle').textContent = data.siteName || note.title || '링크를 입력해보세요';
  $('#linkPreviewDomain').textContent = parsed?.hostname || '';
  const favicon = $('#linkPreviewFavicon');
  if (parsed) {
    favicon.src = `${parsed.origin}/favicon.ico`;
    favicon.hidden = false;
  } else {
    favicon.hidden = true;
  }
}

function updateLinkField(field, value) {
  const note = getCurrentNote();
  if (!note) return;
  const data = ensureLinkData(note);
  data[field] = value;
  if (field === 'siteName' && (!note.title || note.title === data.previousSiteName)) {
    note.title = value;
    noteTitle.value = value;
  }
  if (field === 'siteName') data.previousSiteName = value;
  updateLinkPreview();
  scheduleTemplateDataSave();
}

function ensureCollectionData(note) {
  if (!note.collectionData) {
    note.collectionData = { type: '책', cover: '', oneLine: '', tags: [], content: '', fields: [] };
  }
  if (!Array.isArray(note.collectionData.fields)) note.collectionData.fields = [];
  if (!Array.isArray(note.collectionData.tags)) note.collectionData.tags = [];
  return note.collectionData;
}

function renderCollectionEditor() {
  const note = getCurrentNote();
  if (!note) return;
  const data = ensureCollectionData(note);

  document.querySelectorAll('[data-collection-type]').forEach(button => {
    button.classList.toggle('active', button.dataset.collectionType === data.type);
  });
  $('#collectionOneLineInput').value = data.oneLine || '';
  $('#collectionTagsInput').value = data.tags.join(', ');
  $('#collectionContentInput').value = data.content || '';

  const preview = $('#collectionCoverPreview');
  preview.hidden = !data.cover;
  $('#collectionCoverEmpty').hidden = Boolean(data.cover);
  if (data.cover) preview.src = data.cover;

  const fields = $('#collectionFields');
  fields.innerHTML = '';
  data.fields.forEach(field => {
    const row = document.createElement('div');
    row.className = 'collection-field-row';
    row.innerHTML = `
      <input type="text" class="collection-field-label" placeholder="항목명" value="${escapeHtml(field.label || '')}">
      <input type="text" class="collection-field-value" placeholder="내용" value="${escapeHtml(field.value || '')}">
      <button type="button" aria-label="정보 삭제">×</button>
    `;
    row.querySelector('.collection-field-label').addEventListener('input', event => { field.label = event.target.value; scheduleTemplateDataSave(); });
    row.querySelector('.collection-field-value').addEventListener('input', event => { field.value = event.target.value; scheduleTemplateDataSave(); });
    row.querySelector('button').addEventListener('click', () => {
      data.fields = data.fields.filter(item => item.id !== field.id);
      renderCollectionEditor();
      scheduleTemplateDataSave();
    });
    fields.appendChild(row);
  });
}

function addCollectionField() {
  const note = getCurrentNote();
  if (!note) return;
  const data = ensureCollectionData(note);
  data.fields.push({ id: uid(), label: '', value: '' });
  renderCollectionEditor();
  scheduleTemplateDataSave();
  requestAnimationFrame(() => $('#collectionFields .collection-field-row:last-child input')?.focus());
}

function templateSearchText(note) {
  const parts = [note.title, note.content];
  if (note.template === 'links') {
    const data = ensureLinkData(note);
    parts.push(data.url, data.siteName, data.description, data.category);
  }
  if (note.template === 'collection') {
    const data = ensureCollectionData(note);
    parts.push(data.type, data.oneLine, data.content, data.tags.join(' '));
    data.fields.forEach(field => parts.push(field.label, field.value));
  }
  if (note.template === 'moodboard') {
    ensureMoodboard(note).items.filter(item => item.type === 'text').forEach(item => parts.push(item.text));
  }
  if (note.template === 'todo') {
    parts.push(postitSearchText(note));
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function templateFilterValue(note, template) {
  if (template === 'links') return ensureLinkData(note).category || '미분류';
  if (template === 'collection') return ensureCollectionData(note).type || '기타';
  if (template === 'memo') return state.folders.find(folder => folder.id === note.folderId)?.name || '폴더 없음';
  if (template === 'todo') return ensurePostitData(note).tags[0] || '태그 없음';
  return '전체';
}

function templateFilterValues(note, template) {
  if (template === 'todo') {
    const tags =
      ensurePostitData(note).tags;
    return tags.length
      ? tags
      : ['태그 없음'];
  }

  return [
    templateFilterValue(
      note,
      template
    )
  ];
}

function renderTemplateLibraryBar(template) {
  const search = $('#editorTemplateSearch');
  const filter = $('#editorTemplateFilter');
  const wrap = $('#editorLibraryResults');
  const notes = state.notes.filter(note => (note.template || 'memo') === template);
  const filterValues = [
    ...new Set(
      notes.flatMap(
        note =>
          templateFilterValues(
            note,
            template
          )
      )
    )
  ].filter(value => value !== '전체');
  const previousFilter = filter.dataset.template === template ? filter.value : 'all';

  filter.dataset.template = template;
  filter.innerHTML = '<option value="all">전체</option>' + filterValues.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  filter.value = filterValues.includes(previousFilter) ? previousFilter : 'all';

  const query = search.value.trim().toLowerCase();
  const filtered = notes.filter(note => {
    const matchesQuery = !query || templateSearchText(note).includes(query);
    const matchesFilter =
      filter.value === 'all'
      || templateFilterValues(
        note,
        template
      ).includes(filter.value);
    return matchesQuery && matchesFilter;
  });

  wrap.innerHTML = filtered.slice(0, 8).map(note => `
    <button type="button" class="editor-result-chip ${note.id === currentNoteId ? 'current' : ''}" data-result-note="${note.id}">${escapeHtml(note.title || '제목 없음')}</button>
  `).join('');
  wrap.querySelectorAll('[data-result-note]').forEach(button => {
    button.addEventListener('click', () => {
      persistCurrentNote();
      openNoteView(button.dataset.resultNote);
    });
  });
}

function safeExternalUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:']
      .includes(parsed.protocol)
      ? parsed.href
      : '';
  } catch (_error) {
    return '';
  }
}

function specializedCardClass(
  baseClass,
  note
) {
  return baseClass
    + (
      archiveSelectionMode
        ? ' selection-mode'
        : ''
    )
    + (
      selectedArchiveNoteIds.has(note.id)
        ? ' selected'
        : ''
    );
}

function bindSpecializedCard(
  card,
  note,
  openTarget = card
) {
  openTarget.addEventListener(
    'click',
    () => {
      if (archiveSelectionMode) {
        toggleArchiveNoteSelection(note.id);
        return;
      }

      openNoteView(note.id);
    }
  );

  card
    .querySelector('[data-note-select]')
    ?.addEventListener(
      'click',
      event => {
        event.stopPropagation();
        toggleArchiveNoteSelection(note.id);
      }
    );
}

function moodboardPreviewItem(item) {
  const left =
    Math.max(0, Number(item.x) || 0) / 10;
  const top =
    Math.max(0, Number(item.y) || 0) / 5;
  const width =
    Math.max(
      8,
      Number(item.width)
        || (
          item.type === 'image'
            ? 240
            : 220
        )
    ) / 10;
  const height =
    Math.max(
      8,
      Number(item.height)
        || (
          item.type === 'image'
            ? 160
            : 72
        )
    ) / 5;
  const style = [
    `left:${Math.min(left, 92)}%`,
    `top:${Math.min(top, 90)}%`,
    `width:${Math.min(width, 72)}%`,
    `height:${Math.min(height, 70)}%`,
    `transform:rotate(${Number(item.rotation) || 0}deg)`
  ].join(';');

  if (item.type === 'image') {
    return `
      <span class="moodboard-album-item image" style="${style}">
        <img src="${escapeHtml(item.src || '')}" alt="">
      </span>
    `;
  }

  return `
    <span class="moodboard-album-item text" style="${style}">
      ${escapeHtml(item.text || '')}
    </span>
  `;
}

function renderTemplateAlbumPagination(
  template,
  notes
) {
  const pagination =
    $('#templateAlbumPagination');
  const pageSize =
    TEMPLATE_ALBUM_PAGE_SIZE[template];

  if (!pageSize) {
    pagination.hidden = true;
    return notes;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(notes.length / pageSize)
  );
  templateAlbumPages[template] =
    Math.min(
      Math.max(
        1,
        templateAlbumPages[template] || 1
      ),
      totalPages
    );
  const currentPage =
    templateAlbumPages[template];

  pagination.hidden =
    notes.length === 0;
  pagination.innerHTML = `
    <button
      type="button"
      data-template-album-page="${currentPage - 1}"
      ${currentPage === 1 ? 'disabled' : ''}
      aria-label="이전 페이지"
    >‹</button>
    <span>
      ${
        Array.from(
          { length: totalPages },
          (_, index) => `
            <button
              type="button"
              class="${index + 1 === currentPage ? 'active' : ''}"
              data-template-album-page="${index + 1}"
            >${index + 1}</button>
          `
        ).join('')
      }
    </span>
    <button
      type="button"
      data-template-album-page="${currentPage + 1}"
      ${currentPage === totalPages ? 'disabled' : ''}
      aria-label="다음 페이지"
    >›</button>
  `;

  pagination
    .querySelectorAll(
      '[data-template-album-page]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          templateAlbumPages[template] =
            Number(
              button.dataset
                .templateAlbumPage
            );
          renderFolderGridView();
          folderGridView.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      );
    });

  const start =
    (currentPage - 1) * pageSize;
  return notes.slice(
    start,
    start + pageSize
  );
}

function renderMoodboardAlbum(notes) {
  renderTemplateAlbumPagination(
    'moodboard',
    notes
  ).forEach(note => {
    const data = ensureMoodboard(note);
    const card =
      document.createElement('article');
    card.className =
      specializedCardClass(
        `moodboard-album-card moodboard-skin-${data.skin}`,
        note
      );
    card.innerHTML = `
      ${
        archiveSelectionMode
          ? archiveSelectionButton(note.id)
          : ''
      }
      <button class="moodboard-album-open" type="button">
        <span class="moodboard-album-preview moodboard-skin-${data.skin}">
          ${
            data.drawing
              ? `<img class="moodboard-album-drawing" src="${escapeHtml(data.drawing)}" alt="">`
              : ''
          }
          ${data.items.map(moodboardPreviewItem).join('')}
          ${
            !data.items.length
            && !data.drawing
              ? '<span class="moodboard-album-empty">아직 비어 있는 무드보드</span>'
              : ''
          }
        </span>
        <span class="moodboard-album-copy">
          <strong>${escapeHtml(note.title || '제목 없음')}</strong>
          <small>${formatDate(note.updatedAt)}</small>
        </span>
      </button>
    `;
    bindSpecializedCard(
      card,
      note,
      card.querySelector(
        '.moodboard-album-open'
      )
    );
    noteGrid.appendChild(card);
  });
}

function renderLinkArchiveList(notes) {
  $('#templateAlbumPagination').hidden =
    true;

  notes.forEach((note, index) => {
    const data = ensureLinkData(note);
    const href =
      safeExternalUrl(data.url);
    const row =
      document.createElement('article');
    row.className =
      specializedCardClass(
        'link-archive-row',
        note
      );
    row.innerHTML = `
      ${
        archiveSelectionMode
          ? archiveSelectionButton(note.id)
          : ''
      }
      <button class="link-archive-open" type="button">
        <span class="link-archive-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="link-archive-copy">
          <strong>${escapeHtml(data.siteName || note.title || '제목 없음')}</strong>
          ${
            data.description
              ? `<small>${escapeHtml(data.description)}</small>`
              : ''
          }
        </span>
        ${
          data.category
            ? `<span class="link-archive-category">${escapeHtml(data.category)}</span>`
            : ''
        }
      </button>
      ${
        href
          ? `
            <a class="link-archive-go" href="${escapeHtml(href)}" target="_blank" rel="noopener">
              바로가기 <span aria-hidden="true">↗</span>
            </a>
          `
          : '<span class="link-archive-go disabled">주소 없음</span>'
      }
    `;
    bindSpecializedCard(
      row,
      note,
      row.querySelector(
        '.link-archive-open'
      )
    );
    row
      .querySelector('.link-archive-go')
      ?.addEventListener(
        'click',
        event => event.stopPropagation()
      );
    noteGrid.appendChild(row);
  });
}

function renderCollectionAlbum(notes) {
  renderTemplateAlbumPagination(
    'collection',
    notes
  ).forEach(note => {
    const data =
      ensureCollectionData(note);
    const card =
      document.createElement('article');
    card.className =
      specializedCardClass(
        'collection-album-card',
        note
      );
    card.innerHTML = `
      ${
        archiveSelectionMode
          ? archiveSelectionButton(note.id)
          : ''
      }
      <button class="collection-album-open" type="button">
        <span class="collection-album-cover">
          ${
            data.cover
              ? `<img src="${escapeHtml(data.cover)}" alt="">`
              : `<span>${escapeHtml(data.type || 'COLLECTION')}</span>`
          }
        </span>
        <span class="collection-album-copy">
          <strong>${escapeHtml(note.title || '제목 없음')}</strong>
          <span class="collection-album-tags">
            ${
              data.tags.length
                ? data.tags.slice(0, 3)
                  .map(tag => `<small>#${escapeHtml(tag)}</small>`)
                  .join('')
                : '<small>#태그없음</small>'
            }
          </span>
        </span>
      </button>
    `;
    bindSpecializedCard(
      card,
      note,
      card.querySelector(
        '.collection-album-open'
      )
    );
    noteGrid.appendChild(card);
  });
}

['linkUrlInput', 'linkSiteNameInput', 'linkDescriptionInput', 'linkCategoryInput'].forEach(id => {
  const map = {
    linkUrlInput: 'url', linkSiteNameInput: 'siteName', linkDescriptionInput: 'description', linkCategoryInput: 'category'
  };
  $(`#${id}`).addEventListener('input', event => updateLinkField(map[id], event.target.value.trimStart()));
});

document.querySelectorAll('[data-collection-type]').forEach(button => {
  button.addEventListener('click', () => {
    const note = getCurrentNote();
    if (!note) return;
    ensureCollectionData(note).type = button.dataset.collectionType;
    renderCollectionEditor();
    scheduleTemplateDataSave();
  });
});

$('#collectionOneLineInput').addEventListener('input', event => { ensureCollectionData(getCurrentNote()).oneLine = event.target.value; scheduleTemplateDataSave(); });
$('#collectionTagsInput').addEventListener('input', event => { ensureCollectionData(getCurrentNote()).tags = event.target.value.split(',').map(tag => tag.trim()).filter(Boolean); scheduleTemplateDataSave(); });
$('#collectionContentInput').addEventListener('input', event => { ensureCollectionData(getCurrentNote()).content = event.target.value; scheduleTemplateDataSave(); });
$('#collectionAddField').addEventListener('click', addCollectionField);
async function setCollectionCover(
  file
) {
  const note = getCurrentNote();
  if (!file || !note) return;
  ensureCollectionData(note).cover =
    await compressMoodboardImage(
      file,
      1000,
      .74
    );
  if (getCurrentNote()?.id === note.id) {
    renderCollectionEditor();
  }
  scheduleTemplateDataSave(note);
}

$('#collectionCoverInput').addEventListener('change', async event => {
  await setCollectionCover(
    event.target.files?.[0]
  );
  event.target.value = '';
});

bindImageDropTarget(
  $('#collectionCoverDropZone'),
  files => setCollectionCover(files[0]),
  {
    onError: message =>
      alert(message)
  }
);

document.addEventListener('paste', event => {
  if (
    !collectionEditorPanel.hidden
    && !event.defaultPrevented
  ) {
    const images =
      clipboardImageFiles(
        event.clipboardData
      );

    if (!images.length) return;

    event.preventDefault();
    setCollectionCover(images[0]);
  }
});

$('#editorTemplateSearch').addEventListener('input', () => renderTemplateLibraryBar(getCurrentNote()?.template || 'memo'));
$('#editorTemplateFilter').addEventListener('change', () => renderTemplateLibraryBar(getCurrentNote()?.template || 'memo'));
