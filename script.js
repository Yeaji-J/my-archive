(() => {
  'use strict';

  const STORAGE_KEY = 'archive.data.v1';
  const SUPABASE_URL = 'https://qkujxjidngqwvibkqbre.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_v7DldiFXJPfbb0J95PKW_Q_Pmf0YR-a';
  const cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    scheduleCloudSave();
  }

  let currentUser = null;
  let cloudSaveTimer = null;
  let pullingCloudData = false;

  function setSyncStatus(message, type = ''){
    const el = document.querySelector('#syncStatus');
    if(!el) return;
    el.textContent = message;
    el.className = 'sync-status' + (type ? ` ${type}` : '');
  }

  function scheduleCloudSave(){
    if(!currentUser || pullingCloudData) return;
    clearTimeout(cloudSaveTimer);
    setSyncStatus('저장 중…', 'syncing');
    cloudSaveTimer = setTimeout(pushCloudData, 450);
  }

  async function pushCloudData(){
    if(!currentUser) return;
    const { error } = await cloud.from('archive_data').upsert({
      user_id: currentUser.id,
      data: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if(error){
      console.error('Cloud save failed', error);
      setSyncStatus('동기화 실패', 'error');
      return;
    }
    setSyncStatus('모든 기기에 저장됨');
  }

  async function pullCloudData(){
    if(!currentUser) return;
    setSyncStatus('동기화 중…', 'syncing');
    const { data, error } = await cloud
      .from('archive_data')
      .select('data')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if(error){
      console.error('Cloud load failed', error);
      setSyncStatus('DB 설정 필요', 'error');
      return;
    }
    if(data?.data){
      pullingCloudData = true;
      state = data.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      pullingCloudData = false;
      closeEditor(false);
      render();
      setSyncStatus('모든 기기와 동기화됨');
    } else {
      await pushCloudData();
    }
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
  let chatRooms = [];
  let activeRoomId = null;
  let currentProfile = null;
  let messageSubscription = null;
  const renderedMessageIds = new Set();

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
  const chatView = $('#chatView');
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
  const authBtn = $('#authBtn');
  const authModal = $('#authModal');
  const authForm = $('#authForm');
  const authEmail = $('#authEmail');
  const authPassword = $('#authPassword');
  const authMessage = $('#authMessage');
  const authSubmitBtn = $('#authSubmitBtn');
  const authSwitchBtn = $('#authSwitchBtn');
  const countChats = $('#countChats');
  const chatRoomList = $('#chatRoomList');
  const chatLoginState = $('#chatLoginState');
  const chatProfileLabel = $('#chatProfileLabel');
  const chatConversation = $('#chatConversation');
  const chatEmptyConversation = $('#chatEmptyConversation');
  const chatActive = $('#chatActive');
  const chatMessages = $('#chatMessages');
  const chatInput = $('#chatInput');
  const newChatModal = $('#newChatModal');
  const profileModal = $('#profileModal');
  const userSearchInput = $('#userSearchInput');
  const userSearchResults = $('#userSearchResults');
  let authMode = 'signin';

  /* ---------------- Rendering ---------------- */
  function render(){
    renderSidebarFolders();
    renderCounts();
    if(currentView === 'chat'){
      folderGridView.hidden = true;
      editorView.hidden = true;
      chatView.hidden = false;
      breadcrumb.textContent = '채팅';
      renderChatRooms();
      return;
    }
    chatView.hidden = true;
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
    if(view === 'chat'){
      folderGridView.hidden = true;
      chatView.hidden = false;
      breadcrumb.textContent = '채팅';
      renderChatRooms();
      if(currentUser) loadChatRooms();
    } else {
      chatView.hidden = true;
      folderGridView.hidden = false;
      renderFolderGridView();
    }
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
    if(currentView === 'chat') setView('all');
    const folderId = (!['all','starred','chat'].includes(currentView)) ? currentView : (state.folders[0]?.id || '');
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

  /* ---------------- Account & cloud sync ---------------- */
  function openAuthModal(){
    if(currentUser){
      if(confirm(`${currentUser.email} 계정에서 로그아웃할까요?`)) cloud.auth.signOut();
      return;
    }
    authMessage.textContent = '';
    authModal.hidden = false;
    scrim.classList.add('visible');
    setTimeout(() => authEmail.focus(), 50);
  }

  function closeAuthModal(){
    authModal.hidden = true;
    scrim.classList.remove('visible');
  }

  function updateAuthMode(){
    const signup = authMode === 'signup';
    $('#authTitle').textContent = signup ? 'Archive 계정 만들기' : 'Archive에 로그인';
    $('#authDesc').textContent = signup ? '한 번 가입하면 모든 기기에서 자료가 연결돼요.' : '어떤 브라우저에서도 같은 자료를 확인하세요.';
    authSubmitBtn.textContent = signup ? '계정 만들기' : '로그인';
    authSwitchBtn.textContent = signup ? '이미 계정이 있나요? 로그인' : '처음이신가요? 계정 만들기';
    authPassword.autocomplete = signup ? 'new-password' : 'current-password';
    authMessage.textContent = '';
  }

  async function submitAuth(e){
    e.preventDefault();
    authSubmitBtn.disabled = true;
    authMessage.classList.remove('success');
    authMessage.textContent = '';
    const credentials = { email: authEmail.value.trim(), password: authPassword.value };
    const result = authMode === 'signup'
      ? await cloud.auth.signUp({ ...credentials, options:{ emailRedirectTo: location.href.split('#')[0] } })
      : await cloud.auth.signInWithPassword(credentials);
    authSubmitBtn.disabled = false;
    if(result.error){
      authMessage.textContent = result.error.message;
      return;
    }
    if(authMode === 'signup' && !result.data.session){
      authMessage.classList.add('success');
      authMessage.textContent = '인증 메일을 보냈어요. 메일의 링크를 눌러 가입을 완료해주세요.';
      return;
    }
    closeAuthModal();
  }

  async function applySession(session){
    const nextUser = session?.user || null;
    const changed = nextUser?.id !== currentUser?.id;
    currentUser = nextUser;
    authBtn.textContent = currentUser ? currentUser.email : '로그인';
    authBtn.title = currentUser ? '클릭하여 로그아웃' : '로그인';
    if(currentUser && changed){
      await pullCloudData();
      await ensureChatProfile();
      await loadChatRooms();
    }
    if(!currentUser){
      setSyncStatus('이 브라우저에 저장됨');
      currentProfile = null;
      chatRooms = [];
      activeRoomId = null;
      closeMessageSubscription();
      chatActive.hidden = true;
      chatEmptyConversation.hidden = false;
      chatConversation.parentElement.classList.remove('mobile-conversation');
      renderChatRooms();
    }
  }

  async function initCloud(){
    const { data } = await cloud.auth.getSession();
    await applySession(data.session);
    cloud.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applySession(session), 0);
    });
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

  /* ---------------- 1:1 Chat ---------------- */
  function initials(name){
    return String(name || '?').trim().slice(0, 1).toUpperCase();
  }

  function avatarGradient(id){
    const palettes = [
      ['#5ac8fa','#0071e3'],['#ff9f0a','#ff6b35'],['#af52de','#7052c8'],
      ['#34c759','#0a9f48'],['#ff375f','#d91e52'],['#64d2ff','#5e5ce6']
    ];
    const hash = [...String(id)].reduce((n,c) => n + c.charCodeAt(0), 0);
    const [a,b] = palettes[hash % palettes.length];
    return `linear-gradient(145deg,${a},${b})`;
  }

  function avatarHtml(profile){
    return `<span class="chat-avatar" style="background:${avatarGradient(profile.id)}">${escapeHtml(initials(profile.display_name))}</span>`;
  }

  async function ensureChatProfile(){
    if(!currentUser) return;
    const { data, error } = await cloud.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
    if(error){
      console.error('Profile load failed', error);
      return;
    }
    currentProfile = data || null;
    if(!currentProfile){
      const base = (currentUser.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,14) || 'user';
      $('#profileNameInput').value = currentUser.email?.split('@')[0] || '';
      $('#profileUsernameInput').value = `${base}_${currentUser.id.slice(0,4)}`.slice(0,20);
      profileModal.hidden = false;
      scrim.classList.add('visible');
    }
    renderChatRooms();
  }

  async function saveChatProfile(e){
    e.preventDefault();
    const displayName = $('#profileNameInput').value.trim();
    const username = $('#profileUsernameInput').value.trim().toLowerCase();
    const message = $('#profileMessage');
    message.textContent = '';
    if(!/^[a-z0-9_]{3,20}$/.test(username)){
      message.textContent = '사용자 이름은 영문 소문자, 숫자, 밑줄로 3~20자 입력해주세요.';
      return;
    }
    const { data, error } = await cloud.from('profiles').upsert({
      id:currentUser.id, username, display_name:displayName
    }).select().single();
    if(error){
      message.textContent = error.code === '23505' ? '이미 사용 중인 사용자 이름이에요.' : error.message;
      return;
    }
    currentProfile = data;
    profileModal.hidden = true;
    scrim.classList.remove('visible');
    renderChatRooms();
  }

  async function loadChatRooms(){
    if(!currentUser) return;
    const { data: memberships, error } = await cloud.from('chat_members').select('room_id').eq('user_id',currentUser.id);
    if(error){ console.error('Chat list failed',error); return; }
    const rooms = await Promise.all((memberships || []).map(async ({room_id}) => {
      const [{ data: members },{ data: latest }] = await Promise.all([
        cloud.from('chat_members').select('user_id').eq('room_id',room_id).neq('user_id',currentUser.id),
        cloud.from('messages').select('body,created_at').eq('room_id',room_id).order('created_at',{ascending:false}).limit(1)
      ]);
      const otherId = members?.[0]?.user_id;
      if(!otherId) return null;
      const { data: profile } = await cloud.from('profiles').select('*').eq('id',otherId).maybeSingle();
      if(!profile) return null;
      return { id:room_id, profile, latest:latest?.[0] || null };
    }));
    chatRooms = rooms.filter(Boolean).sort((a,b) => new Date(b.latest?.created_at || 0)-new Date(a.latest?.created_at || 0));
    renderChatRooms();
  }

  function renderChatRooms(){
    countChats.textContent = chatRooms.length;
    const loggedIn = !!currentUser;
    chatLoginState.hidden = loggedIn;
    chatRoomList.style.display = loggedIn ? 'block' : 'none';
    $('#newChatBtn').disabled = !loggedIn;
    chatProfileLabel.textContent = currentProfile ? `${currentProfile.display_name} · @${currentProfile.username}` : (loggedIn ? '프로필을 설정해주세요' : '로그인 후 이용할 수 있어요');
    chatRoomList.innerHTML = '';
    if(loggedIn && !chatRooms.length){
      chatRoomList.innerHTML = '<p class="search-guide">아직 채팅방이 없어요.<br>새 채팅을 시작해보세요.</p>';
      return;
    }
    chatRooms.forEach(room => {
      const button = document.createElement('button');
      button.className = 'chat-room-item' + (room.id === activeRoomId ? ' active' : '');
      button.innerHTML = `${avatarHtml(room.profile)}<span class="chat-room-copy"><span class="chat-room-top"><strong>${escapeHtml(room.profile.display_name)}</strong><span class="chat-room-time">${room.latest ? chatListTime(room.latest.created_at) : ''}</span></span><span class="chat-room-preview">${escapeHtml(room.latest?.body || '새로운 대화를 시작해보세요.')}</span></span>`;
      button.addEventListener('click',() => openChatRoom(room.id));
      chatRoomList.appendChild(button);
    });
  }

  function chatListTime(value){
    const date = new Date(value), now = new Date();
    if(date.toDateString() === now.toDateString()) return date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    return date.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
  }

  function messageTime(value){
    return new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }

  async function openChatRoom(roomId){
    const room = chatRooms.find(r => r.id === roomId);
    if(!room) return;
    activeRoomId = roomId;
    renderedMessageIds.clear();
    renderChatRooms();
    chatEmptyConversation.hidden = true;
    chatActive.hidden = false;
    $('#chatHeaderName').textContent = room.profile.display_name;
    $('#chatHeaderUsername').textContent = `@${room.profile.username}`;
    $('#chatHeaderAvatar').textContent = initials(room.profile.display_name);
    $('#chatHeaderAvatar').style.background = avatarGradient(room.profile.id);
    chatConversation.parentElement.classList.add('mobile-conversation');
    chatMessages.innerHTML = '<p class="search-guide">대화를 불러오는 중…</p>';
    const { data, error } = await cloud.from('messages').select('*').eq('room_id',roomId).order('created_at',{ascending:true}).limit(500);
    if(error){ chatMessages.innerHTML = '<p class="search-guide">메시지를 불러오지 못했어요.</p>'; return; }
    chatMessages.innerHTML = '';
    (data || []).forEach(appendMessage);
    scrollChatToBottom();
    subscribeToMessages(roomId);
  }

  function appendMessage(message){
    if(renderedMessageIds.has(String(message.id))) return;
    renderedMessageIds.add(String(message.id));
    const row = document.createElement('div');
    row.className = 'message-row' + (message.user_id === currentUser?.id ? ' mine' : '');
    row.innerHTML = `<div class="message-bubble">${escapeHtml(message.body)}</div><time class="message-time">${messageTime(message.created_at)}</time>`;
    chatMessages.appendChild(row);
  }

  function scrollChatToBottom(){
    requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; });
  }

  function closeMessageSubscription(){
    if(messageSubscription){ cloud.removeChannel(messageSubscription); messageSubscription = null; }
  }

  function subscribeToMessages(roomId){
    closeMessageSubscription();
    messageSubscription = cloud.channel(`room:${roomId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`room_id=eq.${roomId}`},payload => {
        if(activeRoomId !== roomId) return;
        appendMessage(payload.new);
        scrollChatToBottom();
        loadChatRooms();
      }).subscribe();
  }

  async function sendChatMessage(e){
    e.preventDefault();
    const body = chatInput.value.trim();
    if(!body || !activeRoomId || !currentUser) return;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    const { data, error } = await cloud.from('messages').insert({room_id:activeRoomId,user_id:currentUser.id,body}).select().single();
    if(error){ alert('메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.'); chatInput.value = body; return; }
    appendMessage(data);
    scrollChatToBottom();
    loadChatRooms();
  }

  function openNewChat(){
    if(!currentUser){ openAuthModal(); return; }
    if(!currentProfile){ ensureChatProfile(); return; }
    userSearchInput.value = '';
    userSearchResults.innerHTML = '<p class="search-guide">두 글자 이상 입력해주세요.</p>';
    newChatModal.hidden = false;
    scrim.classList.add('visible');
    setTimeout(() => userSearchInput.focus(),50);
  }

  function closeNewChat(){
    newChatModal.hidden = true;
    scrim.classList.remove('visible');
  }

  let searchUserTimer = null;
  function searchChatUsers(){
    clearTimeout(searchUserTimer);
    searchUserTimer = setTimeout(async () => {
      const term = userSearchInput.value.trim().replace(/[%_,()]/g,'');
      if(term.length < 2){ userSearchResults.innerHTML = '<p class="search-guide">두 글자 이상 입력해주세요.</p>'; return; }
      userSearchResults.innerHTML = '<p class="search-guide">검색 중…</p>';
      const { data, error } = await cloud.from('profiles').select('*').neq('id',currentUser.id).or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(20);
      if(error || !data?.length){ userSearchResults.innerHTML = '<p class="search-guide">검색 결과가 없어요.</p>'; return; }
      userSearchResults.innerHTML = '';
      data.forEach(profile => {
        const button = document.createElement('button');
        button.className = 'user-result';
        button.innerHTML = `${avatarHtml(profile)}<span><strong>${escapeHtml(profile.display_name)}</strong><span>@${escapeHtml(profile.username)}</span></span>`;
        button.addEventListener('click',() => createDirectChat(profile.id));
        userSearchResults.appendChild(button);
      });
    },300);
  }

  async function createDirectChat(otherUserId){
    const { data, error } = await cloud.rpc('create_direct_chat',{other_user:otherUserId});
    if(error){ alert('채팅방을 만들지 못했어요.'); return; }
    closeNewChat();
    await loadChatRooms();
    openChatRoom(data);
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
  scrim.addEventListener('click', () => {
    if(!authModal.hidden) closeAuthModal();
    if(!folderModal.hidden) closeFolderModal();
    if(!newChatModal.hidden) closeNewChat();
  });

  authBtn.addEventListener('click', openAuthModal);
  $('#authCloseBtn').addEventListener('click', closeAuthModal);
  authForm.addEventListener('submit', submitAuth);
  authSwitchBtn.addEventListener('click', () => {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    updateAuthMode();
  });

  $('#chatLoginBtn').addEventListener('click',openAuthModal);
  $('#newChatBtn').addEventListener('click',openNewChat);
  $('#newChatCloseBtn').addEventListener('click',closeNewChat);
  userSearchInput.addEventListener('input',searchChatUsers);
  $('#profileForm').addEventListener('submit',saveChatProfile);
  $('#chatForm').addEventListener('submit',sendChatMessage);
  $('#chatMobileBack').addEventListener('click',() => chatConversation.parentElement.classList.remove('mobile-conversation'));
  chatInput.addEventListener('input',() => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight,100)}px`;
  });
  chatInput.addEventListener('keydown',e => {
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('#chatForm').requestSubmit(); }
  });

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
      else if(!authModal.hidden) closeAuthModal();
      else if(!newChatModal.hidden) closeNewChat();
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

  window.addEventListener('focus', () => {
    if(currentUser && editorView.hidden) pullCloudData();
  });

  /* ---------------- Init ---------------- */
  render();
  initCloud();
})();
