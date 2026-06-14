const socket = io();

// Parse credentials from URL params
const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('pin');
const nickname = urlParams.get('nick');

let myPlayerId = null;
let currentScore = 0;
let answeredThisRound = false;

// Audio items
let audioCorrect, audioIncorrect;

document.addEventListener('DOMContentLoaded', () => {
  audioCorrect = document.getElementById('audio-correct');
  audioIncorrect = document.getElementById('audio-incorrect');

  if (!roomPin || !nickname) {
    alert("PIN o Nickname mancanti. Sarai reindirizzato alla Home.");
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('player-hud-name').textContent = nickname;
  document.getElementById('wait-lobby-pin').textContent = roomPin;

  document.getElementById('connection-status-hint').textContent = `Connessione alla stanza ${roomPin}...`;
});

// Safe Audio Playback Helper
function playAudio(audioEl) {
  if (audioEl) {
    audioEl.currentTime = 0;
    audioEl.play().catch(e => console.log("Audio autoplay blocked or file missing:", e.message));
  }
}

// 1. SOCKET.IO EVENT HANDLERS
socket.on('connect', () => {
  document.getElementById('connection-status-hint').textContent = "Connesso al server.";
  if (roomPin && nickname) {
    socket.emit('player-join', {
      roomCode: roomPin,
      nickname: nickname
    });
  }
});

socket.on('join-success', (data) => {
  myPlayerId = data.playerId;
  document.getElementById('connection-status-hint').textContent = "In stanza. Connessione attiva ✔";
  showScreen('screen-wait-lobby');
});

socket.on('join-error', (data) => {
  alert(data.message);
  window.location.href = 'index.html';
});

// START QUESTION
socket.on('new-question', (data) => {
  const { questionText, options, timer } = data;
  answeredThisRound = false;

  // Reset answer buttons states
  const btns = document.querySelectorAll('.player-opt-btn');
  btns.forEach((btn, idx) => {
    btn.disabled = false;
    if (idx < options.length) {
      btn.style.display = 'flex';
      btn.innerHTML = `<span class="player-opt-letter">${options[idx].label}</span><span class="player-opt-text">${options[idx].text}</span>`;
    } else {
      btn.style.display = 'none';
    }
  });

  // Reset overlays
  hideFeedbackOverlays();

  // Show active answering pad
  showScreen('screen-answer-buttons');
});

// ANSWER ACKNOWLEDGED (Result of submit)
socket.on('answer-acknowledged', (data) => {
  const { isCorrect, pointsEarned, isPoll } = data;
  
  // Save the result for later when question ends
  window.lastResult = { isCorrect, pointsEarned, isPoll };

  // Hide button pad viewports
  showScreen(''); // Hide main screens
  hideFeedbackOverlays();
  
  document.getElementById('overlay-waiting').style.display = 'flex';
  document.getElementById('overlay-waiting').querySelector('h2').textContent = "Risposta inviata!";
  document.getElementById('overlay-waiting').querySelector('p').textContent = "In attesa che il presentatore sveli la risposta...";
});

// QUESTION ENDED (Time out or all answered)
socket.on('question-ended', (data) => {
  // Disable options buttons
  const btns = document.querySelectorAll('.player-opt-btn');
  btns.forEach(btn => btn.disabled = true);

  // If player did not answer, show timeout screen
  if (!answeredThisRound) {
    hideFeedbackOverlays();
    document.getElementById('overlay-timeout').style.display = 'flex';
  } else if (window.lastResult) {
    // REVEAL RESULT NOW
    hideFeedbackOverlays();
    if (window.lastResult.isPoll) {
      document.getElementById('overlay-poll-thanks').style.display = 'flex';
    } else if (window.lastResult.isCorrect) {
      document.getElementById('points-earned-display').textContent = `+${window.lastResult.pointsEarned} punti!`;
      document.getElementById('overlay-correct').style.display = 'flex';
      playAudio(audioCorrect);
    } else {
      document.getElementById('overlay-incorrect').style.display = 'flex';
      document.querySelector('.container').classList.add('shake');
      setTimeout(() => document.querySelector('.container').classList.remove('shake'), 400);
      playAudio(audioIncorrect);
    }
  }
});

// INTER-STAGE LEADERBOARD DISPLAYED (Now skipped)
socket.on('show-leaderboard', (data) => {
  hideFeedbackOverlays();
});

// GAME OVER
socket.on('game-over', (data) => {
  hideFeedbackOverlays();
  showScreen('screen-gameover');
});

// Host disconnected
socket.on('room-closed', (data) => {
  alert(data.message);
  window.location.href = 'index.html';
});

socket.on('disconnect', () => {
  document.getElementById('connection-status-hint').textContent = "Disconnesso. Riconnessione...";
});

// 2. SUBMIT OPTION SELECTION
function submitAnswer(optionLetter) {
  if (answeredThisRound) return;
  answeredThisRound = true;

  // Emit choice to server
  socket.emit('player-submit-answer', {
    roomCode: roomPin,
    answer: optionLetter
  });

  // Display waiting overlay
  document.getElementById('overlay-waiting').style.display = 'flex';
}

// 3. CORE DISPLAY HELPER UTILITIES
function showScreen(screenId) {
  const screens = ['screen-wait-lobby', 'screen-answer-buttons', 'screen-score-break', 'screen-gameover'];
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (s === screenId) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
}

function hideFeedbackOverlays() {
  const overlays = ['overlay-waiting', 'overlay-correct', 'overlay-incorrect', 'overlay-timeout', 'overlay-poll-thanks'];
  overlays.forEach(o => {
    const el = document.getElementById(o);
    if (el) el.style.display = 'none';
  });
}
