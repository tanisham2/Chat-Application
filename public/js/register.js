document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Registration failed';
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/index.html';
  } catch (err) {
    errorMsg.textContent = 'Server error. Try again.';
  }
});