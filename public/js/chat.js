const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !currentUser) {
  window.location.href = '/login.html';
}

document.getElementById('my-username').textContent = currentUser.username;

const socket = io({ auth: { token } });

const userListEl = document.getElementById('user-list');
const messagesEl = document.getElementById('messages');
const chatWithEl = document.getElementById('chat-with');
const form = document.getElementById('form');
const input = document.getElementById('input');
const searchInput = document.getElementById('search-input');
const typingIndicator = document.getElementById('typing-indicator');
const imageInput = document.getElementById('image-input');

const profileBtn = document.getElementById('profile-btn');
const profileModal = document.getElementById('profile-modal');
const profileUsernameInput = document.getElementById('profile-username');
const profileAvatarInput = document.getElementById('profile-avatar');

const searchResultsEl = document.getElementById('search-results');
const pendingToggle = document.getElementById('pending-requests-toggle');
const pendingCount = document.getElementById('pending-count');
const pendingPanel = document.getElementById('pending-panel');
const pendingPanelClose = document.getElementById('pending-panel-close');
const pendingListEl = document.getElementById('pending-list');

let activeUser = null;      //{_id, username, isOnline}
let allUsers = [];
let typingTimeout;

async function apiCall(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json();
  if (!res.ok) return { 
    error: data.error || 'Request failed' };
  return data;
}

let friendsList = [];
let unreadCounts = {}; // userId -> count
let friendStatuses = { friends: [], sent: [], received: [] };

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

async function loadFriends() {
  friendsList = await apiCall('/api/friends');
  renderFriendsList();
  const lastId = localStorage.getItem('lastActiveUserId');
  if (lastId) {
    const lastUser = friendsList.find(u => u._id === lastId);
    if (lastUser) selectUser(lastUser);
  }
}

async function loadFriendStatuses() {
  friendStatuses = await apiCall('/api/friends/statuses');
}

function getRelationshipButton(user) {
  if (friendStatuses.friends.includes(user._id)) {
    return `<button class="friend-action-btn friends" disabled>Friends ✓</button>`;
  }
  const sent = friendStatuses.sent.find(s => s.userId === user._id);
  if (sent) {
    return `<button class="friend-action-btn sent" disabled>Request Sent</button>`;
  }
  const received = friendStatuses.received.find(r => r.userId === user._id);
  if (received) {
    return `<button class="friend-action-btn accept" data-request-id="${received.requestId}" data-accept-user="${user._id}">Accept Request</button>`;
  }
  return `<button class="friend-action-btn add" data-add-user="${user._id}">+ Add Friend</button>`;
}

function renderSearchResults(users) {
  searchResultsEl.innerHTML = '';
  searchResultsEl.classList.remove('hidden');
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(user.username)}</span>${getRelationshipButton(user)}`;
    searchResultsEl.appendChild(li);
  });
}

searchInput.addEventListener('input', async () => {
  const q = searchInput.value.trim();
  if (!q) {
    searchResultsEl.classList.add('hidden');
    searchResultsEl.innerHTML = '';
    return;
  }
  await loadFriendStatuses();
  const results = await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`);
  renderSearchResults(results);
});

searchResultsEl.addEventListener('click', async (e) => {
  if (e.target.dataset.addUser) {
    const receiverId = e.target.dataset.addUser;
    const request = await apiCall('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ receiverId })
    });
    if (request.error) { alert(request.error); return; }
    socket.emit('friend request sent', { receiverId, request });
    await loadFriendStatuses();
    const q = searchInput.value.trim();
    if (q) renderSearchResults(await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`));
  }

  if (e.target.dataset.requestId && e.target.dataset.acceptUser) {
    const requestId = e.target.dataset.requestId;
    const senderId = e.target.dataset.acceptUser;
    const updated = await apiCall(`/api/friends/request/${requestId}/accept`, { method: 'PUT' });
    if (updated.error) { alert(updated.error); return; }
    socket.emit('friend request accepted', { senderId, receiverId: currentUser.id, request: updated });
    await loadFriendStatuses();
    await loadFriends();
    const q = searchInput.value.trim();
    if (q) renderSearchResults(await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`));
  }
});

async function loadPendingRequests() {
  const requests = await apiCall('/api/friends/requests/pending');
  renderPendingList(requests);
  return requests;
}

