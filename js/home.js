'use strict';

/* ---------------- Home dashboard ---------------- */

const HOME_QUOTES = [
  {
    text: '너희 모든 일을 사랑으로 행하라.',
    source: '고린도전서 16:14'
  },
  {
    text: '기록은 흘러가는 마음에 작은 자리를 내어주는 일이다.',
    source: '오늘의 문장'
  },
  {
    text: '두려워하지 말라. 내가 너와 함께 함이라.',
    source: '이사야 41:10'
  },
  {
    text: '천천히 가도 괜찮다. 오늘의 한 줄도 분명히 쌓인다.',
    source: 'Archive'
  }
];

let homeQuoteIndex = 0;
let homeQuoteTimer = null;
let activeTemplate = 'memo';
let quickChatRoomId = null;
let quickChatSubscription = null;
const quickRenderedMessageIds = new Set();
let homeStripPosition = 0;

function renderHomeDashboard() {
  const now = new Date();

  $('#homeDateLabel').textContent =
    now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

  renderHomeCalendar();
  renderHomeLibraryStrip();
  renderTemplatePreview(activeTemplate);
  renderHomeQuote();
  startHomeQuoteRotation();

  if (currentUser) {
    loadCalendarEntries().then(() => {
      if (currentView === 'home') {
        renderHomeCalendar();
      }
    });
  }
}

function renderHomeLibraryStrip() {
  const folderWrap = $('#homeFolderShortcuts');
  const noteWrap = $('#homeNoteShortcuts');

  folderWrap.innerHTML = state.folders.slice(0, 4).map(folder => {
    const count = state.notes.filter(note => note.folderId === folder.id).length;
    return `
      <button class="home-folder-link" type="button" data-folder-id="${folder.id}">
        <span class="home-mini-folder" style="--folder-color:${folder.color}"></span>
        <span><strong>${escapeHtml(folder.name)}</strong><small>${count}개 자료</small></span>
      </button>
    `;
  }).join('');

  noteWrap.innerHTML = state.notes
    .slice()
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, 6)
    .map(note => {
      const folder = state.folders.find(item => item.id === note.folderId);
      const color = folder?.color || '#dfe4e9';
      const summary = note.content.trim().replace(/\s+/g, ' ') || '내용 없음';
      return `
        <button class="home-note-link" type="button" data-note-id="${note.id}" style="--folder-color:${color}">
          <strong>${escapeHtml(note.title || '제목 없음')}</strong>
          <span>${escapeHtml(summary)}</span>
          <small><i></i>${escapeHtml(folder?.name || '폴더 없음')} · ${formatDate(note.updatedAt)}</small>
        </button>
      `;
    }).join('');

  folderWrap.querySelectorAll('[data-folder-id]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.folderId));
  });

  noteWrap.querySelectorAll('[data-note-id]').forEach(button => {
    button.addEventListener('click', () => openNoteView(button.dataset.noteId));
  });

  homeStripPosition = 0;
  updateHomeStripPosition();
}

function updateHomeStripPosition() {
  const viewport = $('#homeLibraryViewport');
  const track = viewport.querySelector('.home-library-track');
  const maxPosition = Math.max(0, track.scrollWidth - viewport.clientWidth);

  homeStripPosition = Math.min(Math.max(homeStripPosition, 0), maxPosition);
  track.style.transform = `translateX(-${homeStripPosition}px)`;
  track.style.transition = 'transform .36s cubic-bezier(.22, 1, .36, 1)';

  $('#homeStripPrev').disabled = homeStripPosition <= 0;
  $('#homeStripNext').disabled = homeStripPosition >= maxPosition - 1;
}

function moveHomeStrip(direction) {
  const viewport = $('#homeLibraryViewport');
  homeStripPosition += direction * Math.max(260, viewport.clientWidth * .72);
  updateHomeStripPosition();
}

function renderHomeCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const today = dateKey(new Date());
  const grid = $('#homeCalendarGrid');

  $('#homeCalendarTitle').textContent = `${year}. ${String(month + 1).padStart(2, '0')}`;
  grid.innerHTML = '';

  for (let index = 0; index < 42; index += 1) {
    let day;
    let cellDate;
    let outside = false;

    if (index < firstDay) {
      day = previousMonthDays - firstDay + index + 1;
      cellDate = new Date(year, month - 1, day);
      outside = true;
    } else if (index >= firstDay + daysInMonth) {
      day = index - firstDay - daysInMonth + 1;
      cellDate = new Date(year, month + 1, day);
      outside = true;
    } else {
      day = index - firstDay + 1;
      cellDate = new Date(year, month, day);
    }

    const key = dateKey(cellDate);
    const button = document.createElement('button');
    const hasEntry = !outside && calendarEntries.has(key);

    button.type = 'button';
    button.className =
      'mini-calendar-day'
      + (outside ? ' outside' : '')
      + (key === today ? ' today' : '')
      + (hasEntry ? ' has-entry' : '');
    button.innerHTML = `<span>${day}</span>`;
    button.addEventListener('click', () => {
      if (outside) {
        calendarCursor = new Date(cellDate.getFullYear(), cellDate.getMonth(), 1);
        setView('calendar');
        return;
      }
      openCalendarEntry(cellDate);
    });

    grid.appendChild(button);
  }
}

