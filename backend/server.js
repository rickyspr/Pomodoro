require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// For gemini
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());

// For Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

function getMotivationalQuote(mode) {
    if (mode === 'focus') {
        const focusQuotes = [
            "Dags att stänga ute bruset. Fokus!",
            "Ett steg i taget. Du klarar detta.",
            "Djupt andetag. Nu kör vi 25 minuter magi.",
            "Inga distraktioner, bara resultat.",
            "Nu lägger vi i nästa växel!"
        ];
        // Slumpar fram ett av citaten
        return focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
    } else {
        const breakQuotes = [
            "Bra jobbat! Sträck på dig och hämta vatten.",
            "Hjärnan behöver vila för att växa. Pausa!",
            "Släpp skärmen med gott samvete en stund.",
            "Dags för en välförtjänt bensträckare.",
            "Andas ut. Du är grym."
        ];
        return breakQuotes[Math.floor(Math.random() * breakQuotes.length)];
    }
}

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 3000,   // Ping var 3:e sekund
    pingTimeout: 5000,    // Timeout efter 5s
    transports: ['websocket', 'polling']  // Tillåt både WebSocket och polling
});

const rooms = {};
const timers = {}; // Lagra aktiva timers för varje rum
const roomUsers = {}; // Spåra hur många användare i varje rum (antal)
const roomMembers = {}; // roomId -> Map<socket.id, { name, joinedAt }>

// Härled initialer ur ett namn: "Maja K" -> "MK", "Räv" -> "RÄ"
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Skicka ut aktuell deltagarlista till alla i rummet (host = först in)
function broadcastRoster(roomId) {
  const members = roomMembers[roomId];
  if (!members) return;
  const users = [...members.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((u, i) => ({ name: u.name, initials: initialsOf(u.name), host: i === 0 }));
  io.to(roomId).emit('room-users', users);
}

// Ta bort en socket ur ett rum och uppdatera listan
function removeFromRoom(socket, roomId) {
  const members = roomMembers[roomId];
  if (!members || !members.has(socket.id)) return;
  members.delete(socket.id);
  socket.leave(roomId);
  roomUsers[roomId] = members.size;
  broadcastRoster(roomId);
}

// Rensa gamla rum var 10:e minut
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(roomId => {
    // Ta bort rum som är tomma och timern är klar för länge sedan
    const memberCount = roomMembers[roomId] ? roomMembers[roomId].size : 0;
    if (memberCount === 0 && rooms[roomId].endTime + 3600000 < now) {
      if (timers[roomId]) clearTimeout(timers[roomId]);
      delete rooms[roomId];
      delete timers[roomId];
      delete roomUsers[roomId];
      delete roomMembers[roomId];
      console.log(`Rensade upp rum: ${roomId}`);
    }
  });
}, 600000); // 10 minuter

