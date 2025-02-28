/***************
 *  FIREBASE SETUP
 **************/
const firebaseConfig = {
    apiKey: "AIzaSyDXJLXvjiRXkbg-A0Py2nxXk8TyhwaKaF8",
    authDomain: "wordchaingame-e32b7.firebaseapp.com",
    projectId: "wordchaingame-e32b7",
    storageBucket: "wordchaingame-e32b7.firebasestorage.app",
    messagingSenderId: "172357480181",
    appId: "1:172357480181:web:fd86b0cd26a4e43056dfbc",
    measurementId: "G-MS951GN206"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Reference to the database
  const db = firebase.database();
  
  /***************
   *  DOM ELEMENTS
   **************/
  const setupPanel = document.getElementById('setup');
  const wordEntryPanel = document.getElementById('wordEntry');
  const gameBoardPanel = document.getElementById('gameBoard');
  
  const playerNameInput = document.getElementById('playerName');
  const gameIdInput = document.getElementById('gameId');
  const createGameBtn = document.getElementById('createGameBtn');
  const joinGameBtn = document.getElementById('joinGameBtn');
  const setupMessage = document.getElementById('setupMessage');
  
  const wordListTextarea = document.getElementById('wordList');
  const submitWordsBtn = document.getElementById('submitWordsBtn');
  const entryMessage = document.getElementById('entryMessage');
  
  const statusDiv = document.getElementById('status');
  const currentClueDiv = document.getElementById('currentClue');
  const guessInput = document.getElementById('guessInput');
  const guessBtn = document.getElementById('guessBtn');
  const revealLetterBtn = document.getElementById('revealLetterBtn');
  const guessMessage = document.getElementById('guessMessage');
  
  /***************
   *  GAME STATE
   **************/
  let localPlayerName = "";
  let localGameId = "";
  let localPlayerId = ""; // "player1" or "player2"
  let wordsPlayer1 = [];
  let wordsPlayer2 = [];
  let isGameCreator = false;
  
  /***************
   *  EVENT LISTENERS
   **************/
  createGameBtn.addEventListener('click', createNewGame);
  joinGameBtn.addEventListener('click', joinExistingGame);
  submitWordsBtn.addEventListener('click', submitWords);
  guessBtn.addEventListener('click', submitGuess);
  revealLetterBtn.addEventListener('click', revealNextLetter);
  
  /************************
   *  CREATE OR JOIN GAME
   ************************/
  function createNewGame() {
    localPlayerName = playerNameInput.value.trim();
    if (!localPlayerName) {
      setupMessage.textContent = "Please enter a name.";
      return;
    }
  
    // Generate a unique game ID
    localGameId = generateGameId();
    localPlayerId = "player1";
    isGameCreator = true;
  
    // Initialize game data in Realtime Database
    db.ref(`games/${localGameId}`).set({
      player1: {
        name: localPlayerName,
        words: [],
        currentIndex: 0,
        isReady: false
      },
      player2: {
        name: "",
        words: [],
        currentIndex: 0,
        isReady: false
      },
      turn: "player1", // player1 starts
      gameActive: true,
      winner: null
    }).then(() => {
      setupMessage.textContent = `Game created with ID: ${localGameId}. Share this ID with your opponent.`;
      // Move to word entry
      setupPanel.style.display = 'none';
      wordEntryPanel.style.display = 'block';
    });
  }
  
  function joinExistingGame() {
    localPlayerName = playerNameInput.value.trim();
    localGameId = gameIdInput.value.trim();
    if (!localPlayerName || !localGameId) {
      setupMessage.textContent = "Please enter your name and the Game ID.";
      return;
    }
  
    // Attempt to join as player2
    db.ref(`games/${localGameId}`).once('value', (snapshot) => {
      if (!snapshot.exists()) {
        setupMessage.textContent = "Game ID not found.";
        return;
      }
  
      const gameData = snapshot.val();
      if (gameData.player2.name && gameData.player1.name) {
        setupMessage.textContent = "Game is already full.";
        return;
      }
  
      if (!gameData.player1.name) {
        // If the game creator hasn't even set up themselves, something’s off
        setupMessage.textContent = "Creator has not set up this game yet.";
        return;
      }
  
      // Join as player2
      localPlayerId = "player2";
      db.ref(`games/${localGameId}/player2`).update({
        name: localPlayerName
      }).then(() => {
        setupMessage.textContent = `Joined game with ID: ${localGameId}`;
        // Move to word entry
        setupPanel.style.display = 'none';
        wordEntryPanel.style.display = 'block';
      });
    });
  }
  
  /*******************
   *  SUBMIT WORD LIST
   *******************/
  function submitWords() {
    const rawWords = wordListTextarea.value.trim();
    if (!rawWords) {
      entryMessage.textContent = "Please enter at least one phrase.";
      return;
    }
  
    // Parse phrases (each line or comma-delimited) into an array
    const wordArr = rawWords
      .split(/[\n,]+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  
    // NEW LOGIC: Validate that the last word of phrase[i-1] 
    // matches the first word of phrase[i].
    for (let i = 1; i < wordArr.length; i++) {
      const prevWords = wordArr[i - 1].trim().split(/\s+/);
      const currWords = wordArr[i].trim().split(/\s+/);
  
      const prevLastWord = prevWords[prevWords.length - 1].toLowerCase();
      const currFirstWord = currWords[0].toLowerCase();
  
      if (prevLastWord !== currFirstWord) {
        entryMessage.textContent = `Word chain error at "${wordArr[i - 1]}" → "${wordArr[i]}". 
          The last word of the previous phrase must match the first word of the next.`;
        return;
      }
    }
  
    // If validation passes, update the Firebase database
    const updates = {};
    updates[`games/${localGameId}/${localPlayerId}/words`] = wordArr;
    updates[`games/${localGameId}/${localPlayerId}/isReady`] = true;
  
    db.ref().update(updates).then(() => {
      entryMessage.textContent = "Word list submitted. Waiting for other player...";
  
      // Continue listening for the other player's readiness...
      db.ref(`games/${localGameId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        });
    });
  }
  
    // Update in DB
    
    const updates = {};
    updates[`games/${localGameId}/${localPlayerId}/words`] = wordArr;
    updates[`games/${localGameId}/${localPlayerId}/isReady`] = true;
  
    db.ref().update(updates).then(() => {
      entryMessage.textContent = "Word list submitted. Waiting for other player...";
  
      // Listen for both players ready
      db.ref(`games/${localGameId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
  
        // Store local references
        wordsPlayer1 = data.player1.words || [];
        wordsPlayer2 = data.player2.words || [];
  
        if (data.player1.isReady && data.player2.isReady) {
          // Both players ready -> start game
          wordEntryPanel.style.display = 'none';
          gameBoardPanel.style.display = 'block';
          initGameListener();
        }
      });
    });
  }
  
  /*********************
   *  MAIN GAME LISTENER
   *********************/
  function initGameListener() {
    db.ref(`games/${localGameId}`).on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.gameActive) return;
  
      // Check for a winner
      if (data.winner) {
        displayWinner(data.winner, data[data.winner].name);
        return;
      }
  
      // Identify whose turn it is
      const currentTurn = data.turn;
      statusDiv.textContent = `It's ${data[currentTurn].name}'s turn.`;
  
      // Grab the relevant word list and current index for the *opponent*, 
      // because that's whose word we are guessing.
      let opponentId = (currentTurn === 'player1') ? 'player2' : 'player1';
      // If we are the opponent, we get to guess. Otherwise, we wait.
  
      const opponentWords = data[opponentId].words;
      const opponentIndex = data[opponentId].currentIndex;
      if (opponentIndex >= opponentWords.length) {
        // Opponent has finished their list => they might be the winner,
        // but let's rely on the final check. 
        currentClueDiv.textContent = "Opponent has no more words!";
        return;
      }
  
      const targetWord = opponentWords[opponentIndex];
      
      // Build partial clue from data we store (or we can store it dynamically)
      // For simplicity, let's store partial guess in the DB. 
      // We could store how many letters are revealed so far.
      if (!data.partialReveal) {
        // If partialReveal doesn't exist in DB, create it with 1 letter (the first letter)
        if (currentTurn === localPlayerId) {
          // Only the active player's code updates partial reveal
          db.ref(`games/${localGameId}`).update({
            partialReveal: 1
          });
        }
      }
  
      let partialReveal = data.partialReveal || 1;
      let revealedString = targetWord.substring(0, partialReveal);
      currentClueDiv.textContent = `Clue: ${revealedString} ${"_".repeat(targetWord.length - partialReveal)}`;
  
      // If partialReveal == targetWord.length, it's fully revealed
    });
  }
  
  /******************************
   *  GUESS & REVEAL LETTER LOGIC
   ******************************/
  function submitGuess() {
    const guess = guessInput.value.trim();
    if (!guess) return;
  
    db.ref(`games/${localGameId}`).once('value')
      .then((snapshot) => {
        const data = snapshot.val();
        const currentTurn = data.turn;
        const opponentId = (currentTurn === 'player1') ? 'player2' : 'player1';
        const opponentWords = data[opponentId].words;
        const opponentIndex = data[opponentId].currentIndex;
        const targetWord = opponentWords[opponentIndex];
  
        if (guess.toLowerCase() === targetWord.toLowerCase()) {
          // Correct guess
          guessMessage.textContent = "Correct guess!";
          guessInput.value = "";
  
          // Advance opponent's currentIndex
          let newIndex = opponentIndex + 1;
          let updates = {};
          updates[`games/${localGameId}/${opponentId}/currentIndex`] = newIndex;
  
          // Check if opponent has finished
          if (newIndex >= opponentWords.length) {
            // This means the opponent has no more words -> current turn player guesses them all
            // The current turn player wins
            updates[`games/${localGameId}/winner`] = currentTurn;
            updates[`games/${localGameId}/gameActive`] = false;
          } else {
            // Switch turn
            updates[`games/${localGameId}/turn`] = opponentId;
            // Reset partial reveal
            updates[`games/${localGameId}/partialReveal`] = 1;
          }
  
          return db.ref().update(updates);
        } else {
          guessMessage.textContent = "Wrong guess. Try revealing more letters or guess again.";
        }
      });
  }
  
  function revealNextLetter() {
    // Only the player whose turn it is can reveal
    db.ref(`games/${localGameId}`).once('value')
      .then((snapshot) => {
        const data = snapshot.val();
        const currentTurn = data.turn;
        if (currentTurn !== localPlayerId) {
          guessMessage.textContent = "It's not your turn to reveal letters.";
          return;
        }
  
        const opponentId = (currentTurn === 'player1') ? 'player2' : 'player1';
        const opponentWords = data[opponentId].words;
        const opponentIndex = data[opponentId].currentIndex;
        const targetWord = opponentWords[opponentIndex];
        let partialReveal = data.partialReveal || 1;
  
        if (partialReveal < targetWord.length) {
          partialReveal++;
          db.ref(`games/${localGameId}`).update({
            partialReveal: partialReveal
          });
        } else {
          guessMessage.textContent = "All letters are already revealed!";
        }
      });
  }
  
  /******************************
   *  WINNER DISPLAY & CLEANUP
   ******************************/
  function displayWinner(winnerId, winnerName) {
    gameBoardPanel.innerHTML = `
      <h2>Game Over</h2>
      <p>Winner is: ${winnerName} (${winnerId})</p>
    `;
  }
  
  /******************************
   *  UTILITY FUNCTIONS
   ******************************/
  function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }