const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');
let selectedAvatarFile = null;

avatarInput.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (!file) 
    return;
  selectedAvatarFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.style.backgroundImage = `url(${e.target.result})`;
    avatarPreview.textContent = '';
  };
  reader.readAsDataURL(file);
});

document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');

  const formData = new FormData();
  formData.append('username', username);
  formData.append('email', email);
  formData.append('password', password);
  if (selectedAvatarFile) formData.append('avatar', selectedAvatarFile);

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Registration failed';
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/index.html';
  } 
  catch (err) {
    errorMsg.textContent = 'Server error. Try again.';
  }
});