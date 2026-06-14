const socket = io();

let roomCode = null;
let totalPlayersCount = 0;
let currentQuestionVisual = 'bar-chart';
let currentQuestionCorrectOption = '';
let currentQuestionCorrectIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  roomCode = urlParams.get('pin');

  if (!roomCode) {
    alert("PIN Stanza mancante.");
    window.location.href = 'index.html';
    return;
  }

  // Connect and join as a projection screen listener
  socket.emit('projection-join', { roomCode });
});

// Setup dynamic QR badge on projection view
function setupQRBadge(code) {
  const joinUrl = `${window.location.protocol}//${window.location.host}/index.html?pin=${code}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}&color=0-0-0&bgcolor=255-255-255`;
  
  const qrImg = document.getElementById('qr-code-img');
  if (qrImg) {
    qrImg.src = qrCodeApiUrl;
    document.getElementById('qr-badge').style.display = 'flex';
  }
}

// SYNC ON JOIN
socket.on('projection-init', (data) => {
  const { 
    state, 
    currentQuestionIndex, 
    totalQuestions, 
    answersReceived, 
    votesCount, 
    playerCount, 
    players,
    questionText,
    options,
    mediaUrl,
    mediaType,
    correctOption,
    correctIndex,
    visualization
  } = data;

  totalPlayersCount = playerCount;

  // Setup QR Badge
  setupQRBadge(roomCode);

  // Set Player Count
  const countSpan = document.getElementById('players-count-val');
  if (countSpan) countSpan.textContent = playerCount;
  const totalSpan = document.getElementById('answers-total-players');
  if (totalSpan) totalSpan.textContent = playerCount;

  // Populate lobby players list
  const grid = document.getElementById('lobby-players-grid');
  if (grid) {
    grid.innerHTML = '';
    players.forEach(p => {
      const bubble = document.createElement('div');
      bubble.className = 'player-bubble';
      bubble.textContent = p;
      grid.appendChild(bubble);
    });
  }

  // Route state
  if (state === 'LOBBY') {
    showView('view-lobby');
  } else if (state === 'QUESTION') {
    showView('view-question');
    renderQuestion({ questionIndex: currentQuestionIndex, totalQuestions, questionText, options, mediaUrl, mediaType, visualization });
    updateVotesUI({ answersReceived, totalPlayers: playerCount, votesCount });
  } else if (state === 'REVEAL') {
    showView('view-question');
    renderQuestion({ questionIndex: currentQuestionIndex, totalQuestions, questionText, options, mediaUrl, mediaType, visualization });
    updateVotesUI({ answersReceived, totalPlayers: playerCount, votesCount });
    revealAnswer({ correctOption, correctIndex });
  } else if (state === 'GAME_OVER') {
    showView('view-gameover');
  }
});

// PLAYER JOINED
socket.on('player-joined', (data) => {
  const { nickname, playerCount } = data;
  totalPlayersCount = playerCount;

  const countSpan = document.getElementById('players-count-val');
  if (countSpan) countSpan.textContent = playerCount;
  const totalSpan = document.getElementById('answers-total-players');
  if (totalSpan) totalSpan.textContent = playerCount;

  const grid = document.getElementById('lobby-players-grid');
  if (grid) {
    // If bubble is not already in grid, add it
    const existing = document.getElementById(`player-${data.id}`);
    if (!existing) {
      const bubble = document.createElement('div');
      bubble.className = 'player-bubble';
      bubble.id = `player-${data.id}`;
      bubble.textContent = nickname;
      grid.appendChild(bubble);
    }
  }
});

// PLAYER LEFT
socket.on('player-left', (data) => {
  const { id, playerCount } = data;
  totalPlayersCount = playerCount;

  const countSpan = document.getElementById('players-count-val');
  if (countSpan) countSpan.textContent = playerCount;
  const totalSpan = document.getElementById('answers-total-players');
  if (totalSpan) totalSpan.textContent = playerCount;

  const playerBubble = document.getElementById(`player-${id}`);
  if (playerBubble) playerBubble.remove();
});

// START QUESTION PHASE
socket.on('new-question', (data) => {
  showView('view-question');
  renderQuestion(data);
});

