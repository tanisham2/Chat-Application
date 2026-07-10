const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

const onlineUsers = new Map();             //userId -> socketId

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(
      new Error('Authentication error')
    );
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } 
    catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId);

    await User.findByIdAndUpdate(socket.userId, { 
        isOnline: true 
      });
    io.emit('status change', { 
      userId: socket.userId, 
      isOnline: true 
    });

    socket.on('private message', async ({ receiverId, message, image, audio, replyTo, forwardFrom }) => {
      try {
        const newMessage = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          message: message || '',
          image: image || '',
          audio: audio || '',
          replyTo: replyTo || null,
          forwardedFrom: forwardFrom || null
        });
        const populated = await newMessage.populate([
          { path: 'replyTo', select: 'message image audio sender' },
          { path: 'forwardedFrom', select: 'username' }
        ]);
        
        io.to(receiverId).to(socket.userId).emit('private message', populated);
      }
      catch (err) {
        socket.emit('error message', 'Failed to send message');
      }
    });

    socket.on('react message', ({ messageId, receiverId, reactions }) => {
      io.to(receiverId).to(socket.userId).emit('message reacted', { 
        messageId, reactions 
      });
    });

    socket.on('pin message', ({ messageId, receiverId, isPinned }) => {
      io.to(receiverId).to(socket.userId).emit('message pinned', { 
        messageId, isPinned 
      });
    });

    socket.on('typing', ({ receiverId, isTyping }) => {
      io.to(receiverId).emit('typing', { 
        senderId: socket.userId, isTyping 
      });
    });

    socket.on('edit message', ({ messageId, receiverId, message }) => {
      io.to(receiverId).to(socket.userId).emit('message edited', { messageId, message });
    });

    socket.on('disconnect', async () => {
      onlineUsers.delete(socket.userId);
      await User.findByIdAndUpdate(socket.userId, { 
        isOnline: false, 
        lastSeen: new Date() 
      });
      
      io.emit('status change', { 
        userId: socket.userId, 
        isOnline: false, 
        lastSeen: new Date() 
      });
    });
  });
};