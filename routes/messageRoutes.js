const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const protect = require('../middleware/authMiddleware');
const { 
  getConversation, deleteMessage, uploadImage, editMessage, uploadAudio, getPinnedMessages, togglePin, reactToMessage 
} = require('../controllers/messageController');                         

const storage = multer.diskStorage({
  destination: (req, file, cb) => 
    cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => 
    cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/:userId', protect, getConversation);
router.delete('/:messageId', protect, deleteMessage);
router.post('/upload', protect, upload.single('image'), uploadImage);
router.put('/:messageId', protect, editMessage);
router.post('/upload-audio', protect, upload.single('audio'), uploadAudio);
router.get('/pinned/:userId', protect, getPinnedMessages);
router.put('/:messageId/pin', protect, togglePin);
router.post('/:messageId/react', protect, reactToMessage);

module.exports = router;