// RENDER QUESTION ELEMENTS
function renderQuestion(data) {
  const { questionIndex, totalQuestions, questionText, options, mediaUrl, mediaType, visualization } = data;
  
  currentQuestionVisual = visualization || 'bar-chart';
  currentQuestionCorrectOption = '';
  currentQuestionCorrectIndex = -1;

  document.getElementById('question-text').textContent = questionText;
  document.getElementById('answers-submitted-count').textContent = '0';
  document.getElementById('answers-total-players').textContent = totalPlayersCount;

  // Setup options C and D display logic
  const letterLabels = ['A', 'B', 'C', 'D'];
  letterLabels.forEach((letter, index) => {
    const barWrapper = document.getElementById(`bar-wrapper-${letter}`);
    if (barWrapper) {
      barWrapper.style.display = (index < options.length) ? 'flex' : 'none';
    }
  });

  // Hide all visualizations
  const visContainers = [
    'votes-chart', 
    'cola-glass-visualization', 
    'silhouettes-visualization', 
    'fishbowls-visualization', 
    'wordcloud-visualization'
  ];
  visContainers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Setup selected visualization
  if (currentQuestionVisual === 'cola-glass') {
    document.getElementById('cola-glass-visualization').style.display = 'flex';
    document.getElementById('cola-liquid-A').style.height = '0%';
    document.getElementById('cola-liquid-B').style.height = '0%';
    document.getElementById('cola-val-A').textContent = '0 voti (0%)';
    document.getElementById('cola-val-B').textContent = '0 voti (0%)';
    
    const glasses = document.querySelectorAll('.cola-glass');
    glasses.forEach(g => {
      g.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
      g.style.borderColor = 'rgba(255, 255, 255, 0.45)';
    });
    const wrappers = document.querySelectorAll('.cola-glass-wrapper');
    wrappers.forEach(w => w.style.opacity = '1.0');

    generateColaBubbles('cola-liquid-A');
    generateColaBubbles('cola-liquid-B');

  } else if (currentQuestionVisual === 'stretching-silhouettes') {
    document.getElementById('silhouettes-visualization').style.display = 'flex';
    document.getElementById('silhouette-body-A').style.height = '90px';
    document.getElementById('silhouette-body-B').style.height = '90px';
    document.getElementById('silhouette-val-A').textContent = '0 voti';
    document.getElementById('silhouette-val-B').textContent = '0 voti';

    const bodies = document.querySelectorAll('.silhouette-body');
    bodies.forEach(b => b.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4)');
    const wrappers = document.querySelectorAll('.silhouette-wrapper');
    wrappers.forEach(w => w.style.opacity = '1.0');

  } else if (currentQuestionVisual === 'fish-bowl') {
    document.getElementById('fishbowls-visualization').style.display = 'flex';
    document.getElementById('fishbowl-water-A').innerHTML = '';
    document.getElementById('fishbowl-water-B').innerHTML = '';
    document.getElementById('fishbowl-val-A').textContent = '0 pesci';
    document.getElementById('fishbowl-val-B').textContent = '0 pesci';

    const bowls = document.querySelectorAll('.fishbowl');
    bowls.forEach(b => {
      b.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
      b.style.borderColor = 'rgba(255, 255, 255, 0.45)';
    });
    const wrappers = document.querySelectorAll('.fishbowl-wrapper');
    wrappers.forEach(w => w.style.opacity = '1.0');

  } else if (currentQuestionVisual === 'word-cloud') {
    document.getElementById('wordcloud-visualization').style.display = 'flex';
    const letters = ['A', 'B', 'C', 'D'];
    letters.forEach(letter => {
      const el = document.getElementById('word-' + letter);
      if (el) {
        el.style.fontSize = '2.5rem';
        el.style.opacity = '1.0';
      }
    });

  } else {
    document.getElementById('votes-chart').style.display = 'flex';
    const letterLabels = ['A', 'B', 'C', 'D'];
    letterLabels.forEach(letter => {
      const bar = document.getElementById(`bar-${letter}`);
      if (bar) {
        bar.style.height = '10px';
        bar.classList.remove('correct');
      }
      const valText = document.getElementById(`val-${letter}`);
      if (valText) valText.textContent = '0';
    });
  }

  // Setup media box
  const mediaBox = document.getElementById('question-media-box');
  mediaBox.innerHTML = '';
  if (mediaType !== 'none' && mediaUrl) {
    mediaBox.style.display = 'flex';
    if (mediaType === 'image') {
      const img = document.createElement('img');
      img.src = mediaUrl;
      mediaBox.appendChild(img);
    } else if (mediaType === 'video') {
      const video = document.createElement('video');
      video.src = mediaUrl;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      mediaBox.appendChild(video);
    }
  } else {
    mediaBox.style.display = 'none';
  }
}

