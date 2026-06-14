const socket = io();

let roomCode = null;
let currentQuiz = null;
let totalPlayersCount = 0;


// Audio context permission helpers
let audioLobby, audioTick, audioBuzzer, audioReveal, audioVictory;

// 1. INIZIALIZZAZIONE DA INTERACTION OVERLAY
function startHostDashboard() {
  document.getElementById('interaction-overlay').style.display = 'none';

  // Instantiate audio elements
  audioLobby = document.getElementById('audio-lobby');
  audioTick = document.getElementById('audio-tick');
  audioBuzzer = document.getElementById('audio-buzzer');
  audioReveal = document.getElementById('audio-reveal');
  audioVictory = document.getElementById('audio-victory');

  // Attempt to play lobby music (requires user gesture, which we just got!)
  playAudio(audioLobby);

  // Set local IP display
  const currentHost = window.location.hostname;
  document.getElementById('ip-address-display').textContent = currentHost;

  // Load Quiz from localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const quizIdIndex = parseInt(urlParams.get('quizId')) || 0;
  
  const stored = localStorage.getItem('multitemer_quizzes_v2');
  if (stored) {
    const quizzes = JSON.parse(stored);
    currentQuiz = quizzes[quizIdIndex];
  }

  if (!currentQuiz) {
    alert("Nessun quiz caricato. Sarai reindirizzato al Creator.");
    window.location.href = 'creator.html';
    return;
  }

  // Register room on server
  socket.emit('host-create-room', { 
    questions: currentQuiz.questions,
    redirectUrl: currentQuiz.redirectUrl || 'https://www.google.it'
  });
  
  document.getElementById('game-status-logs').textContent = `Creazione stanza in corso per: ${currentQuiz.title}...`;
}

// Safe Audio Playback Helper
function playAudio(audioEl) {
  if (audioEl) {
    audioEl.currentTime = 0;
    audioEl.play().catch(e => console.log("Audio autoplay blocked or file missing:", e.message));
  }
}

function stopAudio(audioEl) {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
}

// 2. SOCKET SOCKET.IO EVENT LISTENERS
socket.on('room-created', (data) => {
  roomCode = data.roomCode;
  
  document.getElementById('pin-header-val').textContent = roomCode;
  document.getElementById('lobby-pin-display').textContent = roomCode;
  document.getElementById('game-status-logs').textContent = `Stanza creata! In attesa di giocatori.`;

  // Generate dynamic QR code URL pointing to player portal with PIN autofill
  const joinUrl = `${window.location.protocol}//${window.location.host}/index.html?pin=${roomCode}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}&color=0-0-0&bgcolor=255-255-255`;
  
  document.getElementById('qr-code-img').src = qrCodeApiUrl;
  document.getElementById('qr-pin-display').textContent = `PIN: ${roomCode}`;
  document.getElementById('qr-badge').style.display = 'flex';
});

socket.on('player-joined', (data) => {
  const { nickname, playerCount } = data;
  totalPlayersCount = playerCount;

  document.getElementById('players-count-val').textContent = playerCount;
  document.getElementById('answers-total-players').textContent = playerCount;
  
  // Add player to lobby grid
  const grid = document.getElementById('lobby-players-grid');
  const bubble = document.createElement('div');
  bubble.className = 'player-bubble';
  bubble.id = `player-${data.id}`;
  bubble.textContent = nickname;
  grid.appendChild(bubble);

  // Enable Start Button if at least 1 player is connected
  if (playerCount >= 1) {
    document.getElementById('start-game-btn').disabled = false;
  }

  document.getElementById('game-status-logs').textContent = `${nickname} è entrato in gioco!`;
});

socket.on('player-left', (data) => {
  const { id, nickname, playerCount } = data;
  totalPlayersCount = playerCount;

  document.getElementById('players-count-val').textContent = playerCount;
  document.getElementById('answers-total-players').textContent = playerCount;

  // Remove player bubble
  const playerBubble = document.getElementById(`player-${id}`);
  if (playerBubble) playerBubble.remove();

  if (playerCount < 1) {
    document.getElementById('start-game-btn').disabled = true;
  }

  document.getElementById('game-status-logs').textContent = `${nickname} è uscito.`;
});

