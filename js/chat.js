'use strict';

/* ---------------- 1:1 Chat ---------------- */

const CHAT_IMAGE_PREFIX = '__ARCHIVE_IMAGE__:';
const CHAT_MEDIA_PREFIX = '__ARCHIVE_MEDIA__:';
let pendingChatImage = '';

function parseChatMedia(body) {
  const value = String(body || '');

  if (value.startsWith(CHAT_MEDIA_PREFIX)) {
    try {
      const data = JSON.parse(
        value.slice(CHAT_MEDIA_PREFIX.length)
      );

      if (
        typeof data.image === 'string'
        && data.image.startsWith('data:image/')
      ) {
        return {
          image: data.image,
          path: '',
          text: String(data.text || '')
        };
      }
    } catch (error) {
      console.error(
        'Chat media parse failed',
        error
      );
    }
  }

  const path = chatImagePath(value);
  return path
    ? { image: '', path, text: '' }
    : null;
}

function chatImagePath(body) {
  return String(body || '').startsWith(CHAT_IMAGE_PREFIX)
    ? String(body).slice(CHAT_IMAGE_PREFIX.length)
    : '';
}

function chatMessagePreview(body) {
  const media = parseChatMedia(body);
  if (!media) return String(body || '');
  return media.text
    ? `사진 · ${media.text}`
    : '사진';
}

async function getChatImageUrl(path) {
  const { data, error } =
    await cloud.storage
      .from('calendar-images')
      .createSignedUrl(path, 3600);

  if (error) {
    console.error('Chat image URL failed', error);
    const { data: publicData } =
      cloud.storage
        .from('calendar-images')
        .getPublicUrl(path);
    return publicData?.publicUrl || '';
  }

  return data?.signedUrl || '';
}

