'use strict';

/* ---------------- Account ---------------- */

  function openProfileModal() {
    if (!currentUser) return;

    $('#profileModalTitle').textContent =
      currentProfile
        ? '프로필 수정'
        : '채팅 프로필 만들기';

    $('#profileModalDesc').textContent =
      currentProfile
        ? '친구에게 표시되는 프로필을 수정할 수 있어요.'
        : '친구가 알아볼 수 있는 이름을 정해주세요.';

    $('#profileNameInput').value =
      currentProfile?.display_name
      || currentUser.email
        ?.split('@')[0]
      || '';

    const baseUsername = (
      currentUser.email?.split('@')[0]
      || 'user'
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 14)
      || 'user';

    $('#profileUsernameInput').value =
      currentProfile?.username
      || (
        `${baseUsername}_${
          currentUser.id.slice(0, 4)
        }`
      ).slice(0, 20);

    $('#profileMessage').textContent = '';

    profileModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () =>
        $('#profileNameInput').focus(),
      50
    );
  }

  function closeProfileModal() {
    /*
     * 최초 프로필 생성 전에는
     * 설정창을 닫지 못하게 합니다.
     */
    if (!currentProfile) return;

    profileModal.hidden = true;
    scrim.classList.remove('visible');
  }

  function openAuthModal() {
    if (currentUser) {
      openProfileModal();
      return;
    }

    authMessage.textContent = '';

    authModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () => authEmail.focus(),
      50
    );
  }

  function closeAuthModal() {
    authModal.hidden = true;
    scrim.classList.remove('visible');
  }

  function updateAuthMode() {
    const signup =
      authMode === 'signup';

    $('#authTitle').textContent =
      signup
        ? 'Archive 계정 만들기'
        : 'Archive에 로그인';

    $('#authDesc').textContent =
      signup
        ? '한 번 가입하면 모든 기기에서 자료가 연결돼요.'
        : '어떤 브라우저에서도 같은 자료를 확인하세요.';

    authSubmitBtn.textContent =
      signup
        ? '계정 만들기'
        : '로그인';

    authSwitchBtn.textContent =
      signup
        ? '이미 계정이 있나요? 로그인'
        : '처음이신가요? 계정 만들기';

    authPassword.autocomplete =
      signup
        ? 'new-password'
        : 'current-password';

    authMessage.textContent = '';
  }

  async function submitAuth(event) {
    event.preventDefault();

    authSubmitBtn.disabled = true;

    authMessage.classList.remove(
      'success'
    );

    authMessage.textContent = '';

    const credentials = {
      email: authEmail.value.trim(),
      password: authPassword.value
    };

    const result =
      authMode === 'signup'
        ? await cloud.auth.signUp({
            ...credentials,
            options: {
              emailRedirectTo:
                location.href.split('#')[0]
            }
          })
        : await cloud.auth
            .signInWithPassword(
              credentials
            );

    authSubmitBtn.disabled = false;

    if (result.error) {
      authMessage.textContent =
        result.error.message;

      return;
    }

    if (
      authMode === 'signup'
      && !result.data.session
    ) {
      authMessage.classList.add(
        'success'
      );

      authMessage.textContent =
        '인증 메일을 보냈어요. 메일의 링크를 눌러 가입을 완료해주세요.';

      return;
    }

    closeAuthModal();
  }

  async function applySession(session) {
    const nextUser =
      session?.user || null;

    const changed =
      nextUser?.id
      !== currentUser?.id;

    currentUser = nextUser;

    authBtn.title =
      currentUser
        ? '프로필 수정'
        : '로그인';

    if (
      currentUser
      && changed
    ) {
      await pullCloudData();
      await ensureChatProfile();
      await loadChatRooms();
      await loadCalendarEntries();
    }

    if (!currentUser) {
      setSyncStatus(
        '이 브라우저에 저장됨'
      );

      currentProfile = null;
      chatRooms = [];
      activeRoomId = null;

      closeMessageSubscription();

      chatActive.hidden = true;

      chatEmptyConversation.hidden =
        false;

      chatConversation
        .parentElement
        .classList.remove(
          'mobile-conversation'
        );

      renderChatRooms();

      calendarEntries.clear();
      renderCalendar();
    }

    renderAccountButton();
  }

  async function initCloud() {
    const { data } =
      await cloud.auth.getSession();

    await applySession(data.session);

    cloud.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(
          () => applySession(session),
          0
        );
      }
    );
  }

  function createFolder() {
    const name =
      folderNameInput.value.trim();

    if (!name) {
      folderNameInput.focus();
      return;
    }

    const folder = {
      id: uid(),
      name,
      color: pendingFolderColor
    };

    state.folders.push(folder);

    saveData();
    closeFolderModal();
    render();
    setView(folder.id);
  }
