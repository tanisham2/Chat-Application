const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }
    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    user.isOnline = true;
    await user.save();
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { isOnline: false, lastSeen: new Date() });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during logout' });
  }
};