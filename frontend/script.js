// Växla mellan lokal och fjärr-server här
// För lokal testning: 'http://localhost:3000'
// För produktion: 'https://grupp-pomodoro-server.onrender.com'
const SERVER_URL = 'https://grupp-pomodoro-server.onrender.com';

const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    pingInterval: 5000,  // Ping var 5:e sekund istället för default ~25s
    pingTimeout: 10000   // Timeout efter 10s utan pong
});

const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const currentRoomText = document.getElementById('current-room-text');
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const modeDisplay = document.getElementById('mode-display');
const alarmSound = document.getElementById('alarm-sound');
const focusDurationInput = document.getElementById('focus-duration');
const breakDurationInput = document.getElementById('break-duration');
const settingsToggle = document.getElementById('settings-toggle');
const settingsContent = document.getElementById('settings-content');

let currentRoom = '';
let timerInterval;
let currentFocusDuration = 25;
let currentBreakDuration = 5;
let keepaliveInterval; // Spåra keepalive-intervallet

joinBtn.addEventListener('click', () => {
    currentRoom = roomInput.value;
    if (currentRoom) {
        socket.emit('join-room', currentRoom);
        currentRoomText.innerText = `Du är i rum: ${currentRoom}`;
    }
});

// Inställningar toggle
settingsToggle.addEventListener('click', () => {
    settingsContent.classList.toggle('open');
});

// Stäng inställningar när man klickar utanför
document.addEventListener('click', (e) => {
    if (!e.target.closest('.settings-container')) {
        settingsContent.classList.remove('open');
    }
});

startBtn.addEventListener('click', () => {
    if (currentRoom) {
        currentFocusDuration = parseInt(focusDurationInput.value) || 25;
        currentBreakDuration = parseInt(breakDurationInput.value) || 5;
        socket.emit('start-timer', {
            roomId: currentRoom,
            focusDuration: currentFocusDuration,
            breakDuration: currentBreakDuration
        });
    } else {
        alert('Du måste gå med i ett rum först!');
    }
});

socket.on('timer-stopped', (data) => {
    clearInterval(timerInterval);
    startBtn.disabled = false;
    
    if (data.nextMode === 'focus') {
        const minutes = data.focusDuration || 25;
        modeDisplay.innerText = `Redo för Fokus (${minutes} min)`;
        timerDisplay.innerText = String(minutes).padStart(2, '0') + ":00";
        document.title = String(minutes).padStart(2, '0') + ":00 - Redo för Fokus";
    } else {
        const minutes = data.breakDuration || 5;
        modeDisplay.innerText = `Redo för Rast (${minutes} min)`;
        timerDisplay.innerText = String(minutes).padStart(2, '0') + ":00";
        document.title = String(minutes).padStart(2, '0') + ":00 - Redo för Rast";
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

// Error-handling för server-problem
socket.on('error', (errorMessage) => {
    console.error('Server-fel:', errorMessage);
    startBtn.disabled = false;
    alert('Serverfel: ' + errorMessage);
});

// Hantera connection-problem
socket.on('connect_error', (error) => {
    console.error('Connection-fel:', error);
    startBtn.disabled = true;
    modeDisplay.innerText = '❌ Ingen connection till server';
});

socket.on('disconnect', () => {
    clearInterval(timerInterval);
    startBtn.disabled = true;
    modeDisplay.innerText = '❌ Frånkopplad från server';
});

socket.on('reconnect', () => {
    if (currentRoom) {
        socket.emit('join-room', currentRoom);
        modeDisplay.innerText = '✅ Återansluten!';
    }
    
    // Starta keepalive-ping var 10:e minut
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    keepaliveInterval = setInterval(() => {
        if (socket.connected) {
            socket.emit('keepalive');
        }
    }, 600000); // 10 minuter
});