io.on('connection', (socket) => {
  socket.on('join-room', (payload) => {
    try {
      const roomId = typeof payload === 'string' ? payload : (payload && payload.roomId);
      if (!roomId) return;
      const name = (payload && typeof payload === 'object' && payload.name)
        ? (String(payload.name).slice(0, 40).trim() || 'Gäst')
        : 'Gäst';

      // Lämna ev. tidigare rum (om man byter rum på samma flik)
      if (socket.data.roomId && socket.data.roomId !== roomId) {
        removeFromRoom(socket, socket.data.roomId);
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = name;

      // Spåra deltagare
      if (!roomMembers[roomId]) roomMembers[roomId] = new Map();
      const existing = roomMembers[roomId].get(socket.id);
      roomMembers[roomId].set(socket.id, {
        name,
        joinedAt: existing ? existing.joinedAt : Date.now()
      });
      roomUsers[roomId] = roomMembers[roomId].size;

      // Om rummet är helt nytt, skapa det och sätt första läget till 'focus'
      if (!rooms[roomId]) {
          rooms[roomId] = { endTime: 0, nextMode: 'focus', focusDuration: 25, breakDuration: 5 };
      }

      // Om timern redan är igång när personen ansluter
      if (rooms[roomId].endTime > Date.now()) {
        // Vi räknar ut vad som körs just nu baserat på vad nästa läge är
        const currentMode = rooms[roomId].nextMode === 'break' ? 'focus' : 'break';
        socket.emit('timer-started', { 
          endTime: rooms[roomId].endTime, 
          mode: currentMode,
          focusDuration: rooms[roomId].focusDuration,
          breakDuration: rooms[roomId].breakDuration
        });
      } else {
        // Om timern står still, berätta för frontend vad som väntar härnäst
        socket.emit('timer-stopped', {
          nextMode: rooms[roomId].nextMode,
          focusDuration: rooms[roomId].focusDuration,
          breakDuration: rooms[roomId].breakDuration
        });
      }

      // Uppdatera deltagarlistan för alla i rummet
      broadcastRoster(roomId);
    } catch (error) {
      console.error('Fel i join-room:', error);
      socket.emit('error', 'Kunde inte gå med i rummet');
    }
  });

  socket.on('start-timer', async (data) => {
    try {
      const roomId = typeof data === 'string' ? data : data.roomId;
      if (!rooms[roomId]) {
        rooms[roomId] = { endTime: 0, nextMode: 'focus', focusDuration: 25, breakDuration: 5 };
        if (!roomMembers[roomId]) roomMembers[roomId] = new Map();
        roomUsers[roomId] = roomMembers[roomId].size;
      }
      
      // Uppdatera durationerna om de skickades in
      if (typeof data === 'object') {
        rooms[roomId].focusDuration = data.focusDuration || 25;
        rooms[roomId].breakDuration = data.breakDuration || 5;
      }
      
      // Förhindra att någon startar en ny timer om den redan är igång
      if (rooms[roomId].endTime > Date.now()) return;

      const mode = rooms[roomId].nextMode;

      // Hämtar en motiverande mening från Gemini baserat på det aktuella läget
      const motivation = await getMotivationalQuote(mode);

      // Använd custom-durationerna, eller default-värdena
      const duration = mode === 'focus' 
        ? rooms[roomId].focusDuration * 60 * 1000 
        : rooms[roomId].breakDuration * 60 * 1000;
      const endTime = Date.now() + duration;
      
      rooms[roomId].endTime = endTime;
      
      // Ändra nästa läge inför nästa knapptryck
      rooms[roomId].nextMode = mode === 'focus' ? 'break' : 'focus';

      // Stäng av eventuell befintlig timer för detta rum
      if (timers[roomId]) {
        clearTimeout(timers[roomId]);
      }

      // Lägg till server-side timer som notifierar när sessionen avslutas
      const timeoutDuration = Math.min(duration, 2147483647); // Max safe timeout
      timers[roomId] = setTimeout(() => {
        try {
          io.to(roomId).emit('timer-stopped', {
            nextMode: rooms[roomId].nextMode,
            focusDuration: rooms[roomId].focusDuration,
            breakDuration: rooms[roomId].breakDuration
          });
          timers[roomId] = null;
          // OBS: Jag tog bort den felplacerade timer-started härifrån!
        } catch (error) {
          console.error('Fel när timer stoppades för rum', roomId, ':', error);
        }
      }, timeoutDuration);

      // Skicka ut startsignalen med alla detaljer (Nu MED motivation!)
      io.to(roomId).emit('timer-started', { 
        endTime, 
        mode,
        motivation, // <-- HÄR LADE JAG TILL CITATET!
        focusDuration: rooms[roomId].focusDuration,
        breakDuration: rooms[roomId].breakDuration
      });
    } catch (error) {
      console.error('Fel i start-timer:', error);
      socket.emit('error', 'Kunde inte starta timer');
    }
  });

  // Hantera keepalive-pings från klienter
  socket.on('keepalive', () => {
    // Ingenting att göra, bara bekräfta att vi fick meddelandet
    // Socket.io kommer automatiskt att pinga tillbaka
  });

  // Byt visningsnamn (från inställningspanelen)
  socket.on('update-name', (newName) => {
    const roomId = socket.data.roomId;
    const name = String(newName || '').slice(0, 40).trim() || 'Gäst';
    socket.data.name = name;
    if (roomId && roomMembers[roomId] && roomMembers[roomId].has(socket.id)) {
      roomMembers[roomId].get(socket.id).name = name;
      broadcastRoster(roomId);
    }
  });

  // Spåra när användare disconnectar
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId && roomMembers[roomId] && roomMembers[roomId].has(socket.id)) {
      removeFromRoom(socket, roomId);
    } else {
      // Fallback: leta upp socketen i alla rum
      Object.keys(roomMembers).forEach(rid => {
        if (roomMembers[rid].has(socket.id)) removeFromRoom(socket, rid);
      });
    }
  });
});

server.listen(3000, () => {
  console.log(`Servern är igång på http://localhost:3000`);
});