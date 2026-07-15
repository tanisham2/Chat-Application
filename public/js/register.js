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
    avatarPreview.classList.add('has-image');
    avatarPreview.innerHTML = '<div class="avatar-overlay">Change</div>';
  };
  reader.readAsDataURL(file);
});

const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const registerBtn = document.getElementById('register-btn');
const banner = document.getElementById('banner');

const usernameError = document.getElementById('username-error');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const confirmPasswordError = document.getElementById('confirm-password-error');

document.getElementById('toggle-password').addEventListener('click', function () {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  this.textContent = isHidden ? '🙈' : '👁️';
});
document.getElementById('toggle-confirm-password').addEventListener('click', function () {
  const isHidden = confirmPasswordInput.type === 'password';
  confirmPasswordInput.type = isHidden ? 'text' : 'password';
  this.textContent = isHidden ? '🙈' : '👁️';
});

const bars = [
  document.getElementById('bar1'), 
  document.getElementById('bar2'), 
  document.getElementById('bar3'), 
  document.getElementById('bar4')];
const strengthLabel = document.getElementById('strength-label');
const strengthColors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71'];
const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

passwordInput.addEventListener('input', () => {
  const pw = passwordInput.value;
  const score = pw ? Math.max(scorePassword(pw), 1) : 0;
  bars.forEach((bar, i) => {
    bar.style.background = i < score ? strengthColors[score - 1] : '#eee';
  });
  strengthLabel.textContent = pw ? strengthLabels[score - 1] : '';
});

function showBanner(msg, type) {
  banner.textContent = msg;
  banner.className = `banner-msg show banner-${type}`;
}
function clearErrors() {
  [usernameError, emailError, passwordError, confirmPasswordError].forEach(el => el.textContent = '');
  [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach(el => el.classList.remove('input-error'));
  banner.classList.remove('show');
}
function setLoading(isLoading) {
  registerBtn.disabled = isLoading;
  registerBtn.innerHTML = isLoading
    ? '<span class="spinner"></span> Registering...'
    : 'Register';
}

registerBtn.addEventListener('click', async () => {
  clearErrors();
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  let hasError = false;
  if (!username) { 
    usernameError.textContent = 'Username is required'; 
    usernameInput.classList.add('input-error'); 
    hasError = true; 
  }
  if (!email) { 
    emailError.textContent = 'Email is required'; 
    emailInput.classList.add('input-error'); 
    hasError = true; 
  }
  if (!password || password.length < 6) { 
    passwordError.textContent = 'Password must be at least 6 characters'; 
    passwordInput.classList.add('input-error'); 
    hasError = true; 
  }
  if (password !== confirmPassword) { 
    confirmPasswordError.textContent = 'Passwords do not match'; 
    confirmPasswordInput.classList.add('input-error'); 
    hasError = true; 
  }
  if (hasError) return;

  const formData = new FormData();
  formData.append('username', username);
  formData.append('email', email);
  formData.append('password', password);
  if (selectedAvatarFile) formData.append('avatar', selectedAvatarFile);

  setLoading(true);
  try {
    const res = await fetch('/api/auth/register', { 
      method: 'POST', 
      body: formData 
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner(data.error || 'Registration failed', 'error');
      setLoading(false);
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/index.html';
  } 
  catch (err) {
    showBanner('Server error. Try again.', 'error');
    setLoading(false);
  }
});