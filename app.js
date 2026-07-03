const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Set(['general', 'random']);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
;  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');

  // Store username with socket
  socket.username = 'Anonymous';
  
  // Handle username change
  socket.on('set username', (username) => {
    const oldUsername = socket.username;
    socket.username = username || 'Anonymous';
    io.emit('user joined', {
      oldUsername: oldUsername,
      newUsername: socket.username
    });
  });


socket.on('join room', (room) => {
    // Leave all rooms except the default one
    socket.rooms.forEach(r => {
      if (r !== socket.id) {
        socket.leave(r);
        socket.emit('left room', r);
      }
    });

    // Join the new room
    socket.join(room);
    socket.emit('joined room', room);

    // Notify others in the room
    socket.to(room).emit('room message', {
      username: 'System',
      message: `${socket.username} has joined the room`,
      timestamp: new Date().toISOString()
    });
  });

  // Handle room creation
  socket.on('create room', (roomName) => {
    if (!rooms.has(roomName)) {
      rooms.add(roomName);
      io.emit('room created', roomName);
    }
  });

  // Modify message handler to send to room
  socket.on('chat message', (data) => {
    const room = Array.from(socket.rooms).find(r => r !== socket.id) || 'general';

    io.to(room).emit('chat message', {
      username: socket.username,
      message: data.message,
      timestamp: new Date().toISOString(),
      room: room
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    io.emit('user left', { username: socket.username });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});