function openChatImageLightbox(url) {
  if (!url) return;
  $('#chatImageLightboxImage').src = url;
  $('#chatImageLightbox').hidden = false;
}

  function initials(name) {
    return String(name || '?')
      .trim()
      .slice(0, 1)
      .toUpperCase();
  }

  function avatarGradient(id) {
    const palettes = [
      ['#bfd9ef', '#89acd2'],
      ['#f3d7b9', '#e6ad82'],
      ['#dfcfeb', '#b89bcc'],
      ['#c8e5d5', '#92bea7'],
      ['#efd0d5', '#d998a3'],
      ['#cce2ee', '#97b9d3']
    ];

    const hash =
      [...String(id)].reduce(
        (total, character) =>
          total
          + character.charCodeAt(0),
        0
      );

    const [firstColor, secondColor] =
      palettes[
        hash % palettes.length
      ];

    return `
      linear-gradient(
        145deg,
        ${firstColor},
        ${secondColor}
      )
    `;
  }

  function renderAccountButton() {
    const label =
      currentProfile?.display_name
      || currentUser?.email
        ?.split('@')[0]
      || '로그인';

    accountName.textContent = label;

    accountAvatar.textContent =
      currentUser
        ? initials(label)
        : '';

    if (currentUser) {
      accountAvatar.style.background =
        avatarGradient(currentUser.id);
    }

    authBtn.classList.toggle(
      'logged-in',
      Boolean(currentUser)
    );
  }

  function avatarHtml(profile) {
    return `
      <span
        class="chat-avatar"
        style="--avatar-gradient:${
          avatarGradient(profile.id)
        }"
      >
        ${
          escapeHtml(
            initials(profile.display_name)
          )
        }
      </span>
    `;
  }

  async function ensureChatProfile() {
    if (!currentUser) return;

    const { data, error } =
      await cloud
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (error) {
      console.error(
        'Profile load failed',
        error
      );

      return;
    }

    currentProfile = data || null;

    renderAccountButton();

    if (!currentProfile) {
      openProfileModal();
    }

    renderChatRooms();
  }

  async function saveChatProfile(event) {
    event.preventDefault();

    const displayName =
      $('#profileNameInput')
        .value
        .trim();

    const username =
      $('#profileUsernameInput')
        .value
        .trim()
        .toLowerCase();

    const message =
      $('#profileMessage');

    message.textContent = '';

    if (
      !/^[a-z0-9_]{3,20}$/
        .test(username)
    ) {
      message.textContent =
        '사용자 이름은 영문 소문자, 숫자, 밑줄로 3~20자 입력해주세요.';

      return;
    }

    const { data, error } =
      await cloud
        .from('profiles')
        .upsert({
          id: currentUser.id,
          username,
          display_name: displayName
        })
        .select()
        .single();

    if (error) {
      message.textContent =
        error.code === '23505'
          ? '이미 사용 중인 사용자 이름이에요.'
          : error.message;

      return;
    }

    currentProfile = data;

    renderAccountButton();

    profileModal.hidden = true;
    scrim.classList.remove('visible');

    renderChatRooms();
    await loadChatRooms();
  }

  async function loadChatRooms() {
    if (!currentUser) return;

    const {
      data: memberships,
      error
    } = await cloud
      .from('chat_members')
      .select('room_id')
      .eq(
        'user_id',
        currentUser.id
      );

    if (error) {
      console.error(
        'Chat list failed',
        error
      );

      return;
    }

    const rooms =
      await Promise.all(
        (memberships || [])
          .map(async membership => {
            const roomId =
              membership.room_id;

            const [
              { data: members },
              { data: latest }
            ] = await Promise.all([
              cloud
                .from('chat_members')
                .select('user_id')
                .eq('room_id', roomId)
                .neq(
                  'user_id',
                  currentUser.id
                ),

              cloud
                .from('messages')
                .select(
                  'body,created_at'
                )
                .eq('room_id', roomId)
                .order(
                  'created_at',
                  {
                    ascending: false
                  }
                )
                .limit(1)
            ]);

            const otherUserId =
              members?.[0]?.user_id;

            if (!otherUserId) {
              return null;
            }

            const { data: profile } =
              await cloud
                .from('profiles')
                .select('*')
                .eq(
                  'id',
                  otherUserId
                )
                .maybeSingle();

            if (!profile) {
              return null;
            }

            return {
              id: roomId,
              profile,
              latest:
                latest?.[0] || null
            };
          })
      );

    chatRooms =
      rooms
        .filter(Boolean)
        .sort(
          (first, second) =>
            new Date(
              second.latest?.created_at
              || 0
            )
            - new Date(
              first.latest?.created_at
              || 0
            )
        );

    renderChatRooms();
  }

  function renderChatRooms() {
    countChats.textContent =
      chatRooms.length;

    const loggedIn =
      Boolean(currentUser);

    chatLoginState.hidden =
      loggedIn;

    chatRoomList.style.display =
      loggedIn
        ? 'block'
        : 'none';

    $('#newChatBtn').disabled =
      !loggedIn;

    chatProfileLabel.textContent =
      currentProfile
        ? `${
            currentProfile.display_name
          } · @${
            currentProfile.username
          }`
        : (
          loggedIn
            ? '프로필을 설정해주세요'
            : '로그인 후 이용할 수 있어요'
        );

    chatRoomList.innerHTML = '';

    if (
      loggedIn
      && !chatRooms.length
    ) {
      chatRoomList.innerHTML = `
        <p class="search-guide">
          아직 채팅방이 없어요.<br>
          새 채팅을 시작해보세요.
        </p>
      `;

      return;
    }

    chatRooms.forEach(room => {
      const button =
        document.createElement('button');

      button.className =
        'chat-room-item'
        + (
          room.id === activeRoomId
            ? ' active'
            : ''
        );

      button.innerHTML = `
        ${avatarHtml(room.profile)}

        <span class="chat-room-copy">
          <span class="chat-room-top">
            <strong>
              ${
                escapeHtml(
                  room.profile.display_name
                )
              }
            </strong>

            <span class="chat-room-time">
              ${
                room.latest
                  ? chatListTime(
                      room.latest.created_at
                    )
                  : ''
              }
            </span>
          </span>

          <span class="chat-room-preview">
            ${
                  escapeHtml(
                    chatMessagePreview(
                      room.latest?.body
                    )
                    || '새로운 대화를 시작해보세요.'
                  )
            }
          </span>
        </span>
      `;

      button.addEventListener(
        'click',
        () => openChatRoom(room.id)
      );

      chatRoomList.appendChild(button);
    });
  }

  function chatListTime(value) {
    const date = new Date(value);
    const now = new Date();

    if (
      date.toDateString()
      === now.toDateString()
    ) {
      return date.toLocaleTimeString(
        'ko-KR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
    }

    return date.toLocaleDateString(
      'ko-KR',
      {
        month: 'numeric',
        day: 'numeric'
      }
    );
  }

  function messageTime(value) {
    return new Date(value)
      .toLocaleTimeString(
        'ko-KR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }

  async function openChatRoom(roomId) {
    const room =
      chatRooms.find(
        item => item.id === roomId
      );

    if (!room) return;

    activeRoomId = roomId;
    clearPendingChatImage();

    renderedMessageIds.clear();
    renderChatRooms();

    chatEmptyConversation.hidden = true;
    chatActive.hidden = false;

    $('#chatHeaderName').textContent =
      room.profile.display_name;

    $('#chatHeaderUsername').textContent =
      `@${room.profile.username}`;

    $('#chatHeaderAvatar').textContent =
      initials(
        room.profile.display_name
      );

    $('#chatHeaderAvatar')
      .style.setProperty(
        '--avatar-gradient',
        avatarGradient(room.profile.id)
      );

    chatConversation
      .parentElement
      .classList.add(
        'mobile-conversation'
      );
    chatConversation
      .parentElement
      .classList.remove(
        'list-wing-open'
      );
    $('#chatWingToggle')
      .setAttribute('aria-expanded', 'false');

    chatMessages.innerHTML = `
      <p class="search-guide">
        대화를 불러오는 중…
      </p>
    `;

    const { data, error } =
      await cloud
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order(
          'created_at',
          {
            ascending: true
          }
        )
        .limit(500);

    if (error) {
      console.error(
        'Message load failed',
        error
      );

      chatMessages.innerHTML = `
        <p class="search-guide">
          메시지를 불러오지 못했어요.
        </p>
      `;

      return;
    }

    chatMessages.innerHTML = '';

    (data || []).forEach(
      appendMessage
    );

    scrollChatToBottom();
    subscribeToMessages(roomId);
  }

  async function appendMessage(message) {
    const messageId =
      String(message.id);

    if (
      renderedMessageIds.has(messageId)
    ) {
      return;
    }

    renderedMessageIds.add(messageId);

    const row =
      document.createElement('div');

    row.className =
      'message-row'
      + (
        message.user_id
          === currentUser?.id
          ? ' mine'
          : ''
      );

    const media =
      parseChatMedia(message.body);

    if (media) {
      row.classList.add(
        'image-message-row'
      );
    }

    row.innerHTML = `
      <div class="message-bubble ${media ? 'message-bubble-image' : ''}">
        ${media ? '<span class="chat-image-loading">사진 불러오는 중…</span>' : escapeHtml(message.body)}
      </div>

      <time class="message-time">
        ${messageTime(message.created_at)}
      </time>
    `;

    chatMessages.appendChild(row);

    if (media) {
      const url = media.image
        || await getChatImageUrl(media.path);
      const bubble =
        row.querySelector('.message-bubble');

      if (url) {
        bubble.innerHTML = '';
        const button =
          document.createElement('button');
        button.type = 'button';
        button.className = 'chat-image-thumb';
        button.setAttribute(
          'aria-label',
          '사진 크게 보기'
        );
        const image =
          document.createElement('img');
        image.src = url;
        image.alt = '채팅 첨부 이미지';
        button.appendChild(image);
        button.addEventListener(
          'click',
          () => openChatImageLightbox(url)
        );
        bubble.appendChild(button);

        if (media.text) {
          const caption =
            document.createElement('p');
          caption.className =
            'chat-image-caption';
          caption.textContent = media.text;
          bubble.appendChild(caption);
        }
        scrollChatToBottom();
      } else {
        bubble.textContent =
          '사진을 불러오지 못했어요.';
      }
    }
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop =
        chatMessages.scrollHeight;
    });
  }

  function closeMessageSubscription() {
    if (!messageSubscription) return;

    cloud.removeChannel(
      messageSubscription
    );

    messageSubscription = null;
  }

  function subscribeToMessages(roomId) {
    closeMessageSubscription();

    messageSubscription =
      cloud
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter:
              `room_id=eq.${roomId}`
          },
          payload => {
            if (
              activeRoomId !== roomId
            ) {
              return;
            }

            appendMessage(payload.new);
            scrollChatToBottom();
            loadChatRooms();
          }
        )
        .subscribe();
  }

  async function sendChatMessage(event) {
    event.preventDefault();

    const body =
      chatInput.value.trim();

    if (
      (!body && !pendingChatImage)
      || !activeRoomId
      || !currentUser
    ) {
      return;
    }

    const outgoingImage =
      pendingChatImage;
    const outgoingBody =
      outgoingImage
        ? `${CHAT_MEDIA_PREFIX}${JSON.stringify({
            image: outgoingImage,
            text: body
          })}`
        : body;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    clearPendingChatImage();

    const { data, error } =
      await cloud
        .from('messages')
        .insert({
          room_id: activeRoomId,
          user_id: currentUser.id,
          body: outgoingBody
        })
        .select()
        .single();

    if (error) {
      console.error(
        'Message send failed',
        error
      );

      alert(
        '메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.'
      );

      chatInput.value = body;
      if (outgoingImage) {
        setPendingChatImage(outgoingImage);
      }
      return;
    }

    appendMessage(data);
    scrollChatToBottom();
    loadChatRooms();
  }

  function resizeChatImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('이미지 파일이 아닙니다.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSize = 800;
          const scale = Math.min(
            1,
            maxSize / Math.max(
              image.width,
              image.height
            )
          );
          const canvas =
            document.createElement('canvas');
          canvas.width = Math.max(
            1,
            Math.round(image.width * scale)
          );
          canvas.height = Math.max(
            1,
            Math.round(image.height * scale)
          );
          canvas
            .getContext('2d')
            .drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );
          resolve(
            canvas.toDataURL(
              'image/jpeg',
              .68
            )
          );
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setPendingChatImage(dataUrl) {
    pendingChatImage = dataUrl;
    $('#chatAttachmentPreviewImage').src =
      dataUrl;
    $('#chatAttachmentPreview').hidden =
      false;
  }

  function clearPendingChatImage() {
    pendingChatImage = '';
    $('#chatAttachmentPreview').hidden =
      true;
    $('#chatAttachmentPreviewImage')
      .removeAttribute('src');
    $('#chatPhotoInput').value = '';
  }

  async function prepareChatPhoto(file) {
    if (!file) return;
    const photoButton =
      document.querySelector(
        '.chat-photo-btn'
      );
    photoButton.classList.add('uploading');

    try {
      const dataUrl =
        await resizeChatImage(file);
      setPendingChatImage(dataUrl);
      chatInput.focus();
    } catch (error) {
      console.error(
        'Chat photo preview failed',
        error
      );
      alert(
        '사진을 준비하지 못했어요. 다른 사진으로 다시 시도해주세요.'
      );
    } finally {
      photoButton.classList.remove(
        'uploading'
      );
    }
  }

  bindImageDropTarget(
    $('#chatForm'),
    files => prepareChatPhoto(files[0]),
    {
      onError: message =>
        alert(message)
    }
  );

  function openNewChat() {
    if (!currentUser) {
      openAuthModal();
      return;
    }

    if (!currentProfile) {
      ensureChatProfile();
      return;
    }

    userSearchInput.value = '';

    userSearchResults.innerHTML = `
      <p class="search-guide">
        두 글자 이상 입력해주세요.
      </p>
    `;

    newChatModal.hidden = false;
    scrim.classList.add('visible');

    setTimeout(
      () => userSearchInput.focus(),
      50
    );
  }

  function closeNewChat() {
    newChatModal.hidden = true;
    scrim.classList.remove('visible');
  }

  let searchUserTimer = null;

  function searchChatUsers() {
    clearTimeout(searchUserTimer);

    searchUserTimer =
      setTimeout(
        async () => {
          const term =
            userSearchInput
              .value
              .trim()
              .replace(
                /[%_,()]/g,
                ''
              );

          if (term.length < 2) {
            userSearchResults.innerHTML = `
              <p class="search-guide">
                두 글자 이상 입력해주세요.
              </p>
            `;

            return;
          }

          userSearchResults.innerHTML = `
            <p class="search-guide">
              검색 중…
            </p>
          `;

          const { data, error } =
            await cloud
              .from('profiles')
              .select('*')
              .neq(
                'id',
                currentUser.id
              )
              .or(
                `username.ilike.%${term}%,display_name.ilike.%${term}%`
              )
              .limit(20);

          if (
            error
            || !data?.length
          ) {
            userSearchResults.innerHTML = `
              <p class="search-guide">
                검색 결과가 없어요.
              </p>
            `;

            return;
          }

          userSearchResults.innerHTML = '';

          data.forEach(profile => {
            const button =
              document.createElement(
                'button'
              );

            button.className =
              'user-result';

            button.innerHTML = `
              ${avatarHtml(profile)}

              <span>
                <strong>
                  ${
                    escapeHtml(
                      profile.display_name
                    )
                  }
                </strong>

                <span>
                  @${
                    escapeHtml(
                      profile.username
                    )
                  }
                </span>
              </span>
            `;

            button.addEventListener(
              'click',
              () =>
                createDirectChat(
                  profile.id
                )
            );

            userSearchResults
              .appendChild(button);
          });
        },
        300
      );
  }

  async function createDirectChat(
    otherUserId
  ) {
    const { data, error } =
      await cloud.rpc(
        'create_direct_chat',
        {
          other_user: otherUserId
        }
      );

    if (error) {
      console.error(
        'Chat creation failed',
        error
      );

      alert(
        '채팅방을 만들지 못했어요.'
      );

      return;
    }

    closeNewChat();

    await loadChatRooms();
    await openChatRoom(data);
  }