function renderPendingList(requests) {
  pendingListEl.innerHTML = '';
  if (requests.length === 0) {
    pendingCount.classList.add('hidden');
  } else {
    pendingCount.textContent = requests.length;
    pendingCount.classList.remove('hidden');
  }
  requests.forEach(req => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(req.sender.username)}</span>
      <div class="pending-actions">
        <button class="accept-btn" data-request-id="${req._id}" data-sender-id="${req.sender._id}">Accept</button>
        <button class="reject-btn" data-request-id="${req._id}">Reject</button>
      </div>`;
    pendingListEl.appendChild(li);
  });
}

pendingToggle.addEventListener('click', async () => {
  await loadPendingRequests();
  pendingPanel.classList.remove('hidden');
});

pendingPanelClose.addEventListener('click', () => {
  pendingPanel.classList.add('hidden');
});

pendingListEl.addEventListener('click', async (e) => {
  const requestId = e.target.dataset.requestId;
  if (!requestId) return;

  if (e.target.classList.contains('accept-btn')) {
    const senderId = e.target.dataset.senderId;
    const updated = await apiCall(`/api/friends/request/${requestId}/accept`, { method: 'PUT' });
    if (updated.error) { alert(updated.error); return; }
    socket.emit('friend request accepted', { senderId, receiverId: currentUser.id, request: updated });
    await loadFriends();
    await loadPendingRequests();
  }

  if (e.target.classList.contains('reject-btn')) {
    const updated = await apiCall(`/api/friends/request/${requestId}/reject`, { method: 'PUT' });
    if (updated.error) { alert(updated.error); return; }
    socket.emit('friend request rejected', { senderId: updated.sender, requestId });
    await loadPendingRequests();
  }
});

async function selectUser(user) {
  activeUser = user;
  localStorage.setItem('lastActiveUserId', user._id);
  chatWithEl.textContent = user.username;
  renderFriendsList();
  
  const messages = await apiCall(`/api/messages/${user._id}`);
  messagesEl.innerHTML = '';
  messages.forEach(renderMessage);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  loadPinnedMessages();
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🥰'];

function renderMessage(msg) {
  const li = document.createElement('li');
  const isOwn = msg.sender === currentUser.id || msg.sender?._id === currentUser.id;
  li.className = isOwn ? 'own' : 'other';
  li.dataset.id = msg._id;
  li.dataset.raw = JSON.stringify(msg);

  let content = '';

  if (msg.forwardedFrom) {
    content += `<div class="forwarded-label">↪ Forwarded</div>`;
  }
  if (msg.replyTo) {
    const replyText = msg.replyTo.message || (msg.replyTo.image ? '📷 Image' : (msg.replyTo.audio ? '🎤 Voice message' : ''));
    content += `<div class="reply-quote">${escapeHtml(replyText)}</div>`;
  }
  if (msg.message) content += `<div class="msg-text">${escapeHtml(msg.message)}</div>`;
  if (msg.image) content += `<img src="${msg.image}" />`;
  if (msg.audio) {
    content += `
      <div class="voice-message">
        <audio class="voice-audio" src="${msg.audio}" controls></audio>
        <div class="speed-controls">
          <button type="button" class="speed-btn active" data-speed="1">1x</button>
          <button type="button" class="speed-btn" data-speed="1.5">1.5x</button>
          <button type="button" class="speed-btn" data-speed="2">2x</button>
        </div>
      </div>`;
  }

  content += `<span class="meta">${new Date(msg.timestamp).toLocaleString()}${msg.isEdited ? ' (edited)' : ''}${msg.isPinned ? ' 📌' : ''}</span>`;

  if (msg.reactions && msg.reactions.length > 0) {
    const counts = {};
    msg.reactions.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    content += `<div class="reaction-summary">`;
    Object.keys(counts).forEach(emoji => {
      content += `<span class="reaction-pill">${emoji} ${counts[emoji]}</span>`;
    });
    content += `</div>`;
  }

  content += `<div class="msg-actions">`;
  content += `<span class="react-btn" data-id="${msg._id}">😊</span>`;
  content += `<span class="reply-btn" data-id="${msg._id}">Reply</span>`;
  content += `<span class="forward-btn" data-id="${msg._id}">Forward</span>`;
  content += `<span class="pin-btn" data-id="${msg._id}">${msg.isPinned ? 'Unpin' : 'Pin'}</span>`;
  if (isOwn && !msg.isDeleted) {
    content += `<span class="delete-btn" data-id="${msg._id}">Delete</span>`;
    if (msg.message && !msg.image && !msg.audio) {
      content += `<span class="edit-btn" data-id="${msg._id}">Edit</span>`;
    }
  }
  content += `</div>`;

  li.innerHTML = content;
  messagesEl.appendChild(li);
}

function renderMessageInPlace(msg, li) {
  const isOwn = msg.sender === currentUser.id || msg.sender?._id === currentUser.id;
  li.className = isOwn ? 'own' : 'other';
  li.dataset.id = msg._id;
  let content = '';
  if (msg.message) content += `<div class="msg-text">${escapeHtml(msg.message)}</div>`;
  if (msg.image) content += `<img src="${msg.image}" />`;
  content += `<span class="meta">${new Date(msg.timestamp).toLocaleString()}${msg.isEdited ? ' (edited)' : ''}</span>`;
  if (isOwn && !msg.isDeleted) {
    content += `<span class="delete-btn" data-id="${msg._id}">Delete</span>`;
    if (msg.message && !msg.image) content += ` <span class="edit-btn" data-id="${msg._id}">Edit</span>`;
  }
  li.innerHTML = content;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('edit-btn')) {
    const id = e.target.dataset.id;
    const li = e.target.closest('li');
    const textDiv = li.querySelector('.msg-text');
    const oldText = textDiv.textContent;

    li.innerHTML = `
      <input type="text" class="edit-input" value="${oldText.replace(/"/g, '&quot;')}" />
      <button class="edit-save-btn" data-id="${id}">Save</button>
    `;
    li.querySelector('.edit-save-btn').addEventListener('click', async () => {
      const newText = li.querySelector('.edit-input').value.trim();
      if (!newText) return;
      const updated = await apiCall(`/api/messages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ message: newText })
      });
      if (updated.error) { alert(updated.error); return; }
      socket.emit('edit message', { messageId: id, receiverId: activeUser._id, message: newText });
      li.outerHTML = '';
      const newLi = document.createElement('li');
      messagesEl.appendChild(newLi);
      renderMessageInPlace(updated, newLi);
    });
  }
});

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    await apiCall(`/api/messages/${id}`, { method: 'DELETE' });
    const li = e.target.closest('li');
    li.innerHTML = `<div><em>This message was deleted</em></div>`;
  }
});

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('speed-btn')) {
    const speed = parseFloat(e.target.dataset.speed);
    const audioEl = e.target.closest('.voice-message').querySelector('audio');
    audioEl.playbackRate = speed;
    e.target.parentElement.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  }
});

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('react-btn')) {
    showReactionPicker(e.target, e.target.dataset.id);
  }
});

