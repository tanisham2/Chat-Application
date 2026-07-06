const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

const onlineUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId);

    await User.findByIdAndUpdate(socket.userId, { isOnline: true });
    io.emit('status change', { userId: socket.userId, isOnline: true });

    socket.on('private message', async ({ receiverId, message, image }) => {
      try {
        const newMessage = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          message: message || '',
          image: image || ''
        });
        io.to(receiverId).to(socket.userId).emit('private message', newMessage);
      } catch (err) {
        socket.emit('error message', 'Failed to send message');
      }
    });

    socket.on('typing', ({ receiverId, isTyping }) => {
      io.to(receiverId).emit('typing', { senderId: socket.userId, isTyping });
    });

    socket.on('disconnect', async () => {
      onlineUsers.delete(socket.userId);
      await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() });
      io.emit('status change', { userId: socket.userId, isOnline: false, lastSeen: new Date() });
    });
  });
};