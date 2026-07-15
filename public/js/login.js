const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const banner = document.getElementById('banner');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const togglePasswordBtn = document.getElementById('toggle-password');

togglePasswordBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  togglePasswordBtn.textContent = isHidden ? '🙈' : '👁️';
});

function showBanner(msg, type) {
  banner.textContent = msg;
  banner.className = `banner-msg show banner-${type}`;
}
function clearErrors() {
  emailError.textContent = '';
  passwordError.textContent = '';
  emailInput.classList.remove('input-error');
  passwordInput.classList.remove('input-error');
  banner.classList.remove('show');
}
function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtn.innerHTML = isLoading
    ? '<span class="spinner"></span> Logging in...'
    : 'Login';
}

loginBtn.addEventListener('click', async () => {
  clearErrors();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let hasError = false;
  if (!email) { 
    emailError.textContent = 'Email is required'; 
    emailInput.classList.add('input-error'); 
    hasError = true; 
  }
  if (!password) { 
    passwordError.textContent = 'Password is required'; 
    passwordInput.classList.add('input-error'); 
    hasError = true; 
  }
  if (hasError) return;

  setLoading(true);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner(data.error || 'Login failed', 'error');
      setLoading(false);
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/index.html';
  } catch (err) {
    showBanner('Server error. Try again.', 'error');
    setLoading(false);
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});