'use strict';

/* ---------------- Links / Collection / Template search ---------------- */

let templateDataSaveTimer = null;

function scheduleTemplateDataSave() {
  clearTimeout(templateDataSaveTimer);
  templateDataSaveTimer = setTimeout(() => {
    const note = getCurrentNote();
    if (!note) return;
    note.updatedAt = Date.now();
    updateEditorMeta(note);
    saveData();
    renderTemplateLibraryBar(note.template || 'memo');
  }, 350);
}

function ensureLinkData(note) {
  if (!note.linkData) {
    note.linkData = { url: '', siteName: '', description: '', memo: '', category: '' };
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
  $('#linkMemoInput').value = data.memo || '';
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
    parts.push(data.url, data.siteName, data.description, data.memo, data.category);
  }
  if (note.template === 'collection') {
    const data = ensureCollectionData(note);
    parts.push(data.type, data.oneLine, data.content, data.tags.join(' '));
    data.fields.forEach(field => parts.push(field.label, field.value));
  }
  if (note.template === 'moodboard') {
    ensureMoodboard(note).items.filter(item => item.type === 'text').forEach(item => parts.push(item.text));
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function templateFilterValue(note, template) {
  if (template === 'links') return ensureLinkData(note).category || '미분류';
  if (template === 'collection') return ensureCollectionData(note).type || '기타';
  if (template === 'memo') return state.folders.find(folder => folder.id === note.folderId)?.name || '폴더 없음';
  return '전체';
}

function renderTemplateLibraryBar(template) {
  const search = $('#editorTemplateSearch');
  const filter = $('#editorTemplateFilter');
  const wrap = $('#editorLibraryResults');
  const notes = state.notes.filter(note => (note.template || 'memo') === template);
  const filterValues = [...new Set(notes.map(note => templateFilterValue(note, template)))].filter(value => value !== '전체');
  const previousFilter = filter.dataset.template === template ? filter.value : 'all';

  filter.dataset.template = template;
  filter.innerHTML = '<option value="all">전체</option>' + filterValues.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  filter.value = filterValues.includes(previousFilter) ? previousFilter : 'all';

  const query = search.value.trim().toLowerCase();
  const filtered = notes.filter(note => {
    const matchesQuery = !query || templateSearchText(note).includes(query);
    const matchesFilter = filter.value === 'all' || templateFilterValue(note, template) === filter.value;
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

['linkUrlInput', 'linkSiteNameInput', 'linkDescriptionInput', 'linkMemoInput', 'linkCategoryInput'].forEach(id => {
  const map = {
    linkUrlInput: 'url', linkSiteNameInput: 'siteName', linkDescriptionInput: 'description', linkMemoInput: 'memo', linkCategoryInput: 'category'
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
  ensureCollectionData(note).cover = await compressMoodboardImage(file);
  renderCollectionEditor();
  scheduleTemplateDataSave();
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
