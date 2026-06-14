#!/bin/bash

# Navigate to the project directory
CWD="/Users/test/Desktop/fatturazione/mentimeter_clone"
cd "$CWD"

clear
echo "========================================================="
echo "               MULTITEMER STARTUP ENGINE                 "
echo "========================================================="
echo ""

# 1. Free port 3000 safely
echo "1. Liberazione porta 3000..."
PORT_PID=$(lsof -t -i:3000)
if [ ! -z "$PORT_PID" ]; then
    echo "Arresto del processo $PORT_PID sulla porta 3000..."
    kill -9 $PORT_PID
    sleep 0.5
else
    echo "Porta 3000 libera."
fi

# 2. Start node server.js in background
echo "2. Avvio del server in background..."
node server.js > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "Server avviato con successo! (PID: $SERVER_PID)"
else
    echo "ERRORE: Impossibile avviare il server. Controlla il log 'server.log' nella cartella."
    exit 1
fi

echo ""
echo "3. Avvio della connessione a Internet..."
echo "---------------------------------------------------------"
echo "Cerca il link 'https://...' che apparirà tra poco!"
echo "Copia quel link e incollalo sul browser per giocare."
echo "---------------------------------------------------------"
echo "Premi CTRL+C per spegnere il gioco."
echo "========================================================="
echo ""

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Arresto del server di gioco..."
    kill -9 $SERVER_PID 2>/dev/null
    echo "Gioco arrestato. Puoi chiudere questa finestra."
    exit 0
}

# Trap Ctrl+C and exit signals
trap cleanup EXIT INT TERM

# 4. Start localhost.run in foreground so they see the URL
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run
