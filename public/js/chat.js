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

let activeUser = null; // { _id, username, isOnline }
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
  if (msg.message) content += `<div>${escapeHtml(msg.message)}</div>`;
  if (msg.image) content += `<img src="${msg.image}" />`;
  content += `<span class="meta">${new Date(msg.timestamp).toLocaleString()}</span>`;
  if (isOwn && !msg.isDeleted) {
    content += `<span class="delete-btn" data-id="${msg._id}">Delete</span>`;
  }
  li.innerHTML = content;
  messagesEl.appendChild(li);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

messagesEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    await apiCall(`/api/messages/${id}`, { method: 'DELETE' });
    const li = e.target.closest('li');
    li.innerHTML = `<div><em>This message was deleted</em></div>`;
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
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    imageUrl = data.imageUrl;
    imageInput.value = '';
  }

  if (!text && !imageUrl) return;

  socket.emit('private message', { receiverId: activeUser._id, message: text, image: imageUrl });
  input.value = '';
  socket.emit('typing', { receiverId: activeUser._id, isTyping: false });
});

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

loadUsers();