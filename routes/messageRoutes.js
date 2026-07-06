const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const protect = require('../middleware/authMiddleware');
const { getConversation, deleteMessage, uploadImage } = require('../controllers/messageController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/:userId', protect, getConversation);
router.delete('/:messageId', protect, deleteMessage);
router.post('/upload', protect, upload.single('image'), uploadImage);

module.exports = router;