// START QUESTION PHASE
socket.on('new-question', (data) => {
  const { questionIndex, totalQuestions, questionText, options, mediaUrl, mediaType } = data;

  // Stop lobby music if it's the first question
  stopAudio(audioLobby);
  stopAudio(audioVictory);

  // Toggle visible views
  showView('view-question');
  
  // Reset HUD inputs
  const nextBtn = document.getElementById('next-step-btn');
  nextBtn.style.display = 'block';
  nextBtn.textContent = 'CHIUDI E SVELA';
  nextBtn.classList.add('pulse-btn');
  document.getElementById('q-counter').textContent = `Domanda ${questionIndex + 1} di ${totalQuestions}`;
  document.getElementById('question-text').textContent = questionText;
  document.getElementById('answers-submitted-count').textContent = '0';
  document.getElementById('answers-total-players').textContent = totalPlayersCount;
  
  // Render options previews (bottom list)
  const optionsGrid = document.getElementById('presenter-preview-options');
  optionsGrid.innerHTML = '';
  options.forEach((opt, index) => {
    const card = document.createElement('div');
    card.className = `presenter-opt-card opt-${opt.label.toLowerCase()}`;
    card.id = `preview-card-${opt.label}`;
    card.innerHTML = `
      <span class="presenter-opt-letter">${opt.label}</span>
      <span>${opt.text}</span>
    `;
    optionsGrid.appendChild(card);
  });

  // Dynamically hide chart bars C and D if there are only 2 options
  const letterLabels = ['A', 'B', 'C', 'D'];
  letterLabels.forEach((letter, index) => {
    const barWrapper = document.getElementById(`bar-wrapper-${letter}`);
    if (barWrapper) {
      if (index < options.length) {
        barWrapper.style.display = 'flex';
      } else {
        barWrapper.style.display = 'none';
      }
    }
  });

  // Hide all chart visualization containers first
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

  // Check if we need to show the custom visualizations
  const activeQuestion = currentQuiz && currentQuiz.questions[questionIndex];
  const visType = activeQuestion ? activeQuestion.visualization : 'bar-chart';

  if (visType === 'cola-glass') {
    document.getElementById('cola-glass-visualization').style.display = 'flex';
    document.getElementById('cola-liquid-A').style.height = '0%';
    document.getElementById('cola-liquid-B').style.height = '0%';
    document.getElementById('cola-val-A').textContent = '0 voti (0%)';
    document.getElementById('cola-val-B').textContent = '0 voti (0%)';
    
    // Reset glass style highlights
    const glasses = document.querySelectorAll('.cola-glass');
    glasses.forEach(g => {
      g.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
      g.style.borderColor = 'rgba(255, 255, 255, 0.45)';
    });
    const wrappers = document.querySelectorAll('.cola-glass-wrapper');
    wrappers.forEach(w => w.style.opacity = '1.0');

    generateColaBubbles('cola-liquid-A');
    generateColaBubbles('cola-liquid-B');

  } else if (visType === 'stretching-silhouettes') {
    document.getElementById('silhouettes-visualization').style.display = 'flex';
    document.getElementById('silhouette-body-A').style.height = '90px';
    document.getElementById('silhouette-body-B').style.height = '90px';
    document.getElementById('silhouette-val-A').textContent = '0 voti';
    document.getElementById('silhouette-val-B').textContent = '0 voti';

    // Reset highlights
    const bodies = document.querySelectorAll('.silhouette-body');
    bodies.forEach(b => {
      b.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4)';
    });
    const wrappers = document.querySelectorAll('.silhouette-wrapper');
    wrappers.forEach(w => w.style.opacity = '1.0');

  } else if (visType === 'fish-bowl') {
    document.getElementById('fishbowls-visualization').style.display = 'flex';
    document.getElementById('fishbowl-water-A').innerHTML = '';
    document.getElementById('fishbowl-water-B').innerHTML = '';
    document.getElementById('fishbowl-val-A').textContent = '0 pesci';
    document.getElementById('fishbowl-val-B').textContent = '0 pesci';

    // Reset highlights
    const bowls = document.querySelectorAll('.fishbowl');
    bowls.forEach(b => {
      b.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
      b.style.borderColor = 'rgba(255, 255, 255, 0.45)';
    });
    const wrappers = document.querySelectorAll('.fishbowl-wrapper');
    wrappers.forEach(w => w.style.opacity = '1.0');

  } else if (visType === 'word-cloud') {
    document.getElementById('wordcloud-visualization').style.display = 'flex';
    // Hide the options list at the bottom for word-cloud
    document.getElementById('presenter-preview-options').style.display = 'none';
    const letters = ['A', 'B', 'C', 'D'];
    letters.forEach(letter => {
      const el = document.getElementById('word-' + letter);
      if (el) {
        el.style.fontSize = '2rem';
        el.style.opacity = '1.0';
      }
    });

  } else {
    document.getElementById('votes-chart').style.display = 'flex';
    // Ensure the options list is visible for standard charts
    document.getElementById('presenter-preview-options').style.display = 'grid';
    // Reset live vote chart columns to minimum height (10px) and values to 0
    const letterLabels = ['A', 'B', 'C', 'D'];
    letterLabels.forEach(letter => {
      const bar = document.getElementById(`bar-${letter}`);
      if (bar) {
        bar.style.height = '10px';
        bar.classList.remove('correct'); // Reset correctness highlights
      }
      const valText = document.getElementById(`val-${letter}`);
      if (valText) valText.textContent = '0';
    });
  }

  // Set Media Box (convention customizable image/video loader)
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

  document.getElementById('game-status-logs').textContent = `Domanda ${questionIndex + 1} proiettata.`;
});



