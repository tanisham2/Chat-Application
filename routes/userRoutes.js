const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const protect = require('../middleware/authMiddleware');
const { getProfile, updateProfile, getAllUsers, searchUsers } = require('../controllers/userController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `avatar-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.get('/', protect, getAllUsers);
router.get('/search', protect, searchUsers);

module.exports = router;