function showReactionPicker(anchor, messageId) {
  const old = document.getElementById('reaction-picker');
  if (old) old.remove();

  const picker = document.createElement('div');
  picker.id = 'reaction-picker';
  picker.className = 'reaction-picker';
  REACTION_EMOJIS.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.addEventListener('click', async () => {
      const updated = await apiCall(`/api/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
      if (updated.error) { 
        alert(updated.error); 
        return; 
      }
      socket.emit('react message', { 
        messageId, receiverId: activeUser._id, reactions: updated.reactions 
      });
      updateReactionsInDOM(messageId, updated.reactions);
      picker.remove();
    });
    picker.appendChild(span);
  });
  document.body.appendChild(picker);
  const rect = anchor.getBoundingClientRect();
  picker.style.top = `${rect.top + window.scrollY - 40}px`;
  picker.style.left = `${rect.left + window.scrollX}px`;

  setTimeout(() => {
    document.addEventListener('click', function closePicker(ev) {
      if (!picker.contains(ev.target) && ev.target !== anchor) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 0);
}

function updateReactionsInDOM(messageId, reactions) {
  const li = messagesEl.querySelector(`li[data-id="${messageId}"]`);
  if (!li) return;
  const existing = li.querySelector('.reaction-summary');
  if (existing) existing.remove();

  if (reactions.length > 0) {
    const counts = {};
    reactions.forEach(r => { 
      counts[r.emoji] = (counts[r.emoji] || 0) + 1; 
    });
    const div = document.createElement('div');
    div.className = 'reaction-summary';
    Object.keys(counts).forEach(emoji => {
      div.innerHTML += `<span class="reaction-pill">${emoji} ${counts[emoji]}</span>`;
    });
    li.querySelector('.meta').insertAdjacentElement('afterend', div);
  }
}

socket.on('message reacted', ({ messageId, reactions }) => {
  updateReactionsInDOM(messageId, reactions);
});

const replyPreview = document.getElementById('reply-preview');
const replyPreviewText = document.getElementById('reply-preview-text');
const replyCancelBtn = document.getElementById('reply-cancel-btn');
let replyingTo = null;

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('reply-btn')) {
    const li = e.target.closest('li');
    const msg = JSON.parse(li.dataset.raw);
    replyingTo = e.target.dataset.id;
    const preview = msg.message || (msg.image ? '📷 Image' : (msg.audio ? '🎤 Voice message' : ''));
    replyPreviewText.textContent = `Replying to: ${preview}`;
    replyPreview.classList.remove('hidden');
    input.focus();
  }
});

replyCancelBtn.addEventListener('click', () => {
  replyingTo = null;
  replyPreview.classList.add('hidden');
});

const forwardModal = document.getElementById('forward-modal');
const forwardUserList = document.getElementById('forward-user-list');

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('forward-btn')) {
    const li = e.target.closest('li');
    const msg = JSON.parse(li.dataset.raw);
    forwardUserList.innerHTML = '';

    allUsers.forEach(user => {
      const item = document.createElement('li');
      item.textContent = user.username;
      item.addEventListener('click', () => {
        socket.emit('private message', {
          receiverId: user._id,
          message: msg.message || '',
          image: msg.image || '',
          audio: msg.audio || '',
          forwardedFrom: msg.sender?._id || msg.sender
        });
        forwardModal.classList.add('hidden');
      });
      forwardUserList.appendChild(item);
    });
    forwardModal.classList.remove('hidden');
  }
});

document.getElementById('forward-close-btn').addEventListener('click', () => {
  forwardModal.classList.add('hidden');
});

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('pin-btn')) {
    const id = e.target.dataset.id;
    const updated = await apiCall(`/api/messages/${id}/pin`, { 
      method: 'PUT' 
    });

    if (updated.error) { alert(updated.error); return; }
    socket.emit('pin message', { 
      messageId: id, receiverId: activeUser._id, isPinned: updated.isPinned 
    });
    e.target.textContent = updated.isPinned ? 'Unpin' : 'Pin';
    loadPinnedMessages();
  }
});

async function loadPinnedMessages() {
  if (!activeUser) return;
  const pinned = await apiCall(`/api/messages/${activeUser._id}/pinned`);
  const pinnedBar = document.getElementById('pinned-bar');
  if (!pinned || pinned.length === 0) {
    pinnedBar.classList.add('hidden');
    pinnedBar.innerHTML = '';
    return;
  }
  pinnedBar.classList.remove('hidden');
  pinnedBar.innerHTML = pinned.map(m => `📌 ${escapeHtml(m.message || 
    (m.image ? 'Image' : 'Voice message'))}`).join(' &nbsp;|&nbsp; ');
}

socket.on('message pinned', ({ messageId, isPinned }) => {
  const li = messagesEl.querySelector(`li[data-id="${messageId}"]`);
  if (li) {
    const pinBtn = li.querySelector('.pin-btn');
    if (pinBtn) pinBtn.textContent = isPinned ? 'Unpin' : 'Pin';
  }
  loadPinnedMessages();
});

const themeToggleBtn = document.getElementById('theme-toggle-btn');
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
applyTheme(localStorage.getItem('theme') || 'light');

themeToggleBtn.addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', current);
  applyTheme(current);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeUser) return;
  const text = input.value.trim();
  let imageUrl = '';

  if (imageInput.files[0]) {
    const formData = new FormData();
    formData.append('image', imageInput.files[0]);
    const res = await fetch('/api/messages/upload', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}` 
      },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Image upload failed');
      return;
    }
    imageUrl = data.imageUrl;
    imageInput.value = '';
  }

  if (!text && !imageUrl) return;

  socket.emit('private message', { 
    receiverId: activeUser._id, message: text, image: imageUrl, replyTo: replyingTo 
  });
  input.value = '';
  replyingTo = null;
  replyPreview.classList.add('hidden');
  socket.emit('typing', { receiverId: activeUser._id, isTyping: false });
});