function renderTemplatePreview(template) {
  activeTemplate = template;

  document.querySelectorAll('.template-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.template === template);
  });

  const preview = $('#templatePreview');
  const templates = {
    memo: {
      kicker: '01 · BASIC NOTE',
      title: '자유롭게 기록하기',
      desc: '생각과 레퍼런스, 기억해두고 싶은 문장을 가장 편안한 방식으로 적어보세요.',
      action: '새 메모 작성',
      command: 'memo'
    },
    todo: {
      kicker: '02 · POST-IT',
      title: '용도에 맞는 종이 한 장',
      desc: '투두·쇼핑·위시·위클리·해빗 트래커를 종이 질감의 포스트잇으로 기록해보세요.',
      action: '새 포스트잇 만들기',
      command: 'todo'
    },
    moodboard: {
      kicker: '03 · MOODBOARD',
      title: '감각을 한 화면에 모으기',
      desc: '사진과 글을 자유롭게 옮기고, 펜으로 선을 그리는 캔버스형 템플릿이에요.',
      action: '새 무드보드 만들기',
      command: 'moodboard'
    },
    links: {
      kicker: '04 · LINKS',
      title: '유용한 사이트 모아두기',
      desc: '사이트 주소와 간단한 설명을 함께 저장하고 카테고리별로 빠르게 찾아보세요.',
      action: '새 링크 저장',
      command: 'links'
    },
    collection: {
      kicker: '05 · COLLECTION',
      title: '좋아한 것들을 수집하기',
      desc: '책, 영화, 음악, 맛집을 이미지와 한 줄 평, 나만의 정보와 함께 기록해요.',
      action: '새 컬렉션 추가',
      command: 'collection'
    }
  };
  const item = templates[template];
  const recentNotes = state.notes
    .filter(note => (note.template || 'memo') === template)
    .slice()
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, 3);
  const todoItems = template === 'todo'
    ? `
      <ul class="template-preview-list">
        ${
          recentNotes[0]
            ? ensurePostitData(
                recentNotes[0]
              ).items
                .filter(item => item.text)
                .slice(0, 4)
                .map(
                  item => `
                    <li>${escapeHtml(item.text)}</li>
                  `
                )
                .join('')
              || '<li>아직 작성된 항목이 없어요.</li>'
            : '<li>아직 작성된 포스트잇이 없어요.</li>'
        }
      </ul>
    `
    : '';
  const recentHtml = recentNotes.length
    ? `
      <div class="template-preview-recent">
        <div class="template-preview-recent-head">
          <strong>최근 ${item.title.replace('하기', '')}</strong>
          <span>${recentNotes.length}개</span>
        </div>
        <div class="template-preview-cards">
          ${recentNotes.map(note => `
            <button class="template-preview-card" type="button" data-preview-note-id="${note.id}">
              <strong>${escapeHtml(note.title || '제목 없음')}</strong>
              <span>${escapeHtml(noteCardPreview(note) || '내용 없음')}</span>
              <small>${formatDate(note.updatedAt)}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `
    : `
      <div class="template-preview-empty">
        아직 이 템플릿으로 작성한 자료가 없어요.
      </div>
    `;

  preview.innerHTML = `
    <span class="template-preview-kicker">${item.kicker}</span>
    <h2 class="template-preview-title">${item.title}</h2>
    <p class="template-preview-desc">${item.desc}</p>
    ${todoItems}
    <button class="template-preview-action" type="button" data-command="${item.command}">${item.action}</button>
    ${recentHtml}
  `;

  preview.querySelector('[data-command]').addEventListener('click', event => {
    const command = event.currentTarget.dataset.command;
    if (command === 'memo') createNote();
    if (command === 'todo') createNote('todo');
    if (command === 'moodboard') createNote('moodboard');
    if (command === 'links') createNote('links');
    if (command === 'collection') createNote('collection');
  });

  preview.querySelectorAll('[data-preview-note-id]').forEach(button => {
    button.addEventListener('click', () => openNoteView(button.dataset.previewNoteId));
  });
}

function renderHomeQuote() {
  const quote = HOME_QUOTES[homeQuoteIndex];
  $('#quoteCopy').innerHTML = `<blockquote>${quote.text}</blockquote><cite>${quote.source}</cite>`;
  $('#quoteDots').innerHTML = HOME_QUOTES.map((_, index) => `<span class="${index === homeQuoteIndex ? 'active' : ''}"></span>`).join('');
}

function startHomeQuoteRotation() {
  clearInterval(homeQuoteTimer);
  homeQuoteTimer = setInterval(() => {
    if (currentView !== 'home') return;
    homeQuoteIndex = (homeQuoteIndex + 1) % HOME_QUOTES.length;
    renderHomeQuote();
  }, 6500);
}

async function openQuickChatNote() {
  $('#quickChatNote').hidden = false;

  if (!currentUser) {
    $('#quickChatRooms').innerHTML = '<button class="quick-room-chip" type="button">로그인 필요</button>';
    return;
  }

  if (!chatRooms.length) {
    await loadChatRooms();
  }

  renderQuickChatRooms();

  const selectedRoom =
    chatRooms.find(
      room => room.id === quickChatRoomId
    )
    || chatRooms[0];

  if (selectedRoom) {
    await loadQuickChatRoom(selectedRoom);
  }
}

function renderQuickChatRooms() {
  const roomWrap = $('#quickChatRooms');
  roomWrap.innerHTML = '';

  if (!chatRooms.length) {
    roomWrap.innerHTML = '<button class="quick-room-chip" type="button">아직 채팅방이 없어요</button>';
    return;
  }

  chatRooms.forEach(room => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-room-chip' + (room.id === quickChatRoomId ? ' active' : '');
    button.textContent = room.profile.display_name;
    button.addEventListener('click', () => loadQuickChatRoom(room));
    roomWrap.appendChild(button);
  });
}

async function loadQuickChatRoom(room) {
  quickChatRoomId = room.id;
  quickRenderedMessageIds.clear();
  $('#quickChatTitle').textContent = `${room.profile.display_name}에게 메모 남기기`;
  renderQuickChatRooms();
  $('#quickChatLines').innerHTML = '<p>메모를 불러오는 중…</p>';

  const { data, error } = await cloud
    .from('messages')
    .select('*')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })
    .limit(80);

  if (error) {
    $('#quickChatLines').innerHTML = '<p>대화를 불러오지 못했어요.</p>';
    return;
  }

  $('#quickChatLines').innerHTML = '';

  if (!data?.length) {
    $('#quickChatLines').innerHTML =
      '<p class="quick-chat-empty">아직 적힌 메모가 없어요.</p>';
  } else {
    data.forEach(appendQuickChatMessage);
  }

  subscribeQuickChat(room.id);
  scrollQuickChatToBottom();
}

async function appendQuickChatMessage(message) {
  const messageId = String(message.id);
  if (
    quickRenderedMessageIds.has(messageId)
  ) {
    return;
  }

  quickRenderedMessageIds.add(messageId);
  $('#quickChatLines')
    .querySelector('.quick-chat-empty')
    ?.remove();

  const row = document.createElement('p');
  row.className =
    message.user_id === currentUser?.id
      ? 'mine'
      : '';
  const media =
    parseChatMedia(message.body);

  if (!media) {
    row.textContent = message.body;
    $('#quickChatLines').appendChild(row);
    scrollQuickChatToBottom();
    return;
  }

  row.classList.add('image');

  if (
    media.path
    && media.bucket
      === 'calendar-images'
  ) {
    row.classList.remove('image');
    row.classList.add('failed-image');
    row.textContent =
      '이전 사진은 다시 전송해주세요.';
    $('#quickChatLines').appendChild(row);
    scrollQuickChatToBottom();
    return;
  }

  row.textContent = '사진 불러오는 중…';
  $('#quickChatLines').appendChild(row);

  const url = media.image
    || await getChatImageUrl(
      media.path,
      media.bucket
    );
  if (!url) {
    row.classList.remove('image');
    row.classList.add('failed-image');
    row.textContent =
      '사진 저장공간 권한을 확인해주세요.';
    return;
  }

  row.innerHTML = '';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quick-chat-image';
  const image = document.createElement('img');
  image.src = url;
  image.alt = '채팅 첨부 이미지';
  image.addEventListener(
    'error',
    () => {
      row.classList.remove('image');
      row.classList.add('failed-image');
      row.textContent =
        '사진 저장공간 권한을 확인해주세요.';
    },
    { once: true }
  );
  button.appendChild(image);
  button.addEventListener(
    'click',
    () => openChatImageLightbox(url)
  );
  row.appendChild(button);

  if (media.text) {
    const caption =
      document.createElement('span');
    caption.className =
      'quick-chat-image-caption';
    caption.textContent = media.text;
    row.appendChild(caption);
  }

  scrollQuickChatToBottom();
}

function scrollQuickChatToBottom() {
  requestAnimationFrame(() => {
    const lines = $('#quickChatLines');
    lines.scrollTop = lines.scrollHeight;
  });
}

function closeQuickChatSubscription() {
  if (!quickChatSubscription) return;
  cloud.removeChannel(quickChatSubscription);
  quickChatSubscription = null;
}

function subscribeQuickChat(roomId) {
  closeQuickChatSubscription();
  quickChatSubscription = cloud
    .channel(`quick-room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      },
      payload => {
        if (
          quickChatRoomId !== roomId
          || $('#quickChatNote').hidden
        ) {
          return;
        }
        appendQuickChatMessage(payload.new);
      }
    )
    .subscribe();
}

