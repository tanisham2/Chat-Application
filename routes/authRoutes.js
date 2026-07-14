const express = require('express');
const router = express.Router();
const multer = require('multer');
const { register, login, logout, forgotPassword, resetPassword, verifyOtp } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `avatar-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

module.exports = router;