const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('hidden');
});

emojiPicker.addEventListener('emoji-click', (event) => {
  const emoji = event.detail.unicode;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const text = input.value;
  input.value = text.slice(0, start) + emoji + text.slice(end);
  input.focus();
  input.selectionStart = input.selectionEnd = start + emoji.length;
  emojiPicker.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
    emojiPicker.classList.add('hidden');
  }
});

const voiceBtn = document.getElementById('voice-btn');
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

voiceBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await sendVoiceMessage(audioBlob);
      };
      mediaRecorder.start();
      isRecording = true;
      voiceBtn.textContent = '⏹️';
      voiceBtn.classList.add('recording');
    } catch (err) {
      alert('Microphone access denied or unavailable');
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    voiceBtn.textContent = '🎤';
    voiceBtn.classList.remove('recording');
  }
});

async function sendVoiceMessage(audioBlob) {
  if (!activeUser) return;
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice-message.webm');
  const res = await fetch('/api/messages/upload-audio', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Voice message upload failed');
    return;
  }
  socket.emit('private message', { receiverId: activeUser._id, message: '', image: '', audio: data.audioUrl });
}

input.addEventListener('input', () => {
  if (!activeUser) return;
  socket.emit('typing', { receiverId: activeUser._id, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { receiverId: activeUser._id, isTyping: false });
  }, 1000);
});

socket.on('private message', (msg) => {
  const senderId = msg.sender?._id || msg.sender;
  const isActiveChat = activeUser && (
    (senderId === activeUser._id && msg.receiver === currentUser.id) ||
    (senderId === currentUser.id && msg.receiver === activeUser._id)
  );
  if (isActiveChat) {
    renderMessage(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } 
  else if (senderId !== currentUser.id) {
    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    renderFriendsList();
  }
});

socket.on('message edited', ({ messageId, message }) => {
  const li = messagesEl.querySelector(`li[data-id="${messageId}"]`);
  if (li) {
    const textDiv = li.querySelector('.msg-text');
    if (textDiv) textDiv.textContent = message;
    const meta = li.querySelector('.meta');
    if (meta && !meta.textContent.includes('(edited)')) {
      meta.textContent += ' (edited)';
    }
  }
});

socket.on('error message', (msg) => {
  alert(msg);
});

socket.on('typing', ({ senderId, isTyping }) => {
  if (activeUser && senderId === activeUser._id) {
    typingIndicator.textContent = isTyping ? `${activeUser.username} is typing...` : '';
  }
});

socket.on('status change', ({ userId, isOnline }) => {
  const user = friendsList.find(u => u._id === userId);
  if (user) user.isOnline = isOnline;
  renderFriendsList();
  if (activeUser && activeUser._id === userId) 
    activeUser.isOnline = isOnline;
});

socket.on('friendRequest', async () => {
  await loadPendingRequests();
});

socket.on('friendAccepted', async () => {
  await loadFriends();
  await loadFriendStatuses();
});

socket.on('friendRejected', async () => {
  // no UI action needed on sender side beyond an optional toast
});

socket.on('friendRemoved', async ({ userId }) => {
  friendsList = friendsList.filter(f => f._id !== userId);
  renderFriendsList();
  if (activeUser && activeUser._id === userId) {
    activeUser = null;
    chatWithEl.textContent = 'Select a user to chat';
    messagesEl.innerHTML = '';
  }
});

socket.on('friendCancelled', async () => {
  await loadFriendStatuses();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await apiCall('/api/auth/logout', { method: 'POST' });
  localStorage.clear();
  window.location.href = '/login.html';
});


profileBtn.addEventListener('click', async () => {
  const profile = await apiCall('/api/users/profile');
  profileUsernameInput.value = profile.username;
  profileAvatarInput.value = profile.avatar || '';
  profileModal.classList.remove('hidden');
});

document.getElementById('profile-close-btn').addEventListener('click', () => {
  profileModal.classList.add('hidden');
});

document.getElementById('profile-save-btn').addEventListener('click', async () => {
  const updated = await apiCall('/api/users/profile', {
    method: 'PUT',
    body: JSON.stringify({
      username: profileUsernameInput.value.trim(),
      avatar: profileAvatarInput.value.trim()
    })
  });
  currentUser.username = updated.username;
  currentUser.avatar = updated.avatar;
  localStorage.setItem('user', JSON.stringify(currentUser));
  document.getElementById('my-username').textContent = updated.username;
  profileModal.classList.add('hidden');const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !currentUser) {
  window.location.href = '/login.html';
}

document.getElementById('my-username').textContent = currentUser.username;

const socket = io({ auth: { token } });

const userListEl = document.getElementById('user-list');
const messagesEl = document.getElementById('messages');
const chatWithEl = document.getElementById('chat-with');
const form = document.getElementById('form');
const input = document.getElementById('input');
const searchInput = document.getElementById('search-input');
const typingIndicator = document.getElementById('typing-indicator');
const imageInput = document.getElementById('image-input');

const profileBtn = document.getElementById('profile-btn');
const profileModal = document.getElementById('profile-modal');
const profileUsernameInput = document.getElementById('profile-username');
const profileAvatarInput = document.getElementById('profile-avatar');

const searchResultsEl = document.getElementById('search-results');
const pendingToggle = document.getElementById('pending-requests-toggle');
const pendingCount = document.getElementById('pending-count');
const pendingPanel = document.getElementById('pending-panel');
const pendingPanelClose = document.getElementById('pending-panel-close');
const pendingListEl = document.getElementById('pending-list');

let activeUser = null;      //{_id, username, isOnline}
let allUsers = [];
let typingTimeout;

async function apiCall(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json();
  if (!res.ok) return { 
    error: data.error || 'Request failed' };
  return data;
}

let friendsList = [];
let unreadCounts = {}; // userId -> count
let friendStatuses = { friends: [], sent: [], received: [] };

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

function renderFriendsList() {
  userListEl.innerHTML = '';
  friendsList.forEach(user => {
    const li = document.createElement('li');
    li.dataset.id = user._id;
    const unread = unreadCounts[user._id] || 0;
    li.innerHTML = `
      <div class="friend-info">
        <span>${escapeHtml(user.username)}</span>
        <span class="friend-lastseen">${user.isOnline ? 'Online' : `Last seen ${timeAgo(user.lastSeen)}`}</span>
      </div>
      <div>
        <span class="status-dot ${user.isOnline ? 'online' : ''}"></span>
        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
      </div>`;
    if (activeUser && activeUser._id === user._id) li.classList.add('active');
    userListEl.appendChild(li);
  });
}

userListEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;

  const userId = li.dataset.id;
  const user = friendsList.find(u => u._id === userId);
  if (!user) return;
  unreadCounts[userId] = 0;
  selectUser(user);
});

