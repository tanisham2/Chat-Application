const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
;  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');

  //handle new messages
  socket.on('chat message', (msg) => {
    console.log('Message received:', msg);
      io.emit('chat message', msg);
    });

  //handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});