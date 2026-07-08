const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ 
      error: 'User not found' 
    });
    res.json(user);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error fetching profile' 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { ...(username && { username }), ...(avatar && { avatar }) },
      { new: true }
    ).select('-password');
    res.json(user);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error updating profile' 
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select('-password');
    res.json(users);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error fetching users' 
    });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({
      _id: { $ne: req.userId },
      username: { $regex: q, $options: 'i' }
    }).select('-password');
    res.json(users);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error searching users' 
    });
  }
};