async function loadFriends() {
  friendsList = await apiCall('/api/friends');
  renderFriendsList();
}

async function loadFriendStatuses() {
  friendStatuses = await apiCall('/api/friends/statuses');
}

function getRelationshipButton(user) {
  if (friendStatuses.friends.includes(user._id)) {
    return `<button class="friend-action-btn friends" disabled>Friends ✓</button>`;
  }
  const sent = friendStatuses.sent.find(s => s.userId === user._id);
  if (sent) {
    return `<button class="friend-action-btn sent" disabled>Request Sent</button>`;
  }
  const received = friendStatuses.received.find(r => r.userId === user._id);
  if (received) {
    return `<button class="friend-action-btn accept" data-request-id="${received.requestId}" data-accept-user="${user._id}">Accept Request</button>`;
  }
  return `<button class="friend-action-btn add" data-add-user="${user._id}">+ Add Friend</button>`;
}

function renderSearchResults(users) {
  searchResultsEl.innerHTML = '';
  searchResultsEl.classList.remove('hidden');
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(user.username)}</span>${getRelationshipButton(user)}`;
    searchResultsEl.appendChild(li);
  });
}

searchInput.addEventListener('input', async () => {
  const q = searchInput.value.trim();
  if (!q) {
    searchResultsEl.classList.add('hidden');
    searchResultsEl.innerHTML = '';
    return;
  }
  await loadFriendStatuses();
  const results = await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`);
  renderSearchResults(results);
});

searchResultsEl.addEventListener('click', async (e) => {
  if (e.target.dataset.addUser) {
    const receiverId = e.target.dataset.addUser;
    const request = await apiCall('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ receiverId })
    });
    if (request.error) { alert(request.error); return; }
    socket.emit('friend request sent', { receiverId, request });
    await loadFriendStatuses();
    const q = searchInput.value.trim();
    if (q) renderSearchResults(await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`));
  }

  if (e.target.dataset.requestId && e.target.dataset.acceptUser) {
    const requestId = e.target.dataset.requestId;
    const senderId = e.target.dataset.acceptUser;
    const updated = await apiCall(`/api/friends/request/${requestId}/accept`, { method: 'PUT' });
    if (updated.error) { alert(updated.error); return; }
    socket.emit('friend request accepted', { senderId, receiverId: currentUser.id, request: updated });
    await loadFriendStatuses();
    await loadFriends();
    const q = searchInput.value.trim();
    if (q) renderSearchResults(await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`));
  }
});

async function loadPendingRequests() {
  const requests = await apiCall('/api/friends/requests/pending');
  renderPendingList(requests);
  return requests;
}