// LIVE VOTE CHART UPDATE (when players vote)
socket.on('vote-updated', (data) => {
  const { answersReceived, totalPlayers, votesCount } = data;
  document.getElementById('answers-submitted-count').textContent = answersReceived;

  const isColaActive = (document.getElementById('cola-glass-visualization').style.display === 'flex');
  const isSilhouettesActive = (document.getElementById('silhouettes-visualization').style.display === 'flex');
  const isFishActive = (document.getElementById('fishbowls-visualization').style.display === 'flex');
  const isWordCloudActive = (document.getElementById('wordcloud-visualization').style.display === 'flex');

  const maxPlayers = totalPlayers || 1;

  if (isColaActive) {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;
    const percentA = Math.round((votesA / maxPlayers) * 100);
    const percentB = Math.round((votesB / maxPlayers) * 100);

    document.getElementById('cola-liquid-A').style.height = `${percentA}%`;
    document.getElementById('cola-liquid-B').style.height = `${percentB}%`;

    document.getElementById('cola-val-A').textContent = `${votesA} ${votesA === 1 ? 'voto' : 'voti'} (${percentA}%)`;
    document.getElementById('cola-val-B').textContent = `${votesB} ${votesB === 1 ? 'voto' : 'voti'} (${percentB}%)`;

  } else if (isSilhouettesActive) {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;

    // A stretches taller: from 90px base up to 170px
    const heightA = 90 + Math.round((votesA / maxPlayers) * 80);
    // B squashes shorter: from 90px base down to 45px
    const heightB = 90 - Math.round((votesB / maxPlayers) * 45);

    document.getElementById('silhouette-body-A').style.height = `${heightA}px`;
    document.getElementById('silhouette-body-B').style.height = `${heightB}px`;

    document.getElementById('silhouette-val-A').textContent = `${votesA} ${votesA === 1 ? 'voto' : 'voti'}`;
    document.getElementById('silhouette-val-B').textContent = `${votesB} ${votesB === 1 ? 'voto' : 'voti'}`;

  } else if (isFishActive) {
    const votesA = votesCount['A'] || 0;
    const votesB = votesCount['B'] || 0;

    updateBowlFish('fishbowl-water-A', votesA);
    updateBowlFish('fishbowl-water-B', votesB);

    document.getElementById('fishbowl-val-A').textContent = `${votesA} ${votesA === 1 ? 'pesce' : 'pesci'}`;
    document.getElementById('fishbowl-val-B').textContent = `${votesB} ${votesB === 1 ? 'pesce' : 'pesci'}`;

  } else if (isWordCloudActive) {
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
    // Re-scale chart heights based on percent distribution
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
});

// REVEAL CORRECT ANSWER PHASE
socket.on('question-ended', (data) => {
  const { correctOption, correctIndex, votes, playersStats } = data;

  // Play Buzzer
  playAudio(audioBuzzer);

  // Play reveal fan-fare shortly after
  setTimeout(() => {
    playAudio(audioReveal);
  }, 300);

  // Highlight correct answer card in preview options
  const previewOptions = document.getElementById('presenter-preview-options').children;
  for (let i = 0; i < previewOptions.length; i++) {
    if (previewOptions[i].id !== `preview-card-${correctOption}`) {
      previewOptions[i].style.opacity = '0.3'; // dim wrong options
    }
  }

  // Highlight correct bar in chart
  const correctBar = document.getElementById(`bar-${correctOption}`);
  if (correctBar) {
    correctBar.classList.add('correct');
  }

  // Highlight correct Coca-Cola glass (if active)
  const isColaActive = (document.getElementById('cola-glass-visualization').style.display === 'flex');
  if (isColaActive) {
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
  const isSilhouettesActive = (document.getElementById('silhouettes-visualization').style.display === 'flex');
  if (isSilhouettesActive) {
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
  const isFishActive = (document.getElementById('fishbowls-visualization').style.display === 'flex');
  if (isFishActive) {
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

  // Astronaut-reveal (Question 8, C correct)
  const isAstronautReveal = (currentQuiz && currentQuiz.questions[correctIndex] && currentQuiz.questions[correctIndex].visualization === 'astronaut-reveal');
  if (isAstronautReveal) {
    const correctCard = document.getElementById(`preview-card-${correctOption}`);
    if (correctCard && !correctCard.querySelector('.moon-reveal-badge')) {
      const badge = document.createElement('span');
      badge.className = 'moon-reveal-badge';
      badge.style.marginLeft = 'auto';
      badge.style.fontSize = '1.8rem';
      badge.style.animation = 'popIn 0.5s ease-out forwards';
      badge.textContent = '🇺🇸 👨‍🚀';
      correctCard.appendChild(badge);
    }
  }

  // Word Cloud highlights (Question 9, poll)
  const isWordCloudActive = (document.getElementById('wordcloud-visualization').style.display === 'flex');
  if (isWordCloudActive) {
    let letters = ['A', 'B', 'C', 'D'];
    let maxVotes = -1;
    let winnerLetter = 'A';
    
    // Find winner
    letters.forEach(letter => {
      const votes = votes[letter] || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        winnerLetter = letter;
      }
    });

    // Dim losers
    letters.forEach(letter => {
      const el = document.getElementById('word-' + letter);
      if (el && letter !== winnerLetter && maxVotes > 0) {
        el.style.opacity = '0.25';
      }
    });
  }

  // Reveal next progression button
  const nextBtn = document.getElementById('next-step-btn');
  nextBtn.style.display = 'block';
  nextBtn.textContent = 'DOMANDA SUCCESSIVA';
  nextBtn.classList.remove('pulse-btn');
  document.getElementById('game-status-logs').textContent = `La risposta corretta è la ${correctOption}.`;
});

// SCOREBOARD LOBBY (Skipped now)
socket.on('show-leaderboard', (data) => {
  // We no longer display the leaderboard view
  // Server will automatically skip this state anyway
});

// GAME OVER FINAL STANDINGS
socket.on('game-over', (data) => {
  showView('view-gameover');
});

// Host disconnected alert
socket.on('room-closed', (data) => {
  alert(data.message);
  window.location.href = 'index.html';
});

// 3. EMISSION TRIGGERS FROM BUTTONS
function emitStartGame() {
  if (!roomCode) return;
  socket.emit('host-start-game', { roomCode });
}

function emitNextStep() {
  if (!roomCode) return;
  socket.emit('host-next-step', { roomCode });
}

// 4. GENERAL HELPER FOR TOGGLING VIEWS
function showView(viewId) {
  const views = ['view-lobby', 'view-question', 'view-leaderboard', 'view-gameover'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (v === viewId) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
}

// Helper to generate dynamic cola bubbles rising
function generateColaBubbles(liquidId) {
  const container = document.getElementById(liquidId);
  if (!container) return;
  // Remove existing bubbles (keeping the foam div)
  const existingBubbles = container.querySelectorAll('.cola-bubble');
  existingBubbles.forEach(b => b.remove());
  
  // Add 15 new random bubbles
  for (let i = 0; i < 15; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'cola-bubble';
    bubble.style.left = `${Math.random() * 95}%`;
    bubble.style.animationDelay = `${Math.random() * 2.0}s`;
    bubble.style.setProperty('--drift', `${Math.random() * 30 - 15}px`);
    
    // Random size scale (2px to 5px)
    const size = Math.random() * 3 + 2;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    container.appendChild(bubble);
  }
}

// Helper to spawn/remove little goldfish in bowl water dynamically
function updateBowlFish(waterId, targetCount) {
  const container = document.getElementById(waterId);
  if (!container) return;
  const currentCount = container.querySelectorAll('.little-fish').length;

  if (currentCount < targetCount) {
    const diff = targetCount - currentCount;
    for (let i = 0; i < diff; i++) {
      const fish = document.createElement('div');
      fish.className = 'little-fish';
      // Restrict coordinate ranges to stay inside circular container
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

function openProjectionWindow() {
  if (roomCode) {
    window.open(`projection.html?pin=${roomCode}`, '_blank');
  }
}