// LIVE VOTE CHART UPDATE (when players vote)
socket.on('vote-updated', (data) => {
  updateVotesUI(data);
});

function updateVotesUI(data) {
  const { answersReceived, totalPlayers, votesCount } = data;
  document.getElementById('answers-submitted-count').textContent = answersReceived;

  const maxPlayers = totalPlayers || 1;

  if (currentQuestionVisual === 'cola-glass') {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;
    const percentA = Math.round((votesA / maxPlayers) * 100);
    const percentB = Math.round((votesB / maxPlayers) * 100);

    document.getElementById('cola-liquid-A').style.height = `${percentA}%`;
    document.getElementById('cola-liquid-B').style.height = `${percentB}%`;

    document.getElementById('cola-val-A').textContent = `${votesA} ${votesA === 1 ? 'voto' : 'voti'} (${percentA}%)`;
    document.getElementById('cola-val-B').textContent = `${votesB} ${votesB === 1 ? 'voto' : 'voti'} (${percentB}%)`;

  } else if (currentQuestionVisual === 'stretching-silhouettes') {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;

    const heightA = 90 + Math.round((votesA / maxPlayers) * 80);
    const heightB = 90 - Math.round((votesB / maxPlayers) * 45);

    document.getElementById('silhouette-body-A').style.height = `${heightA}px`;
    document.getElementById('silhouette-body-B').style.height = `${heightB}px`;

    document.getElementById('silhouette-val-A').textContent = `${votesA} ${votesA === 1 ? 'voto' : 'voti'}`;
    document.getElementById('silhouette-val-B').textContent = `${votesB} ${votesB === 1 ? 'voto' : 'voti'}`;

  } else if (currentQuestionVisual === 'fish-bowl') {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;

    updateBowlFish('fishbowl-water-A', votesA);
    updateBowlFish('fishbowl-water-B', votesB);

    document.getElementById('fishbowl-val-A').textContent = `${votesA} ${votesA === 1 ? 'pesce' : 'pesci'}`;
    document.getElementById('fishbowl-val-B').textContent = `${votesB} ${votesB === 1 ? 'pesce' : 'pesci'}`;

  } else if (currentQuestionVisual === 'word-cloud') {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;
    const votesC = votesCount['C'] || 0;
    const votesD = votesCount['D'] || 0;
    const totalVotes = votesA + votesB + votesC + votesD;

    const scaleWord = (letter, votes) => {
      const el = document.getElementById('word-' + letter);
      if (el) {
        if (totalVotes === 0) {
          el.style.fontSize = '2.5rem';
          el.style.opacity = '0.8';
        } else {
          const share = votes / totalVotes;
          const fontSize = 1.2 + (share * 3.8);
          el.style.fontSize = `${fontSize}rem`;
          el.style.opacity = votes > 0 ? '1.0' : '0.4';
        }
      }
    };

    scaleWord('A', votesA);
    scaleWord('B', votesB);
    scaleWord('C', votesC);
    scaleWord('D', votesD);

  } else {
    for (const [optionLetter, votes] of Object.entries(votesCount)) {
      const valSpan = document.getElementById(`val-${optionLetter}`);
      if (valSpan) valSpan.textContent = votes;

      const bar = document.getElementById(`bar-${optionLetter}`);
      if (bar) {
        const targetPercent = votes / maxPlayers;
        const targetHeight = Math.round(targetPercent * 200) + 10;
        bar.style.height = `${targetHeight}px`;
      }
    }
  }
}

// REVEAL CORRECT ANSWER PHASE
socket.on('question-ended', (data) => {
  revealAnswer(data);
});

