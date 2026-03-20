const socket = io('https://grupp-pomodoro-server.onrender.com');

const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const currentRoomText = document.getElementById('current-room-text');
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const modeDisplay = document.getElementById('mode-display');
const alarmSound = document.getElementById('alarm-sound');

let currentRoom = '';
let timerInterval;

joinBtn.addEventListener('click', () => {
    currentRoom = roomInput.value;
    if (currentRoom) {
        socket.emit('join-room', currentRoom);
        currentRoomText.innerText = `Du är i rum: ${currentRoom}`;
    }
});

startBtn.addEventListener('click', () => {
    if (currentRoom) {
        socket.emit('start-timer', currentRoom);
    } else {
        alert('Du måste gå med i ett rum först!');
    }
});

socket.on('timer-stopped', (nextMode) => {
    clearInterval(timerInterval);
    startBtn.disabled = false;
    
    if (nextMode === 'focus') {
        modeDisplay.innerText = "Redo för Fokus (25 min)";
        timerDisplay.innerText = "25:00";
        document.title = "25:00 - Redo för Fokus"; // Uppdaterar fliken
    } else {
        modeDisplay.innerText = "Redo för Rast (5 min)";
        timerDisplay.innerText = "05:00";
        document.title = "05:00 - Redo för Rast"; // Uppdaterar fliken
    }
});

socket.on('timer-started', (data) => {
    clearInterval(timerInterval);
    startBtn.disabled = true;
    
    const modeText = data.mode === 'focus' ? 'Fokus' : 'Rast';

    if (data.mode === 'focus') {
        modeDisplay.innerText = "🔥 Fokus pågår...";
    } else {
        modeDisplay.innerText = "☕ Rast pågår...";
    }

    timerInterval = setInterval(() => {
        const timeLeft = data.endTime - Date.now();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerDisplay.innerText = "00:00";
            document.title = "Tiden är ute! 🔔"; // Fliken blinkar till mentalt med en klocka
            
            alarmSound.play();
            startBtn.disabled = false;
            
            if (data.mode === 'focus') {
                 modeDisplay.innerText = "Fokus klart! Klicka start för Rast.";
            } else {
                 modeDisplay.innerText = "Rasten är slut! Klicka start för Fokus.";
            }
        } else {
            const totalSeconds = Math.floor(timeLeft / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            const formattedMin = minutes < 10 ? '0' + minutes : minutes;
            const formattedSec = seconds < 10 ? '0' + seconds : seconds;
            
            const timeString = `${formattedMin}:${formattedSec}`;

            timerDisplay.innerText = timeString;
            // Här uppdateras fliken varje sekund med tiden och nuvarande läge!
            document.title = `${timeString} - ${modeText}`; 
        }
    }, 1000);
});