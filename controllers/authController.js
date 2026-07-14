const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/sendEmail');

const generateToken = (id) => {
  return jwt.sign({ id }, 
    process.env.JWT_SECRET, { 
      expiresIn: '7d' 
    });
};

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      });
    }
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username or email already in use' 
      });
    }
    const avatar = req.file ? `/uploads/${req.file.filename}` : '';
    const user = await User.create({ username, email, password, avatar });
    
    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar }
    });
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error during registration' 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }
    user.isOnline = true;
    await user.save();
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar }
    });
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error during login' 
    });
  }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { 
      isOnline: false, 
      lastSeen: new Date() 
    });
    res.json({ 
      message: 'Logged out successfully' 
    });
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error during logout' 
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) 
      return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) 
      return res.status(404).json({ error: 'No account with that email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000);             //5mins
    await user.save();

    await sendOtpEmail(email, otp);
    res.json({ message: 'OTP sent to your email' });
  } 
  catch (err) {
    res.status(500).json({ error: 'Server error sending OTP' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) 
      return res.status(400).json({ error: 'Email and OTP are required' });

    const user = await User.findOne({ email });
    if (!user || !user.resetOtp) 
      return res.status(400).json({ error: 'Invalid request' });
    if (user.resetOtp !== otp) 
      return res.status(400).json({ error: 'Incorrect OTP' });
    if (user.resetOtpExpiry < new Date()) 
      return res.status(400).json({ error: 'OTP expired' });

    res.json({ message: 'OTP verified' });
  }
  catch (err) {
    res.status(500).json({ error: 'Server error verifying OTP' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOtp) 
      return res.status(400).json({ error: 'Invalid request' });
    if (user.resetOtp !== otp) 
      return res.status(400).json({ error: 'Incorrect OTP' });
    if (user.resetOtpExpiry < new Date()) 
      return res.status(400).json({ error: 'OTP expired' });

    user.password = newPassword; 
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } 
  catch (err) {
    res.status(500).json({ error: 'Server error resetting password' });
  }
};