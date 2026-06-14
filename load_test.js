const { fork } = require('child_process');
const ioClient = require('socket.io-client');

// 1. Start the server as a child process
console.log("=== INIZIO SIMULAZIONE DI CARICO (300 GIOCATORI) ===");
console.log("Avvio del server di gioco in corso...");
const serverProcess = fork('server.js', [], { silent: true });

// Capture server output for debugging
serverProcess.stdout.on('data', (data) => {
  // console.log(`[SERVER]: ${data.toString().trim()}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`[SERVER ERROR]: ${data.toString().trim()}`);
});

// Wait for server to boot
setTimeout(() => {
  startSimulation();
}, 2000);

const questionsMock = [
  {
    text: "La Coca-Cola aiuta a digerire?",
    timer: 5, // Shorter timer for fast simulation
    correctAnswer: 1,
    options: ["Sì", "No"],
    visualization: "cola-glass"
  },
  {
    text: "Nello spazio si diventa più alti?",
    timer: 5,
    correctAnswer: 0,
    options: ["Vero", "Falso"],
    visualization: "stretching-silhouettes"
  }
];

function startSimulation() {
  const SERVER_URL = 'http://localhost:3000';
  console.log(`Connessione al server: ${SERVER_URL}`);

  const hostSocket = ioClient(SERVER_URL);
  let roomCode = null;
  const players = [];
  const TOTAL_PLAYERS = 300;
  
  let joinsCompleted = 0;
  let answersCompleted = 0;
  let startJoinTime = 0;
  let startAnswerTime = 0;

  // --- HOST HANDLERS ---
  hostSocket.on('connect', () => {
    console.log("Host connesso. Creazione stanza...");
    hostSocket.emit('host-create-room', { questions: questionsMock });
  });

  hostSocket.on('room-created', (data) => {
    roomCode = data.roomCode;
    console.log(`Stanza creata con successo! PIN: ${roomCode}`);
    console.log(`Inizio connessione di ${TOTAL_PLAYERS} giocatori in parallelo...`);
    
    startJoinTime = Date.now();
    spawnPlayers(roomCode);
  });

  hostSocket.on('player-joined', (data) => {
    joinsCompleted++;
    if (joinsCompleted === TOTAL_PLAYERS) {
      const elapsed = (Date.now() - startJoinTime) / 1000;
      console.log(`=== LOBBY COMPLETATA ===`);
      console.log(`Tutti i ${TOTAL_PLAYERS} giocatori sono entrati nella stanza in ${elapsed.toFixed(2)} secondi.`);
      console.log(`Velocità di connessione media: ${(TOTAL_PLAYERS / elapsed).toFixed(1)} giocatori/secondo.`);
      
      // Memory check
      const memory = process.memoryUsage();
      console.log(`Uso memoria script di test: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      
      // Start the game
      console.log("Host avvia il gioco...");
      hostSocket.emit('host-start-game', { roomCode });
    }
  });

  hostSocket.on('vote-updated', (data) => {
    // Sync answer completion tracking
    // We print stats every 50 votes to not flood the logs
    if (data.answersReceived % 50 === 0 || data.answersReceived === TOTAL_PLAYERS) {
      console.log(`Risposte ricevute: ${data.answersReceived} / ${TOTAL_PLAYERS}`);
    }
    
    // Automatically close the question if all players have answered
    if (data.answersReceived === TOTAL_PLAYERS) {
      console.log("Tutti i giocatori hanno risposto. Host svela la risposta...");
      hostSocket.emit('host-next-step', { roomCode });
    }
  });

  hostSocket.on('question-ended', (data) => {
    const elapsed = (Date.now() - startAnswerTime) / 1000;
    console.log(`=== DOMANDA TERMINATA ===`);
    console.log(`Tutte le risposte elaborate in ${elapsed.toFixed(2)}s.`);
    console.log(`Velocità di elaborazione risposte: ${(TOTAL_PLAYERS / elapsed).toFixed(1)} risposte/secondo.`);
    console.log(`Distribuzione voti:`, data.votes);
    
    // Proceed to leaderboard
    console.log("Host richiede la classifica...");
    hostSocket.emit('host-next-step', { roomCode });
  });

  hostSocket.on('game-over', (data) => {
    console.log("Stato di gioco completato ricevuto dall'host.");

    // Cleanup and terminate
    console.log("=== SIMULAZIONE COMPLETATA CON SUCCESSO ===");
    console.log("Chiusura del server e terminazione test...");
    
    // Disconnect everyone
    hostSocket.disconnect();
    players.forEach(p => p.disconnect());
    
    // Kill child server process
    serverProcess.kill();
    
    console.log("Server spento. Simulazione terminata senza errori.");
    process.exit(0);
  });

  // --- PLAYER SPAWNER ---
  function spawnPlayers(pin) {
    for (let i = 1; i <= TOTAL_PLAYERS; i++) {
      // Connect players in parallel
      const playerSocket = ioClient(SERVER_URL, {
        forceNew: true,
        transports: ['websocket']
      });

      playerSocket.on('connect', () => {
        playerSocket.emit('player-join', {
          roomCode: pin,
          nickname: `Player_${i}`
        });
      });

      playerSocket.on('new-question', (qData) => {
        let answeredThisRound = false;
        // Simulate thinking time (random delay between 500ms and 2500ms)
        const delay = 500 + Math.random() * 2000;
        
        setTimeout(() => {
          // Vote A or B randomly
          const choice = Math.random() > 0.5 ? 'A' : 'B';
          
          if (i === 1) {
            startAnswerTime = Date.now(); // benchmark time from first answer
          }

          playerSocket.emit('player-submit-answer', {
            roomCode: pin,
            answer: choice
          });
        }, delay);
      });

      playerSocket.on('answer-acknowledged', (ack) => {
        // Player received acknowledgement
      });

      players.push(playerSocket);
    }
  }
}
