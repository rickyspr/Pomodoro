const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Om rummet är helt nytt, skapa det och sätt första läget till 'focus'
    if (!rooms[roomId]) {
        rooms[roomId] = { endTime: 0, nextMode: 'focus' };
    }

    // Om timern redan är igång när personen ansluter
    if (rooms[roomId].endTime > Date.now()) {
      // Vi räknar ut vad som körs just nu baserat på vad nästa läge är
      const currentMode = rooms[roomId].nextMode === 'break' ? 'focus' : 'break';
      socket.emit('timer-started', { endTime: rooms[roomId].endTime, mode: currentMode });
    } else {
      // Om timern står still, berätta för frontend vad som väntar härnäst
      socket.emit('timer-stopped', rooms[roomId].nextMode);
    }
  });

  socket.on('start-timer', (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = { endTime: 0, nextMode: 'focus' };
    
    // Förhindra att någon startar en ny timer om den redan är igång
    if (rooms[roomId].endTime > Date.now()) return;

    const mode = rooms[roomId].nextMode;
    // 25 minuter för fokus, 5 minuter för rast
    const duration = mode === 'focus' ? 5 * 1 * 1000 : 3 * 1 * 1000; 
    const endTime = Date.now() + duration;
    
    rooms[roomId].endTime = endTime;
    
    // Ändra nästa läge inför nästa knapptryck
    rooms[roomId].nextMode = mode === 'focus' ? 'break' : 'focus';

    // Skicka ut startsignalen OCH vilket läge som just startade
    io.to(roomId).emit('timer-started', { endTime, mode });
  });
});

server.listen(3000, () => {
  console.log(`Servern är igång på http://localhost:3000`);
});