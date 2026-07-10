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
  return res.json();
}

function renderUserList(users) {
  userListEl.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.dataset.id = user._id;
    li.innerHTML = `<span>${user.username}</span><span class="status-dot ${user.isOnline ? 'online' : ''}"></span>`;
    if (activeUser && activeUser._id === user._id) li.classList.add('active');
    li.addEventListener('click', () => selectUser(user));
    userListEl.appendChild(li);
  });
}

async function loadUsers() {
  allUsers = await apiCall('/api/users');
  renderUserList(allUsers);
}

searchInput.addEventListener('input', async () => {
  const q = searchInput.value.trim();
  if (!q) return renderUserList(allUsers);
  const results = await apiCall(`/api/users/search?q=${encodeURIComponent(q)}`);
  renderUserList(results);
});

async function selectUser(user) {
  activeUser = user;
  chatWithEl.textContent = user.username;
  renderUserList(allUsers);
  const messages = await apiCall(`/api/messages/${user._id}`);
  messagesEl.innerHTML = '';
  messages.forEach(renderMessage);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessage(msg) {
  const li = document.createElement('li');
  const isOwn = msg.sender === currentUser.id || msg.sender?._id === currentUser.id;
  li.className = isOwn ? 'own' : 'other';
  li.dataset.id = msg._id;

  let content = '';
  if (msg.message) {
    content += `<div class="msg-text">${escapeHtml(msg.message)}</div>`;
  }
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

  content += `<span class="meta">${new Date(msg.timestamp).toLocaleString()}${msg.isEdited ? ' (edited)' : ''}</span>`;
  if (isOwn && !msg.isDeleted) {
    content += `<span class="delete-btn" data-id="${msg._id}">Delete</span>`;
    if (msg.message && !msg.image) {
      content += ` <span class="edit-btn" data-id="${msg._id}">Edit</span>`;
    }
  }
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

  socket.emit('private message', { receiverId: activeUser._id, message: text, image: imageUrl });
  input.value = '';
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
  if (!activeUser) return;
  const isRelevant =
    (msg.sender === activeUser._id && msg.receiver === currentUser.id) ||
    (msg.sender === currentUser.id && msg.receiver === activeUser._id);
  if (isRelevant) {
    renderMessage(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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

socket.on('typing', ({ senderId, isTyping }) => {
  if (activeUser && senderId === activeUser._id) {
    typingIndicator.textContent = isTyping ? `${activeUser.username} is typing...` : '';
  }
});

socket.on('status change', ({ userId, isOnline }) => {
  const user = allUsers.find(u => u._id === userId);
  if (user) user.isOnline = isOnline;
  renderUserList(allUsers);
  if (activeUser && activeUser._id === userId) activeUser.isOnline = isOnline;
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

loadUsers();