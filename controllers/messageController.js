const Message = require('../models/Message');

exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId }
      ],
      isDeleted: false
    })
      .sort({ timestamp: 1 })
      .populate('replyTo', 'message image audio sender')
      .populate('forwardedFrom', 'username');
    res.json(messages);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error fetching conversation' 
    });
  }
}; 

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ 
      error: 'Message not found' 
    });
    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'You can only delete your own messages' 
      });
    }
    message.isDeleted = true;
    message.message = 'This message was deleted';
    message.image = '';
    await message.save();
    res.json({ 
      message: 'Message deleted' 
    });
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error deleting message' 
    });
  }
};

exports.uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ 
    error: 'No file uploaded' 
  });
  res.json({ imageUrl: `/uploads/${req.file.filename}` 
  });
};

exports.uploadAudio = async (req, res) => {
  if (!req.file) return res.status(400).json({ 
    error: 'No audio file uploaded' 
  });
  res.json({ audioUrl: `/uploads/${req.file.filename}` 
  });
};

exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        error: 'Message cannot be empty' 
      });
    }

    const existing = await Message.findById(messageId);
    if (!existing) return res.status(404).json({ 
      error: 'Message not found' 
    });
    if (existing.sender.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'You can only edit your own messages' });
    }
    if (existing.isDeleted) {
      return res.status(400).json({ 
        error: 'Cannot edit a deleted message' });
    }
    existing.message = message.trim();
    existing.isEdited = true;
    await existing.save();
    res.json(existing);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error editing message' });
  }
};

exports.getPinnedMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId }
      ],
      isPinned: true,
      isDeleted: false
    }).sort({ timestamp: 1 });
    res.json(messages);
  } 
  catch (err) {
    res.status(500).json({ error: 'Server error fetching pinned messages' });
  }
};

exports.togglePin = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.sender.toString() !== req.userId && message.receiver.toString() !== req.userId) {
      return res.status(403).json({ 
        error: 'Not authorized' 
      });
    }
    message.isPinned = !message.isPinned;
    await message.save();
    res.json(message);
  } 
  catch (err) {
    res.status(500).json({ error: 'Server error pinning message' });
  }
};

exports.reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) 
      return res.status(400).json({ 
        error: 'Emoji is required' 
      });
    const message = await Message.findById(messageId);
    if (!message) 
      return res.status(404).json({ 
        error: 'Message not found' 
    });

    const existingIndex = message.reactions.findIndex(
      r => r.user.toString() === req.userId && r.emoji === emoji
    );
    if (existingIndex !== -1) {
      message.reactions.splice(existingIndex, 1);
    } 
    else {
      message.reactions = message.reactions.filter(r => r.user.toString() !== req.userId);
      message.reactions.push({ user: req.userId, emoji });
    }
    await message.save();
    res.json(message);
  } 
  catch (err) {
    res.status(500).json({ 
      error: 'Server error reacting to message' 
    });
  }
};