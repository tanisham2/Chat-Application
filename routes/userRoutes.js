const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { getProfile, updateProfile, getAllUsers, searchUsers } = require('../controllers/userController');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/', protect, getAllUsers);
router.get('/search', protect, searchUsers);

module.exports = router;