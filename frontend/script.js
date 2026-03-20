const socket = io('http://localhost:3000');

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

// Lyssna efter signal om att klockan står still (t.ex. när man just anslutit)
socket.on('timer-stopped', (nextMode) => {
    clearInterval(timerInterval);
    startBtn.disabled = false; // Se till att knappen går att klicka på
    
    if (nextMode === 'focus') {
        modeDisplay.innerText = "Redo för Fokus (25 min)";
        timerDisplay.innerText = "25:00";
    } else {
        modeDisplay.innerText = "Redo för Rast (5 min)";
        timerDisplay.innerText = "05:00";
    }
});

// Lyssna efter signal om att klockan har startat
socket.on('timer-started', (data) => {
    clearInterval(timerInterval);
    startBtn.disabled = true; // Stäng av startknappen så man inte råkar klicka flera gånger
    
    if (data.mode === 'focus') {
        modeDisplay.innerText = "🔥 Fokus pågår...";
    } else {
        modeDisplay.innerText = "☕ Rast pågår...";
    }

    timerInterval = setInterval(() => {
        const timeLeft = data.endTime - Date.now();

        // NÄR TIDEN ÄR UTE
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerDisplay.innerText = "00:00";
            
            // Spela upp pling-ljudet!
            alarmSound.play();
            
            // Aktivera startknappen igen
            startBtn.disabled = false;
            
            // Berätta för användarna vad som väntar härnäst
            if (data.mode === 'focus') {
                 modeDisplay.innerText = "Fokus klart! Klicka start för Rast.";
            } else {
                 modeDisplay.innerText = "Rasten är slut! Klicka start för Fokus.";
            }

        } else {
            // RÄKNA NER
            const totalSeconds = Math.floor(timeLeft / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            const formattedMin = minutes < 10 ? '0' + minutes : minutes;
            const formattedSec = seconds < 10 ? '0' + seconds : seconds;

            timerDisplay.innerText = `${formattedMin}:${formattedSec}`;
        }
    }, 1000);
});