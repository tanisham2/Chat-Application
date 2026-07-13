const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { sendRequest, acceptRequest, rejectRequest, cancelRequest, removeFriend, getFriends, getPendingRequests, getStatuses } 
= require('../controllers/friendController');

router.post('/request', protect, sendRequest);
router.put('/request/:requestId/accept', protect, acceptRequest);
router.put('/request/:requestId/reject', protect, rejectRequest);
router.delete('/request/:requestId', protect, cancelRequest);
router.delete('/:friendId', protect, removeFriend);
router.get('/', protect, getFriends);
router.get('/requests/pending', protect, getPendingRequests);
router.get('/statuses', protect, getStatuses);

module.exports = router;