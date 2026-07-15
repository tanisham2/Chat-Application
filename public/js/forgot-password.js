const stepEmail = document.getElementById('step-email');
const stepOtp = document.getElementById('step-otp');
const stepReset = document.getElementById('step-reset');
const banner = document.getElementById('banner');

const circles = [null, 
  document.getElementById('step-circle-1'), 
  document.getElementById('step-circle-2'), 
  document.getElementById('step-circle-3')];
const lines = [null, 
  document.getElementById('line-1'),
   document.getElementById('line-2')];

let savedEmail = '';
let savedOtp = '';

function goToStep(n) {
  [stepEmail, stepOtp, stepReset].forEach(s => s.classList.remove('active'));
  if (n === 1) stepEmail.classList.add('active');
  if (n === 2) stepOtp.classList.add('active');
  if (n === 3) stepReset.classList.add('active');

  for (let i = 1; i <= 3; i++) {
    circles[i].classList.remove('active', 'done');
    if (i < n) circles[i].classList.add('done');
    if (i === n) circles[i].classList.add('active');
  }
  for (let i = 1; i <= 2; i++) {
    lines[i].classList.toggle('done', i < n);
  }
}

function showBanner(msg, type) {
  banner.textContent = msg;
  banner.className = `banner-msg show banner-${type}`;
}
function clearBanner() { banner.classList.remove('show'); }
function clearFieldError(id) { document.getElementById(id).textContent = ''; }

//send OTP
const emailInput = document.getElementById('email-input');
const sendOtpBtn = document.getElementById('send-otp-btn');

sendOtpBtn.addEventListener('click', async () => {
  clearBanner();
  clearFieldError('email-error');
  const email = emailInput.value.trim();
  if (!email) {
    document.getElementById('email-error').textContent = 'Email is required';
    emailInput.classList.add('input-error');
    return;
  }
  emailInput.classList.remove('input-error');

  sendOtpBtn.disabled = true;
  sendOtpBtn.innerHTML = '<span class="spinner"></span> Sending OTP...';

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner(data.error || 'Failed to send OTP', 'error');
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = 'Send OTP';
      return;
    }
    savedEmail = email;
    showBanner('OTP sent! Check your inbox.', 'success');
    goToStep(2);
  } 
  catch (err) {
    showBanner('Server error. Try again.', 'error');
  }
  sendOtpBtn.disabled = false;
  sendOtpBtn.textContent = 'Send OTP';
});

//verify OTP
const otpInput = document.getElementById('otp-input');
const verifyOtpBtn = document.getElementById('verify-otp-btn');

verifyOtpBtn.addEventListener('click', async () => {
  clearBanner();
  clearFieldError('otp-error');
  const otp = otpInput.value.trim();
  if (!otp) {
    document.getElementById('otp-error').textContent = 'Enter the OTP';
    otpInput.classList.add('input-error');
    return;
  }
  otpInput.classList.remove('input-error');
  verifyOtpBtn.disabled = true;
  verifyOtpBtn.innerHTML = '<span class="spinner"></span> Verifying...';

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: savedEmail, otp })
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner(data.error || 'Invalid OTP', 'error');
      verifyOtpBtn.disabled = false;
      verifyOtpBtn.textContent = 'Verify OTP';
      return;
    }
    savedOtp = otp;
    showBanner('OTP verified! Set your new password.', 'success');
    goToStep(3);
  } 
  catch (err) {
    showBanner('Server error. Try again.', 'error');
  }
  verifyOtpBtn.disabled = false;
  verifyOtpBtn.textContent = 'Verify OTP';
});

//reset password
const newPasswordInput = document.getElementById('new-password-input');
const confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
const resetPasswordBtn = document.getElementById('reset-password-btn');

document.getElementById('toggle-new-password').addEventListener('click', function () {
  const isHidden = newPasswordInput.type === 'password';
  newPasswordInput.type = isHidden ? 'text' : 'password';
  this.textContent = isHidden ? '🙈' : '👁️';
});
document.getElementById('toggle-confirm-new-password').addEventListener('click', function () {
  const isHidden = confirmNewPasswordInput.type === 'password';
  confirmNewPasswordInput.type = isHidden ? 'text' : 'password';
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

newPasswordInput.addEventListener('input', () => {
  const pw = newPasswordInput.value;
  const score = pw ? Math.max(scorePassword(pw), 1) : 0;
  bars.forEach((bar, i) => { bar.style.background = i < score ? strengthColors[score - 1] : '#eee'; });
  strengthLabel.textContent = pw ? strengthLabels[score - 1] : '';
});

resetPasswordBtn.addEventListener('click', async () => {
  clearBanner();
  clearFieldError('new-password-error');
  clearFieldError('confirm-new-password-error');

  const newPassword = newPasswordInput.value;
  const confirmNewPassword = confirmNewPasswordInput.value;
  let hasError = false;

  if (!newPassword || newPassword.length < 6) {
    document.getElementById('new-password-error').textContent = 'Password must be at least 6 characters';
    newPasswordInput.classList.add('input-error');
    hasError = true;
  }
  if (newPassword !== confirmNewPassword) {
    document.getElementById('confirm-new-password-error').textContent = 'Passwords do not match';
    confirmNewPasswordInput.classList.add('input-error');
    hasError = true;
  }
  if (hasError) return;

  resetPasswordBtn.disabled = true;
  resetPasswordBtn.innerHTML = '<span class="spinner"></span> Updating...';

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: savedEmail, 
        otp: savedOtp, newPassword 
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner(data.error || 'Failed to reset password', 'error');
      resetPasswordBtn.disabled = false;
      resetPasswordBtn.textContent = 'Update Password';
      return;
    }
    showBanner('Password updated! Redirecting to login...', 'success');
    setTimeout(() => { window.location.href = '/login.html'; }, 1500);
  } 
  catch (err) {
    showBanner('Server error. Try again.', 'error');
    resetPasswordBtn.disabled = false;
    resetPasswordBtn.textContent = 'Update Password';
  }
});