function renderPendingList(requests) {
  pendingListEl.innerHTML = '';
  if (requests.length === 0) {
    pendingCount.classList.add('hidden');
  } else {
    pendingCount.textContent = requests.length;
    pendingCount.classList.remove('hidden');
  }
  requests.forEach(req => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(req.sender.username)}</span>
      <div class="pending-actions">
        <button class="accept-btn" data-request-id="${req._id}" data-sender-id="${req.sender._id}">Accept</button>
        <button class="reject-btn" data-request-id="${req._id}">Reject</button>
      </div>`;
    pendingListEl.appendChild(li);
  });
}

pendingToggle.addEventListener('click', async () => {
  await loadPendingRequests();
  pendingPanel.classList.remove('hidden');
});

pendingPanelClose.addEventListener('click', () => {
  pendingPanel.classList.add('hidden');
});

pendingListEl.addEventListener('click', async (e) => {
  const requestId = e.target.dataset.requestId;
  if (!requestId) return;

  if (e.target.classList.contains('accept-btn')) {
    const senderId = e.target.dataset.senderId;
    const updated = await apiCall(`/api/friends/request/${requestId}/accept`, { method: 'PUT' });
    if (updated.error) { alert(updated.error); return; }
    socket.emit('friend request accepted', { senderId, receiverId: currentUser.id, request: updated });
    await loadFriends();
    await loadPendingRequests();
  }

  if (e.target.classList.contains('reject-btn')) {
    const updated = await apiCall(`/api/friends/request/${requestId}/reject`, { method: 'PUT' });
    if (updated.error) { alert(updated.error); return; }
    socket.emit('friend request rejected', { senderId: updated.sender, requestId });
    await loadPendingRequests();
  }
});

async function selectUser(user) {
  activeUser = user;
  chatWithEl.textContent = user.username;
  renderFriendsList();

  const messages = await apiCall(`/api/messages/${user._id}`);
  messagesEl.innerHTML = '';
  messages.forEach(renderMessage);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  loadPinnedMessages();
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🥰'];

function renderMessage(msg) {
  const li = document.createElement('li');
  const isOwn = msg.sender === currentUser.id || msg.sender?._id === currentUser.id;
  li.className = isOwn ? 'own' : 'other';
  li.dataset.id = msg._id;
  li.dataset.raw = JSON.stringify(msg);

  let content = '';

  if (msg.forwardedFrom) {
    content += `<div class="forwarded-label">↪ Forwarded</div>`;
  }
  if (msg.replyTo) {
    const replyText = msg.replyTo.message || (msg.replyTo.image ? '📷 Image' : (msg.replyTo.audio ? '🎤 Voice message' : ''));
    content += `<div class="reply-quote">${escapeHtml(replyText)}</div>`;
  }
  if (msg.message) content += `<div class="msg-text">${escapeHtml(msg.message)}</div>`;
  if (msg.image) content += `<img src="${msg.image}" />`;
  if (msg.audio) {
    content += `
      <div class="voice-message">
        <audio class="voice-audio" src="${msg.audio}" controls></audio>
        <div class="speed-controls">
          <button type="button" class="speed-btn active" data-speed="1">1x</button>
          <button type="button" class="speed-btn" data-speed="1.5">1.5x</button>
          <button type="button" class="speed-btn" data-speed="2">2x</button>
        </div>
      </div>`;
  }

  content += `<span class="meta">${
  new Date(msg.timestamp).toLocaleString()}${msg.isEdited ? ' (edited)' : ''}${msg.isPinned ? ' 📌' : ''}
  </span>`;

  if (msg.reactions && msg.reactions.length > 0) {
    const counts = {};
    msg.reactions.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    content += `<div class="reaction-summary">`;
    Object.keys(counts).forEach(emoji => {
      content += `<span class="reaction-pill">${emoji} ${counts[emoji]}</span>`;
    });
    content += `</div>`;
  }

  content += `<div class="msg-actions">`;
  content += `<span class="react-btn" data-id="${msg._id}">😊</span>`;
  content += `<span class="reply-btn" data-id="${msg._id}">Reply</span>`;
  content += `<span class="forward-btn" data-id="${msg._id}">Forward</span>`;
  content += `<span class="pin-btn" data-id="${msg._id}">${msg.isPinned ? 'Unpin' : 'Pin'}</span>`;
  if (isOwn && !msg.isDeleted) {
    content += `<span class="delete-btn" data-id="${msg._id}">Delete</span>`;
    if (msg.message && !msg.image && !msg.audio) {
      content += `<span class="edit-btn" data-id="${msg._id}">Edit</span>`;
    }
  }
  content += `</div>`;

  li.innerHTML = content;
  messagesEl.appendChild(li);
}

function renderMessageInPlace(msg, li) {
  const isOwn = msg.sender === currentUser.id || msg.sender?._id === currentUser.id;
  li.className = isOwn ? 'own' : 'other';
  li.dataset.id = msg._id;
  let content = '';
  if (msg.message) content += `<div class="msg-text">${escapeHtml(msg.message)}</div>`;
  if (msg.image) content += `<img src="${msg.image}" />`;
  content += `<span class="meta">${new Date(msg.timestamp).toLocaleString()}${msg.isEdited ? ' (edited)' : ''}</span>`;
  if (isOwn && !msg.isDeleted) {
    content += `<span class="delete-btn" data-id="${msg._id}">Delete</span>`;
    if (msg.message && !msg.image) content += ` <span class="edit-btn" data-id="${msg._id}">Edit</span>`;
  }
  li.innerHTML = content;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('edit-btn')) {
    const id = e.target.dataset.id;
    const li = e.target.closest('li');
    const textDiv = li.querySelector('.msg-text');
    const oldText = textDiv.textContent;

    li.innerHTML = `
      <input type="text" class="edit-input" value="${oldText.replace(/"/g, '&quot;')}" />
      <button class="edit-save-btn" data-id="${id}">Save</button>
    `;
    li.querySelector('.edit-save-btn').addEventListener('click', async () => {
      const newText = li.querySelector('.edit-input').value.trim();
      if (!newText) return;
      const updated = await apiCall(`/api/messages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ message: newText })
      });
      if (updated.error) { alert(updated.error); return; }
      socket.emit('edit message', { messageId: id, receiverId: activeUser._id, message: newText });
      li.outerHTML = '';
      const newLi = document.createElement('li');
      messagesEl.appendChild(newLi);
      renderMessageInPlace(updated, newLi);
    });
  }
});

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    await apiCall(`/api/messages/${id}`, { method: 'DELETE' });
    const li = e.target.closest('li');
    li.innerHTML = `<div><em>This message was deleted</em></div>`;
  }
});

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('speed-btn')) {
    const speed = parseFloat(e.target.dataset.speed);
    const audioEl = e.target.closest('.voice-message').querySelector('audio');
    audioEl.playbackRate = speed;
    e.target.parentElement.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  }
});

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('react-btn')) {
    showReactionPicker(e.target, e.target.dataset.id);
  }
});