function revealAnswer(data) {
  const { correctOption, correctIndex, votes } = data;

  // Highlight correct bar in chart
  const correctBar = document.getElementById(`bar-${correctOption}`);
  if (correctBar) {
    correctBar.classList.add('correct');
  }

  // Highlight correct Coca-Cola glass (if active)
  if (currentQuestionVisual === 'cola-glass') {
    const wrapperA = document.getElementById('cola-liquid-A').closest('.cola-glass-wrapper');
    const wrapperB = document.getElementById('cola-liquid-B').closest('.cola-glass-wrapper');
    const glassA = document.getElementById('cola-liquid-A').parentElement;
    const glassB = document.getElementById('cola-liquid-B').parentElement;

    if (correctOption === 'A') {
      glassA.style.boxShadow = '0 0 25px var(--color-success)';
      glassA.style.borderColor = 'var(--color-success)';
      wrapperB.style.opacity = '0.25';
    } else if (correctOption === 'B') {
      glassB.style.boxShadow = '0 0 25px var(--color-success)';
      glassB.style.borderColor = 'var(--color-success)';
      wrapperA.style.opacity = '0.25';
    }
  }

  // Highlight silhouettes (if active)
  if (currentQuestionVisual === 'stretching-silhouettes') {
    const wrapperA = document.getElementById('silhouette-body-A').closest('.silhouette-wrapper');
    const wrapperB = document.getElementById('silhouette-body-B').closest('.silhouette-wrapper');
    const bodyA = document.getElementById('silhouette-body-A');
    const bodyB = document.getElementById('silhouette-body-B');

    if (correctOption === 'A') {
      bodyA.style.boxShadow = '0 0 20px var(--color-success)';
      wrapperB.style.opacity = '0.25';
    } else if (correctOption === 'B') {
      bodyB.style.boxShadow = '0 0 20px var(--color-success)';
      wrapperA.style.opacity = '0.25';
    }
  }

  // Highlight fishbowls (if active)
  if (currentQuestionVisual === 'fish-bowl') {
    const wrapperA = document.getElementById('fishbowl-water-A').closest('.fishbowl-wrapper');
    const wrapperB = document.getElementById('fishbowl-water-B').closest('.fishbowl-wrapper');
    const bowlA = document.getElementById('fishbowl-water-A').parentElement;
    const bowlB = document.getElementById('fishbowl-water-B').parentElement;

    if (correctOption === 'A') {
      bowlA.style.boxShadow = '0 0 25px var(--color-success)';
      bowlA.style.borderColor = 'var(--color-success)';
      wrapperB.style.opacity = '0.25';
    } else if (correctOption === 'B') {
      bowlB.style.boxShadow = '0 0 25px var(--color-success)';
      bowlB.style.borderColor = 'var(--color-success)';
      wrapperA.style.opacity = '0.25';
    }
  }

  // Word Cloud highlights (dim non-winners)
  if (currentQuestionVisual === 'word-cloud') {
    let letters = ['A', 'B', 'C', 'D'];
    let maxVotes = -1;
    let winnerLetter = 'A';
    
    letters.forEach(letter => {
      const v = votes[letter] || 0;
      if (v > maxVotes) {
        maxVotes = v;
        winnerLetter = letter;
      }
    });

    letters.forEach(letter => {
      const el = document.getElementById('word-' + letter);
      if (el && letter !== winnerLetter && maxVotes > 0) {
        el.style.opacity = '0.25';
      }
    });
  }
}

// GAME OVER
socket.on('game-over', (data) => {
  showView('view-gameover');
});

// Disconnected
socket.on('room-closed', (data) => {
  alert(data.message);
  window.location.href = 'index.html';
});

// GENERAL HELPER FOR TOGGLING VIEWS
function showView(viewId) {
  const views = ['view-lobby', 'view-question', 'view-gameover'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = (v === viewId) ? 'block' : 'none';
  });
}

// Helper to generate dynamic cola bubbles rising
function generateColaBubbles(liquidId) {
  const container = document.getElementById(liquidId);
  if (!container) return;
  const existingBubbles = container.querySelectorAll('.cola-bubble');
  existingBubbles.forEach(b => b.remove());
  
  for (let i = 0; i < 15; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'cola-bubble';
    bubble.style.left = `${Math.random() * 95}%`;
    bubble.style.animationDelay = `${Math.random() * 2.0}s`;
    bubble.style.setProperty('--drift', `${Math.random() * 30 - 15}px`);
    
    const size = Math.random() * 3 + 2;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    container.appendChild(bubble);
  }
}

// Helper to spawn/remove goldfish
function updateBowlFish(waterId, targetCount) {
  const container = document.getElementById(waterId);
  if (!container) return;
  const currentCount = container.querySelectorAll('.little-fish').length;

  if (currentCount < targetCount) {
    const diff = targetCount - currentCount;
    for (let i = 0; i < diff; i++) {
      const fish = document.createElement('div');
      fish.className = 'little-fish';
      fish.style.top = `${25 + Math.random() * 50}%`;
      fish.style.left = `${15 + Math.random() * 55}%`;
      fish.style.animationDelay = `${Math.random() * 3.5}s`;
      container.appendChild(fish);
    }
  } else if (currentCount > targetCount) {
    const diff = currentCount - targetCount;
    const fishes = container.querySelectorAll('.little-fish');
    for (let i = 0; i < diff; i++) {
      fishes[i].remove();
    }
  }
}
