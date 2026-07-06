const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Set(['general', 'random']);

const usersInRooms = new Map();
const typingUsers = new Map();

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

       // Initialize user data for the room
     if (!usersInRooms.has(room)) {
         usersInRooms.set(room, new Map());
         typingUsers.set(room, new Set());
     }

     // Add user to room
     usersInRooms.get(room).set(socket.id, {
         username: socket.username,
         id: socket.id
     });
    
     // Send updated user list to room
     updateUserList(room);
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
    
    // Handle typing status
   socket.on('typing', (isTyping) => {
     const room = Array.from(socket.rooms).find(r => r !== socket.id);
     if (!room) return;
    
     if (isTyping) {
         typingUsers.get(room).add(socket.username);
     } 
     else {
         typingUsers.get(room).delete(socket.username);
     }
    
     // Notify room about typing users
     io.to(room).emit('typing users', Array.from(typingUsers.get(room)));
  });

   // Handle disconnection
   socket.on('disconnect', () => {
     // Remove from all rooms
     Array.from(usersInRooms.entries()).forEach(([room, users]) => {
         if (users.has(socket.id)) {
            users.delete(socket.id);
            typingUsers.get(room)?.delete(socket.username);
                updateUserList(room);
            }
        });
    });
});

      // Helper function to update user list for a room
   function updateUserList(room) {
     const users = Array.from(usersInRooms.get(room)?.values() || []);
     io.to(room).emit('user list', {
         room: room,
         users: users.map(u => ({
            username: u.username,
            isTyping: typingUsers.get(room)?.has(u.username) || false
         }))
     });
   }

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});