function showReactionPicker(anchor, messageId) {
  const old = document.getElementById('reaction-picker');
  if (old) old.remove();

  const picker = document.createElement('div');
  picker.id = 'reaction-picker';
  picker.className = 'reaction-picker';
  REACTION_EMOJIS.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.addEventListener('click', async () => {
      const updated = await apiCall(`/api/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
      if (updated.error) { 
        alert(updated.error); 
        return; 
      }
      socket.emit('react message', { 
        messageId, receiverId: activeUser._id, reactions: updated.reactions 
      });
      updateReactionsInDOM(messageId, updated.reactions);
      picker.remove();
    });
    picker.appendChild(span);
  });
  document.body.appendChild(picker);
  const rect = anchor.getBoundingClientRect();
  picker.style.top = `${rect.top + window.scrollY - 40}px`;
  picker.style.left = `${rect.left + window.scrollX}px`;

  setTimeout(() => {
    document.addEventListener('click', function closePicker(ev) {
      if (!picker.contains(ev.target) && ev.target !== anchor) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 0);
}

function updateReactionsInDOM(messageId, reactions) {
  const li = messagesEl.querySelector(`li[data-id="${messageId}"]`);
  if (!li) return;
  const existing = li.querySelector('.reaction-summary');
  if (existing) existing.remove();

  if (reactions.length > 0) {
    const counts = {};
    reactions.forEach(r => { 
      counts[r.emoji] = (counts[r.emoji] || 0) + 1; 
    });
    const div = document.createElement('div');
    div.className = 'reaction-summary';
    Object.keys(counts).forEach(emoji => {
      div.innerHTML += `<span class="reaction-pill">${emoji} ${counts[emoji]}</span>`;
    });
    li.querySelector('.meta').insertAdjacentElement('afterend', div);
  }
}

socket.on('message reacted', ({ messageId, reactions }) => {
  updateReactionsInDOM(messageId, reactions);
});

const replyPreview = document.getElementById('reply-preview');
const replyPreviewText = document.getElementById('reply-preview-text');
const replyCancelBtn = document.getElementById('reply-cancel-btn');
let replyingTo = null;

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('reply-btn')) {
    const li = e.target.closest('li');
    const msg = JSON.parse(li.dataset.raw);
    replyingTo = e.target.dataset.id;
    const preview = msg.message || (msg.image ? '📷 Image' : (msg.audio ? '🎤 Voice message' : ''));
    replyPreviewText.textContent = `Replying to: ${preview}`;
    replyPreview.classList.remove('hidden');
    input.focus();
  }
});

replyCancelBtn.addEventListener('click', () => {
  replyingTo = null;
  replyPreview.classList.add('hidden');
});

const forwardModal = document.getElementById('forward-modal');
const forwardUserList = document.getElementById('forward-user-list');

messagesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('forward-btn')) {
    const li = e.target.closest('li');
    const msg = JSON.parse(li.dataset.raw);
    forwardUserList.innerHTML = '';

    friendsList.forEach(user => {
      const item = document.createElement('li');
      item.textContent = user.username;
      item.addEventListener('click', () => {
        socket.emit('private message', {
          receiverId: user._id,
          message: msg.message || '',
          image: msg.image || '',
          audio: msg.audio || '',
          forwardedFrom: msg.sender?._id || msg.sender
        });
        forwardModal.classList.add('hidden');
      });
      forwardUserList.appendChild(item);
    });
    forwardModal.classList.remove('hidden');
  }
});

document.getElementById('forward-close-btn').addEventListener('click', () => {
  forwardModal.classList.add('hidden');
});

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('pin-btn')) {
    const id = e.target.dataset.id;
    const updated = await apiCall(`/api/messages/${id}/pin`, { 
      method: 'PUT' 
    });

    if (updated.error) { alert(updated.error); return; }
    socket.emit('pin message', { 
      messageId: id, receiverId: activeUser._id, isPinned: updated.isPinned 
    });
    e.target.textContent = updated.isPinned ? 'Unpin' : 'Pin';
    loadPinnedMessages();
  }
});

async function loadPinnedMessages() {
  if (!activeUser) return;
  const pinned = await apiCall(`/api/messages/${activeUser._id}/pinned`);
  const pinnedBar = document.getElementById('pinned-bar');
  if (!pinned || pinned.length === 0) {
    pinnedBar.classList.add('hidden');
    pinnedBar.innerHTML = '';
    return;
  }
  pinnedBar.classList.remove('hidden');
  pinnedBar.innerHTML = pinned.map(m => `📌 ${escapeHtml(m.message || 
    (m.image ? 'Image' : 'Voice message'))}`).join(' &nbsp;|&nbsp; ');
}

socket.on('message pinned', ({ messageId, isPinned }) => {
  const li = messagesEl.querySelector(`li[data-id="${messageId}"]`);
  if (li) {
    const pinBtn = li.querySelector('.pin-btn');
    if (pinBtn) pinBtn.textContent = isPinned ? 'Unpin' : 'Pin';
  }
  loadPinnedMessages();
});

const themeToggleBtn = document.getElementById('theme-toggle-btn');
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
applyTheme(localStorage.getItem('theme') || 'light');

themeToggleBtn.addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', current);
  applyTheme(current);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeUser) return;
  const text = input.value.trim();
  let imageUrl = '';

  if (imageInput.files[0]) {
    const formData = new FormData();
    formData.append('image', imageInput.files[0]);
    const res = await fetch('/api/messages/upload', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}` 
      },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Image upload failed');
      return;
    }
    imageUrl = data.imageUrl;
    imageInput.value = '';
  }

  if (!text && !imageUrl) return;

  socket.emit('private message', { 
    receiverId: activeUser._id, message: text, image: imageUrl, replyTo: replyingTo 
  });
  input.value = '';
  replyingTo = null;
  replyPreview.classList.add('hidden');
  socket.emit('typing', { receiverId: activeUser._id, isTyping: false });
});

