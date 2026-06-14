const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory game state
// roomCode -> { hostId, state, players: { socketId: { nickname, score, prevScore, lastCorrect } }, questions, currentQuestionIndex, answersReceived, votes: { 'A': 0, ... }, questionTimer, secondsLeft, questionStartTime }
const rooms = new Map();

// Helper to generate 6-digit game pin
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. HOST: Create Room
  socket.on('host-create-room', (data) => {
    const { questions } = data;
    const roomCode = generateRoomCode();
    
    rooms.set(roomCode, {
      hostId: socket.id,
      state: 'LOBBY',
      players: new Map(),
      questions: questions || [],
      currentQuestionIndex: -1,
      answersReceived: 0,
      votes: {},
      questionTimer: null,
      secondsLeft: 0,
      questionStartTime: 0
    });

    socket.join(roomCode);
    socket.emit('room-created', { roomCode });
    console.log(`Room created: ${roomCode} by host: ${socket.id}`);
  });

  // 2. PLAYER: Join Room
  socket.on('player-join', (data) => {
    const { roomCode, nickname } = data;
    
    if (!roomCode || !nickname) {
      return socket.emit('join-error', { message: 'PIN e Nickname richiesti.' });
    }

    const room = rooms.get(roomCode);
    if (!room) {
      return socket.emit('join-error', { message: 'Stanza non trovata. Controlla il PIN.' });
    }

    if (room.state !== 'LOBBY') {
      return socket.emit('join-error', { message: 'Il gioco è già iniziato.' });
    }

    // Check duplicate nickname
    for (const player of room.players.values()) {
      if (player.nickname.toLowerCase() === nickname.trim().toLowerCase()) {
        return socket.emit('join-error', { message: 'Questo nickname è già in uso.' });
      }
    }

    // Add player to room map
    const playerObj = {
      socketId: socket.id,
      nickname: nickname.trim(),
      score: 0,
      prevScore: 0,
      lastCorrect: false,
      answered: false
    };

    room.players.set(socket.id, playerObj);
    socket.join(roomCode);
    
    // Notify player
    socket.emit('join-success', { 
      roomCode, 
      nickname: playerObj.nickname,
      playerId: socket.id 
    });

    // Notify host and other players
    io.to(room.hostId).emit('player-joined', { 
      nickname: playerObj.nickname,
      id: socket.id,
      playerCount: room.players.size
    });

    console.log(`Player ${playerObj.nickname} joined room ${roomCode}`);
  });

  // 3. HOST: Start Game
  socket.on('host-start-game', (data) => {
    const { roomCode } = data;
    const room = rooms.get(roomCode);
    
    if (!room || room.hostId !== socket.id) return;
    if (room.players.size === 0) {
      return socket.emit('host-error', { message: 'Nessun giocatore in stanza.' });
    }

    room.currentQuestionIndex = 0;
    startQuestion(roomCode, room);
  });

  // Helper to start a question
  function startQuestion(roomCode, room) {
    // Reset answers tracker
    room.answersReceived = 0;
    room.votes = {};
    room.state = 'QUESTION';

    const question = room.questions[room.currentQuestionIndex];
    if (!question) return;

    // Reset player answered flags
    for (const player of room.players.values()) {
      player.answered = false;
    }

    // Initialize votes structure
    question.options.forEach((opt, idx) => {
      room.votes[String.fromCharCode(65 + idx)] = 0; // A, B, C, D
    });

    // Setup timer (not used anymore, questions are manual)
    room.secondsLeft = 999;
    room.questionStartTime = Date.now();

    // Broadcast event
    io.to(roomCode).emit('new-question', {
      questionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      questionText: question.text,
      options: question.options.map((opt, idx) => ({
        label: String.fromCharCode(65 + idx),
        text: opt
      })),
      timer: 999,
      mediaUrl: question.mediaUrl || '',
      mediaType: question.mediaType || 'none'
    });

    // Host countdown loop REMOVED
    if (room.questionTimer) clearInterval(room.questionTimer);
  }

  // Helper to end a question (reveal correct answer)
  function endQuestion(roomCode, room) {
    if (room.questionTimer) clearInterval(room.questionTimer);
    room.state = 'REVEAL';

    const question = room.questions[room.currentQuestionIndex];
    const correctOptionLetter = String.fromCharCode(65 + question.correctAnswer); // e.g. 'A'

    // Update scores for players who haven't answered (they get 0)
    for (const player of room.players.values()) {
      if (!player.answered) {
        player.lastCorrect = false;
        player.prevScore = player.score;
      }
    }

    io.to(roomCode).emit('question-ended', {
      correctOption: correctOptionLetter,
      correctIndex: question.correctAnswer,
      votes: room.votes,
      playersStats: Array.from(room.players.values()).map(p => ({
        nickname: p.nickname,
        lastCorrect: p.lastCorrect,
        score: p.score,
        prevScore: p.prevScore
      }))
    });
  }

  // 4. PLAYER: Submit Answer
  socket.on('player-submit-answer', (data) => {
    const { roomCode, answer } = data; // answer: 'A', 'B', 'C', 'D'
    const room = rooms.get(roomCode);
    
    if (!room || room.state !== 'QUESTION') return;
    
    const player = room.players.get(socket.id);
    if (!player || player.answered) return;

    player.answered = true;
    room.answersReceived++;

    const question = room.questions[room.currentQuestionIndex];
    const isPoll = (question.correctAnswer === -1 || question.correctAnswer === null || question.correctAnswer === undefined);
    const correctLetter = isPoll ? null : String.fromCharCode(65 + question.correctAnswer);
    const isCorrect = isPoll ? false : (answer === correctLetter);

    // Calculate time taken in ms
    const timeTakenMs = Date.now() - room.questionStartTime;
    const maxTimeMs = (parseInt(question.timer) || 20) * 1000;
    
    // Points calculation (Kahoot-style):
    // Correct answer gets between 500 and 1000 points based on speed.
    let pointsEarned = 0;
    if (!isPoll && isCorrect) {
      const speedFactor = Math.max(0, 1 - (timeTakenMs / maxTimeMs));
      pointsEarned = Math.round(500 + (speedFactor * 500));
    }

    player.prevScore = player.score;
    player.score += pointsEarned;
    player.lastCorrect = isCorrect;

    // Track vote count
    room.votes[answer] = (room.votes[answer] || 0) + 1;

    // Acknowledge to player
    socket.emit('answer-acknowledged', { isCorrect, pointsEarned, isPoll });

    // Emit live stats update to Host only (do not reveal answers, just vote counts)
    io.to(room.hostId).emit('vote-updated', {
      answersReceived: room.answersReceived,
      totalPlayers: room.players.size,
      votesCount: room.votes // Emits vote counts for charts
    });

    // Check if everyone has answered
    if (room.answersReceived >= room.players.size) {
      clearInterval(room.questionTimer);
      endQuestion(roomCode, room);
    }
  });

  // 5. HOST: Next Step (Manual Progression)
  socket.on('host-next-step', (data) => {
    const { roomCode } = data;
    const room = rooms.get(roomCode);
    
    if (!room || room.hostId !== socket.id) return;

    if (room.state === 'QUESTION') {
      // Manual host stop
      if (room.questionTimer) clearInterval(room.questionTimer);
      endQuestion(roomCode, room);
    }
    else if (room.state === 'REVEAL') {
      // Skip LEADERBOARD, go directly to next question or end game
      room.currentQuestionIndex++;
      
      if (room.currentQuestionIndex < room.questions.length) {
        startQuestion(roomCode, room);
      } else {
        // Game Over!
        room.state = 'GAME_OVER';
        // Send an empty standings array since we removed points
        io.to(roomCode).emit('game-over', { standings: [] });
      }
    }
  });

  // 6. DISCONNECT
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find room the user belongs to
    for (const [roomCode, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        // Host disconnected -> tear down room after warning
        console.log(`Host disconnected, deleting room ${roomCode}`);
        io.to(roomCode).emit('room-closed', { message: 'Il presentatore ha chiuso la sessione.' });
        
        if (room.questionTimer) clearInterval(room.questionTimer);
        rooms.delete(roomCode);
        break;
      } else if (room.players.has(socket.id)) {
        // Player disconnected -> notify host
        const player = room.players.get(socket.id);
        room.players.delete(socket.id);
        
        console.log(`Player ${player.nickname} left room ${roomCode}`);
        
        io.to(room.hostId).emit('player-left', {
          id: socket.id,
          nickname: player.nickname,
          playerCount: room.players.size
        });

        // If in QUESTION, check if all active players have answered
        if (room.state === 'QUESTION') {
          // Adjust answersReceived if the player who disconnected had already answered
          // To be simple, we check if everyone left has answered
          const answeredCount = Array.from(room.players.values()).filter(p => p.answered).length;
          room.answersReceived = answeredCount;

          io.to(room.hostId).emit('vote-updated', {
            answersReceived: room.answersReceived,
            totalPlayers: room.players.size,
            votesCount: room.votes
          });

          if (room.players.size > 0 && room.answersReceived >= room.players.size) {
            clearInterval(room.questionTimer);
            endQuestion(roomCode, room);
          }
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`=== MULTITEMER SERVER RUNNING ON PORT ${PORT} ===`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`To play, connect devices to the same network and navigate to http://YOUR_IP:${PORT}`);
});
