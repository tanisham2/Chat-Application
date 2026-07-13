const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');

//send friend request
exports.sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (receiverId === req.userId) {
      return res.status(400).json({ 
        error: 'Cannot send a request to yourself' 
    });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ 
        error: 'User not found' 
    });

    const sender = await User.findById(req.userId);
    if (sender.friends.includes(receiverId)) {
      return res.status(400).json({ 
        error: 'Already friends' 
    });
    }

    const existing = await FriendRequest.findOne({
      $or: [
        { sender: req.userId, receiver: receiverId },
        { sender: receiverId, receiver: req.userId }
      ],
      status: 'pending'
    });
    if (existing) {
      return res.status(400).json({ 
        error: 'A pending request already exists' 
    });
    }

    const request = await FriendRequest.create({ 
        sender: req.userId, 
        receiver: receiverId 
    });
    res.status(201).json(request);
  } 
  catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: 'Request already exists' 
      });
    }
    res.status(500).json({ 
        error: 'Server error sending friend request' 
    });
  }
};

//accept friend request
exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ 
        error: 'Request not found' });
    if (request.receiver.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'Not authorized to accept this request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Request already resolved' });
    }

    request.status = 'accepted';
    await request.save();

    await User.findByIdAndUpdate(request.sender, { 
        $addToSet: { 
            friends: request.receiver } 
        });
    await User.findByIdAndUpdate(request.receiver, { 
        $addToSet: { friends: request.sender } 
        });

    res.json(request);
  } 
  catch (err) {
    res.status(500).json({ 
        error: 'Server error accepting friend request' });
  }
};

//reject friend request
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ 
        error: 'Request not found' });
    if (request.receiver.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'Not authorized to reject this request' });
    }
    request.status = 'rejected';
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ 
        error: 'Server error rejecting friend request' });
  }
};

// Cancel a request you sent
exports.cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ 
        error: 'Request not found' 
    });
    if (request.sender.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'Not authorized to cancel this request' 
    });
    }
    await FriendRequest.findByIdAndDelete(requestId);
    res.json({ message: 'Request cancelled', requestId });
  } catch (err) {
    res.status(500).json({ error: 'Server error cancelling friend request' });
  }
};

//remove existing friend
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    await User.findByIdAndUpdate(req.userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: req.userId } });
    await FriendRequest.deleteMany({
      $or: [
        { sender: req.userId, receiver: friendId },
        { sender: friendId, receiver: req.userId }
      ]
    });
    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error removing friend' });
  }
};

//get my friends list
exports.getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', 'username isOnline lastSeen avatar');
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching friends' });
  }
};

//get pending requests received
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ receiver: req.userId, status: 'pending' })
      .populate('sender', 'username avatar');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching pending requests' });
  }
};

//get the relationship status between users
exports.getStatuses = async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const sentRequests = await FriendRequest.find({ sender: req.userId, status: 'pending' });
    const receivedRequests = await FriendRequest.find({ receiver: req.userId, status: 'pending' });

    res.json({
      friends: me.friends.map(id => id.toString()),
      sent: sentRequests.map(r => ({ requestId: r._id, userId: r.receiver.toString() })),
      received: receivedRequests.map(r => ({ requestId: r._id, userId: r.sender.toString() }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching friend statuses' });
  }
};