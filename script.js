(() => {
  'use strict';

  const STORAGE_KEY = 'archive.data.v1';
  const FOLDER_COLORS = ['#5ac8fa','#0071e3','#34c759','#ff9f0a','#ff375f','#af52de','#8e8e93','#ff3b30'];

  /* ---------------- Data layer ---------------- */
  function loadData(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){ console.warn('Could not read storage', e); }
    return seedData();
  }

  function seedData(){
    const now = Date.now();
    const f1 = uid(), f2 = uid();
    return {
      folders: [
        { id: f1, name: '레퍼런스', color: '#0071e3' },
        { id: f2, name: '아이디어', color: '#ff9f0a' }
      ],
      notes: [
        {
          id: uid(), title: '환영합니다 👋', folderId: f1, starred: true,
          content: 'Archive는 자료와 정보를 폴더로 정리하는 개인용 공간이에요.\n\n왼쪽에서 새 폴더를 만들고, 오른쪽 위 "+ 새 자료" 버튼으로 기록을 남겨보세요. 모든 내용은 이 브라우저에 안전하게 저장됩니다.',
          createdAt: now, updatedAt: now
        },
        {
          id: uid(), title: '아이디어 메모', folderId: f2, starred: false,
          content: '떠오르는 생각을 가볍게 적어두는 공간.',
          createdAt: now, updatedAt: now
        }
      ]
    };
  }

  function saveData(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(){
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  let state = loadData();

  /* ---------------- App state ---------------- */
  let currentView = 'all';       // 'all' | 'starred' | folderId
  let currentNoteId = null;      // when editor open
  let searchTerm = '';
  let gridMode = true;           // true = grid, false = list
  let pendingFolderColor = FOLDER_COLORS[0];

  /* ---------------- DOM refs ---------------- */
  const $ = sel => document.querySelector(sel);
  const sidebar = $('#sidebar');
  const folderList = $('#folderList');
  const folderGrid = $('#folderGrid');
  const noteGrid = $('#noteGrid');
  const emptyState = $('#emptyState');
  const notesDividerWrap = $('#notesDividerWrap');
  const breadcrumb = $('#breadcrumb');
  const searchInput = $('#searchInput');
  const countAll = $('#countAll');
  const countStarred = $('#countStarred');
  const folderGridView = $('#folderGridView');
  const editorView = $('#editorView');
  const noteTitle = $('#noteTitle');
  const noteContent = $('#noteContent');
  const noteMeta = $('#noteMeta');
  const folderSelect = $('#folderSelect');
  const starBtn = $('#starBtn');
  const scrim = $('#scrim');
  const folderModal = $('#folderModal');
  const folderNameInput = $('#folderNameInput');
  const colorSwatches = $('#colorSwatches');
  const viewToggleBtn = $('#viewToggleBtn');

  /* ---------------- Rendering ---------------- */
  function render(){
    renderSidebarFolders();
    renderCounts();
    if(!editorView.hidden){
      // editor already showing; nothing else to do
    } else {
      renderFolderGridView();
    }
  }

  function renderCounts(){
    countAll.textContent = state.notes.length;
    countStarred.textContent = state.notes.filter(n => n.starred).length;
  }

  function renderSidebarFolders(){
    folderList.innerHTML = '';
    state.folders.forEach(folder => {
      const count = state.notes.filter(n => n.folderId === folder.id).length;
      const li = document.createElement('li');
      li.className = 'folder-item' + (currentView === folder.id ? ' active' : '');
      li.innerHTML = `
        <span class="folder-dot" style="background:${folder.color}"></span>
        <span class="folder-item-name">${escapeHtml(folder.name)}</span>
        <span class="folder-item-count">${count}</span>
        <button class="folder-del" aria-label="폴더 삭제" title="폴더 삭제">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-width="2"/></svg>
        </button>
      `;
      li.addEventListener('click', (e) => {
        if(e.target.closest('.folder-del')) return;
        setView(folder.id);
      });
      li.querySelector('.folder-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(folder.id);
      });
      folderList.appendChild(li);
    });
  }

  function setView(view){
    currentView = view;
    closeEditor(false);
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    renderSidebarFolders();
    renderFolderGridView();
    closeSidebarMobile();
  }

  function currentBreadcrumb(){
    if(currentView === 'all') return '전체 자료';
    if(currentView === 'starred') return '즐겨찾기';
    const f = state.folders.find(f => f.id === currentView);
    return f ? f.name : '전체 자료';
  }

  function getFilteredNotes(){
    let notes = state.notes.slice();
    if(currentView === 'starred') notes = notes.filter(n => n.starred);
    else if(currentView !== 'all') notes = notes.filter(n => n.folderId === currentView);

    if(searchTerm.trim()){
      const t = searchTerm.trim().toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(t) || n.content.toLowerCase().includes(t)
      );
    }
    return notes.sort((a,b) => b.updatedAt - a.updatedAt);
  }

  function renderFolderGridView(){
    breadcrumb.textContent = currentBreadcrumb();

    // Folder cards only shown on the "all" home view with no active search
    const showFolders = currentView === 'all' && !searchTerm.trim();
    folderGrid.style.display = showFolders && state.folders.length ? 'grid' : 'none';
    notesDividerWrap.style.display = showFolders && state.folders.length ? 'flex' : 'none';

    folderGrid.innerHTML = '';
    if(showFolders){
      state.folders.forEach(folder => {
        const count = state.notes.filter(n => n.folderId === folder.id).length;
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.style.setProperty('--folder-color', folder.color);
        card.innerHTML = `
          <button class="folder-card-del" aria-label="폴더 삭제" title="폴더 삭제">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-width="2"/></svg>
          </button>
          <div class="folder-icon"></div>
          <div class="folder-card-name">${escapeHtml(folder.name)}</div>
          <div class="folder-card-count">${count}개 자료</div>
        `;
        card.addEventListener('click', (e) => {
          if(e.target.closest('.folder-card-del')) return;
          setView(folder.id);
        });
        card.querySelector('.folder-card-del').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteFolder(folder.id);
        });
        folderGrid.appendChild(card);
      });
    }

    // Notes
    const notes = getFilteredNotes();
    noteGrid.classList.toggle('list-mode', !gridMode);
    noteGrid.innerHTML = '';
    emptyState.hidden = notes.length !== 0;

    notes.forEach(note => {
      const folder = state.folders.find(f => f.id === note.folderId);
      const card = document.createElement('div');
      card.className = 'note-card';
      card.innerHTML = `
        <div class="note-card-top">
          <div class="note-card-title">${escapeHtml(note.title || '제목 없음')}</div>
          ${note.starred ? `<span class="note-card-star"><svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.6l1.4-6.6-5-4.6 6.6-.7z"/></svg></span>` : ''}
        </div>
        <div class="note-card-snippet">${escapeHtml(note.content || '') || '<span style=\'opacity:.5\'>내용 없음</span>'}</div>
        <div class="note-card-bottom">
          ${folder ? `<span class="note-card-folder-dot" style="background:${folder.color}"></span><span class="note-card-date">${folder.name} · ${formatDate(note.updatedAt)}</span>` : `<span class="note-card-date">${formatDate(note.updatedAt)}</span>`}
        </div>
      `;
      card.addEventListener('click', () => openEditor(note.id));
      noteGrid.appendChild(card);
    });
  }

  function formatDate(ts){
    const d = new Date(ts);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString('ko-KR', {
      year: sameYear ? undefined : 'numeric',
      month: 'long', day: 'numeric'
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, m => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[m]));
  }

  /* ---------------- Editor ---------------- */
  function openEditor(noteId){
    currentNoteId = noteId;
    const note = state.notes.find(n => n.id === noteId);
    if(!note) return;

    noteTitle.value = note.title;
    noteContent.value = note.content;
    updateEditorMeta(note);
    populateFolderSelect(note.folderId);
    starBtn.classList.toggle('active', !!note.starred);

    folderGridView.hidden = true;
    editorView.hidden = false;
    noteTitle.focus();
  }

  function updateEditorMeta(note){
    noteMeta.textContent = `마지막 수정: ${formatDate(note.updatedAt)}`;
  }

  function populateFolderSelect(selectedId){
    folderSelect.innerHTML = `<option value="">폴더 없음</option>` +
      state.folders.map(f => `<option value="${f.id}" ${f.id===selectedId?'selected':''}>${escapeHtml(f.name)}</option>`).join('');
  }

  function closeEditor(rerender = true){
    if(currentNoteId){
      persistCurrentNote();
    }
    currentNoteId = null;
    editorView.hidden = true;
    folderGridView.hidden = false;
    if(rerender) renderFolderGridView();
    renderSidebarFolders();
    renderCounts();
  }

  function persistCurrentNote(){
    const note = state.notes.find(n => n.id === currentNoteId);
    if(!note) return;
    const changed = note.title !== noteTitle.value || note.content !== noteContent.value;
    note.title = noteTitle.value;
    note.content = noteContent.value;
    if(changed){
      note.updatedAt = Date.now();
      updateEditorMeta(note);
    }
    saveData();
  }

  function createNote(){
    const folderId = (currentView !== 'all' && currentView !== 'starred') ? currentView : (state.folders[0]?.id || '');
    const note = {
      id: uid(), title: '', content: '',
      folderId: folderId || '',
      starred: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    state.notes.unshift(note);
    saveData();
    render();
    openEditor(note.id);
  }

  function deleteCurrentNote(){
    if(!currentNoteId) return;
    state.notes = state.notes.filter(n => n.id !== currentNoteId);
    saveData();
    currentNoteId = null;
    editorView.hidden = true;
    folderGridView.hidden = false;
    render();
  }

  /* ---------------- Folders ---------------- */
  function deleteFolder(folderId){
    const folder = state.folders.find(f => f.id === folderId);
    if(!folder) return;
    const count = state.notes.filter(n => n.folderId === folderId).length;
    const msg = count > 0
      ? `"${folder.name}" 폴더를 삭제할까요? 안의 자료 ${count}개는 "폴더 없음"으로 이동합니다.`
      : `"${folder.name}" 폴더를 삭제할까요?`;
    if(!confirm(msg)) return;

    state.folders = state.folders.filter(f => f.id !== folderId);
    state.notes.forEach(n => { if(n.folderId === folderId) n.folderId = ''; });
    if(currentView === folderId) currentView = 'all';
    saveData();
    render();
  }

  function openFolderModal(){
    folderNameInput.value = '';
    pendingFolderColor = FOLDER_COLORS[0];
    colorSwatches.innerHTML = FOLDER_COLORS.map((c,i) => `
      <div class="color-swatch ${i===0?'selected':''}" data-color="${c}" style="background:${c}"></div>
    `).join('');
    colorSwatches.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        colorSwatches.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        pendingFolderColor = sw.dataset.color;
      });
    });
    folderModal.hidden = false;
    scrim.classList.add('visible');
    setTimeout(() => folderNameInput.focus(), 50);
  }

  function closeFolderModal(){
    folderModal.hidden = true;
    scrim.classList.remove('visible');
  }

  function createFolder(){
    const name = folderNameInput.value.trim();
    if(!name) { folderNameInput.focus(); return; }
    const folder = { id: uid(), name, color: pendingFolderColor };
    state.folders.push(folder);
    saveData();
    closeFolderModal();
    render();
    setView(folder.id);
  }

  /* ---------------- Sidebar mobile ---------------- */
  function closeSidebarMobile(){
    sidebar.classList.remove('mobile-open');
  }

  /* ---------------- Event wiring ---------------- */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  $('#collapseBtn').addEventListener('click', () => sidebar.classList.toggle('collapsed'));
  $('#sidebarToggleMobile').addEventListener('click', () => sidebar.classList.toggle('mobile-open'));

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderFolderGridView();
  });

  $('#addFolderBtn').addEventListener('click', openFolderModal);
  $('#folderCancelBtn').addEventListener('click', closeFolderModal);
  $('#folderCreateBtn').addEventListener('click', createFolder);
  folderNameInput.addEventListener('keydown', e => { if(e.key === 'Enter') createFolder(); });
  scrim.addEventListener('click', closeFolderModal);

  $('#newNoteBtnSide').addEventListener('click', createNote);
  $('#newNoteBtnTop').addEventListener('click', createNote);
  $('#emptyAddBtn').addEventListener('click', createNote);

  $('#backBtn').addEventListener('click', () => closeEditor());
  $('#deleteBtn').addEventListener('click', () => {
    if(confirm('이 자료를 삭제할까요?')) deleteCurrentNote();
  });
  starBtn.addEventListener('click', () => {
    const note = state.notes.find(n => n.id === currentNoteId);
    if(!note) return;
    note.starred = !note.starred;
    starBtn.classList.toggle('active', note.starred);
    saveData();
  });
  folderSelect.addEventListener('change', () => {
    const note = state.notes.find(n => n.id === currentNoteId);
    if(!note) return;
    note.folderId = folderSelect.value;
    note.updatedAt = Date.now();
    saveData();
  });

  let autosaveTimer = null;
  [noteTitle, noteContent].forEach(el => {
    el.addEventListener('input', () => {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(persistCurrentNote, 400);
    });
  });

  viewToggleBtn.addEventListener('click', () => {
    gridMode = !gridMode;
    viewToggleBtn.classList.toggle('active-grid', !gridMode);
    renderFolderGridView();
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      if(!folderModal.hidden) closeFolderModal();
      else if(!editorView.hidden) closeEditor();
    }
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      searchInput.focus();
    }
  });

  window.addEventListener('beforeunload', () => {
    if(currentNoteId) persistCurrentNote();
  });

  /* ---------------- Init ---------------- */
  render();
})();