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