async function sendQuickChatMessage(event) {
  event.preventDefault();
  const input = $('#quickChatInput');
  const body = input.value.trim();

  if (!currentUser) {
    openAuthModal();
    return;
  }
  if (!quickChatRoomId || !body) return;

  input.value = '';
  const { data, error } = await cloud
    .from('messages')
    .insert({
      room_id: quickChatRoomId,
      user_id: currentUser.id,
      body
    })
    .select()
    .single();

  if (error) {
    input.value = body;
    return;
  }

  appendQuickChatMessage(data);
  loadChatRooms();
}

document.querySelectorAll('.template-tab').forEach(tab => {
  tab.addEventListener('click', () => renderTemplatePreview(tab.dataset.template));
});

$('#homeCalendarMore').addEventListener('click', () => setView('calendar'));
$('#homeAllNotesButton').addEventListener('click', () => setView('all'));
$('#homeStripPrev').addEventListener('click', () => moveHomeStrip(-1));
$('#homeStripNext').addEventListener('click', () => moveHomeStrip(1));
window.addEventListener('resize', updateHomeStripPosition);
$('#quickChatButton').addEventListener('click', openQuickChatNote);
$('#quickChatClose').addEventListener('click', () => {
  $('#quickChatNote').hidden = true;
  closeQuickChatSubscription();
});
$('#quickChatForm').addEventListener('submit', sendQuickChatMessage);
