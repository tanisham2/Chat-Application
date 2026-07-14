const stepEmail = document.getElementById('step-email');
const stepOtp = document.getElementById('step-otp');
const stepReset = document.getElementById('step-reset');
const errorMsg = document.getElementById('error-msg');
const successMsg = document.getElementById('success-msg');

let savedEmail = '';
let savedOtp = '';

function showError(msg) {
  errorMsg.textContent = msg;
  successMsg.textContent = '';
}
function showSuccess(msg) {
  successMsg.textContent = msg;
  errorMsg.textContent = '';
}

document.getElementById('send-otp-btn').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value.trim();
  if (!email) 
    return showError('Enter your email');

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
    },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok)
        return showError(data.error || 'Failed to send OTP');

    savedEmail = email;
    showSuccess('OTP sent to your email');
    stepEmail.classList.add('hidden');
    stepOtp.classList.remove('hidden');
  } 
  catch (err) {
    showError('Server error. Try again.');
  }
});

document.getElementById('verify-otp-btn').addEventListener('click', async () => {
  const otp = document.getElementById('otp-input').value.trim();
  if (!otp)
    return showError('Enter the OTP');

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ email: savedEmail, otp })
    });
    const data = await res.json();
    if (!res.ok) 
        return showError(data.error || 'Invalid OTP');

    savedOtp = otp;
    showSuccess('OTP verified — set your new password');
    stepOtp.classList.add('hidden');
    stepReset.classList.remove('hidden');
  } 
  catch (err) {
    showError('Server error. Try again.');
  }
});

document.getElementById('reset-password-btn').addEventListener('click', async () => {
  const newPassword = document.getElementById('new-password-input').value;
  if (!newPassword || newPassword.length < 6) {
    return showError('Password must be at least 6 characters');
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ email: savedEmail, otp: savedOtp, newPassword })
    });
    const data = await res.json();
    if (!res.ok) return showError(data.error || 'Failed to reset password');

    showSuccess('Password updated! Redirecting to login...');
    setTimeout(() => { window.location.href = '/login.html'; }, 1500);
  } 
  catch (err) {
    showError('Server error. Try again.');
  }
});