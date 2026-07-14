const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendOtpEmail(toEmail, otp) {
  await transporter.sendMail({
    from: `"Chat App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your password reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Password Reset Request</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This OTP expires in 5 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `
  });
}

module.exports = { sendOtpEmail };