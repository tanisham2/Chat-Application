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
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching conversation' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    message.isDeleted = true;
    message.message = 'This message was deleted';
    message.image = '';
    await message.save();
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting message' });
  }
};

exports.uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
};

exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    const existing = await Message.findById(messageId);
    if (!existing) return res.status(404).json({ error: 'Message not found' });
    if (existing.sender.toString() !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }
    if (existing.isDeleted) {
      return res.status(400).json({ error: 'Cannot edit a deleted message' });
    }
    existing.message = message.trim();
    existing.isEdited = true;
    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: 'Server error editing message' });
  }
};