const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('hidden');
});

emojiPicker.addEventListener('emoji-click', (event) => {
  const emoji = event.detail.unicode;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const text = input.value;
  input.value = text.slice(0, start) + emoji + text.slice(end);
  input.focus();
  input.selectionStart = input.selectionEnd = start + emoji.length;
  emojiPicker.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
    emojiPicker.classList.add('hidden');
  }
});

const voiceBtn = document.getElementById('voice-btn');
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

voiceBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await sendVoiceMessage(audioBlob);
      };
      mediaRecorder.start();
      isRecording = true;
      voiceBtn.textContent = '⏹️';
      voiceBtn.classList.add('recording');
    } catch (err) {
      alert('Microphone access denied or unavailable');
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    voiceBtn.textContent = '🎤';
    voiceBtn.classList.remove('recording');
  }
});

async function sendVoiceMessage(audioBlob) {
  if (!activeUser) return;
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice-message.webm');
  const res = await fetch('/api/messages/upload-audio', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Voice message upload failed');
    return;
  }
  socket.emit('private message', { receiverId: activeUser._id, message: '', image: '', audio: data.audioUrl });
}

input.addEventListener('input', () => {
  if (!activeUser) return;
  socket.emit('typing', { receiverId: activeUser._id, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { receiverId: activeUser._id, isTyping: false });
  }, 1000);
});

socket.on('private message', (msg) => {
  const senderId = msg.sender?._id || msg.sender;
  const isActiveChat = activeUser && (
    (senderId === activeUser._id && msg.receiver === currentUser.id) ||
    (senderId === currentUser.id && msg.receiver === activeUser._id)
  );
  if (isActiveChat) {
    renderMessage(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } 
  else if (senderId !== currentUser.id) {
    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    renderFriendsList();
  }
});

socket.on('message edited', ({ messageId, message }) => {
  const li = messagesEl.querySelector(`li[data-id="${messageId}"]`);
  if (li) {
    const textDiv = li.querySelector('.msg-text');
    if (textDiv) textDiv.textContent = message;
    const meta = li.querySelector('.meta');
    if (meta && !meta.textContent.includes('(edited)')) {
      meta.textContent += ' (edited)';
    }
  }
});

socket.on('error message', (msg) => {
  alert(msg);
});

socket.on('typing', ({ senderId, isTyping }) => {
  if (activeUser && senderId === activeUser._id) {
    typingIndicator.textContent = isTyping ? `${activeUser.username} is typing...` : '';
  }
});

socket.on('status change', ({ userId, isOnline }) => {
  const user = friendsList.find(u => u._id === userId);
  if (user) user.isOnline = isOnline;
  renderFriendsList();
  if (activeUser && activeUser._id === userId) activeUser.isOnline = isOnline;
});

socket.on('friendRequest', async () => {
  await loadPendingRequests();
});

socket.on('friendAccepted', async () => {
  await loadFriends();
  await loadFriendStatuses();
});

socket.on('friendRejected', async () => {
  // no UI action needed on sender side beyond an optional toast
});

socket.on('friendRemoved', async ({ userId }) => {
  friendsList = friendsList.filter(f => f._id !== userId);
  renderFriendsList();
  if (activeUser && activeUser._id === userId) {
    activeUser = null;
    chatWithEl.textContent = 'Select a user to chat';
    messagesEl.innerHTML = '';
  }
});

socket.on('friendCancelled', async () => {
  await loadFriendStatuses();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await apiCall('/api/auth/logout', { method: 'POST' });
  localStorage.clear();
  window.location.href = '/login.html';
});


profileBtn.addEventListener('click', async () => {
  const profile = await apiCall('/api/users/profile');
  profileUsernameInput.value = profile.username;
  profileAvatarInput.value = profile.avatar || '';
  profileModal.classList.remove('hidden');
});

document.getElementById('profile-close-btn').addEventListener('click', () => {
  profileModal.classList.add('hidden');
});

document.getElementById('profile-save-btn').addEventListener('click', async () => {
  const updated = await apiCall('/api/users/profile', {
    method: 'PUT',
    body: JSON.stringify({
      username: profileUsernameInput.value.trim(),
      avatar: profileAvatarInput.value.trim()
    })
  });
  currentUser.username = updated.username;
  currentUser.avatar = updated.avatar;
  localStorage.setItem('user', JSON.stringify(currentUser));
  document.getElementById('my-username').textContent = updated.username;
  profileModal.classList.add('hidden');
});
});

loadFriends();
loadFriendStatuses();
loadPendingRequests();