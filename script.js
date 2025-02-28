  /****************************************************
 *  1. FIREBASE CONFIGURATION
 ****************************************************/
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
  const db = firebase.database();
  
  /****************************************************
   *  2. DOM ELEMENTS
   ****************************************************/
  const setupPanel = document.getElementById('setup');
  const wordEntryPanel = document.getElementById('wordEntry');
  const gameBoardPanel = document.getElementById('gameBoard');
  const gameOverPanel = document.getElementById('gameOver');
  
  const playerNameInput = document.getElementById('playerName');
  const gameIdInput = document.getElementById('gameId');
  const createGameBtn = document.getElementById('createGameBtn');
  const joinGameBtn = document.getElementById('joinGameBtn');
  const setupMessage = document.getElementById('setupMessage');
  const proceedBtn = document.getElementById('proceedBtn');
  
  const wordListTextarea = document.getElementById('wordList');
  const submitWordsBtn = document.getElementById('submitWordsBtn');
  const entryMessage = document.getElementById('entryMessage');
  
  const statusDiv = document.getElementById('status');
  const currentClueDiv = document.getElementById('currentClue');
  const guessInput = document.getElementById('guessInput');
  const guessBtn = document.getElementById('guessBtn');
  const revealLetterBtn = document.getElementById('revealLetterBtn');
  const guessMessage = document.getElementById('guessMessage');
  
  const winnerMessage = document.getElementById('winnerMessage');
  
  /****************************************************
   *  3. GAME STATE
   ****************************************************/
  let localPlayerName = "";
  let localGameId = "";
  let localPlayerId = ""; // "player1" or "player2"
  let isGameCreator = false;
  
  /****************************************************
   *  4. EVENT LISTENERS
   ****************************************************/
  createGameBtn.addEventListener('click', createNewGame);
  joinGameBtn.addEventListener('click', joinExistingGame);
  proceedBtn.addEventListener('click', proceedToWordEntry);
  
  submitWordsBtn.addEventListener('click', submitWords);
  guessBtn.addEventListener('click', submitGuess);
  revealLetterBtn.addEventListener('click', revealNextLetter);
  
  // On page load, check if there's a gameId in the URL
  window.addEventListener('DOMContentLoaded', () => {
    const existingGameId = getQueryParam('gameId');
    if (existingGameId) {
      gameIdInput.value = existingGameId;
      setupMessage.textContent = `Detected gameId=${existingGameId} in URL. Enter your name and click "Join Game".`;
    }
  });
  
  /****************************************************
   *  5. CORE FUNCTIONS: CREATE OR JOIN A GAME
   ****************************************************/
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
  
    // Initialize game data in the database
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
      turn: "player1", 
      gameActive: true,
      winner: null,
      partialReveal: 1 // start revealing from first letter
    }).then(() => {
      // Create the share link
      const shareUrl = `${window.location.origin}${window.location.pathname}?gameId=${localGameId}`;
      
      // Show it to the user
      setupMessage.innerHTML = `
        <strong>Game created!</strong><br>
        Game ID: <strong>${localGameId}</strong><br>
        Share this link with your opponent:<br>
        <a href="${shareUrl}" target="_blank">${shareUrl}</a>
        <br><br>
        After copying the link, click "Continue to Word Entry" below.
      `;
      // Reveal the proceed button so they can go next
      proceedBtn.style.display = "inline-block";
    });
  }
  
  function joinExistingGame() {
    localPlayerName = playerNameInput.value.trim();
    localGameId = gameIdInput.value.trim();
    if (!localPlayerName || !localGameId) {
      setupMessage.textContent = "Please enter your name and a valid Game ID.";
      return;
    }
  
    db.ref(`games/${localGameId}`).once('value').then((snapshot) => {
      if (!snapshot.exists()) {
        setupMessage.textContent = "Game ID not found.";
        return;
      }
  
      const gameData = snapshot.val();
      // Check if there's space for player2
      if (gameData.player1 && gameData.player2 && gameData.player2.name) {
        setupMessage.textContent = "This game is already full.";
        return;
      }
  
      // Join as player2
      localPlayerId = "player2";
      return db.ref(`games/${localGameId}/player2`).update({
        name: localPlayerName
      }).then(() => {
        setupMessage.textContent = `Joined game with ID: ${localGameId}`;
        // We can immediately go to the word-entry panel
        setupPanel.style.display = 'none';
        wordEntryPanel.style.display = 'block';
      });
    });
  }
  
  function proceedToWordEntry() {
    // Called by the button "Continue to Word Entry"
    setupPanel.style.display = 'none';
    wordEntryPanel.style.display = 'block';
  }
  
  /****************************************************
   *  6. SUBMIT PHRASES: PHRASE-BASED CHAIN VALIDATION
   ****************************************************/
  function submitWords() {
    const rawWords = wordListTextarea.value.trim();
    if (!rawWords) {
      entryMessage.textContent = "Please enter at least one phrase.";
      return;
    }
  
    // Convert input into an array of phrases
    const phraseArr = rawWords
      .split(/[\n,]+/)       // split by newline or comma
      .map(p => p.trim())    // remove extra spaces
      .filter(p => p.length > 0);
  
    // Validate the chain: last word of phrase[i-1] == first word of phrase[i]
    for (let i = 1; i < phraseArr.length; i++) {
      const prevWords = phraseArr[i - 1].split(/\s+/);
      const currWords = phraseArr[i].split(/\s+/);
  
      const prevLastWord = prevWords[prevWords.length - 1].toLowerCase();
      const currFirstWord = currWords[0].toLowerCase();
  
      if (prevLastWord !== currFirstWord) {
        entryMessage.textContent =
          `Word chain error at "${phraseArr[i - 1]}" → "${phraseArr[i]}". 
           The last word of the previous phrase must match the first word of the next.`;
        return;
      }
    }
  
    // If validation passes, store phrases in DB
    const updates = {};
    updates[`games/${localGameId}/${localPlayerId}/words`] = phraseArr;
    updates[`games/${localGameId}/${localPlayerId}/isReady`] = true;
  
    db.ref().update(updates).then(() => {
      entryMessage.textContent = "Phrase list submitted. Waiting for the other player...";
  
      // Listen for both players to be ready
      db.ref(`games/${localGameId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
  
        if (data.player1.isReady && data.player2.isReady) {
          // Both players ready -> start the game
          wordEntryPanel.style.display = 'none';
          gameBoardPanel.style.display = 'block';
          initGameListener();
        }
      });
    });
  }
  
  /****************************************************
   *  7. MAIN GAME LOOP: TURN-BASED GUESSING
   ****************************************************/
  function initGameListener() {
    db.ref(`games/${localGameId}`).on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
  
      // Check if game is active
      if (!data.gameActive) {
        // Possibly the game ended
        if (data.winner) {
          displayWinner(data.winner, data[data.winner].name);
        }
        return;
      }
  
      // If there's a winner while gameActive is false, game just ended
      if (data.winner) {
        displayWinner(data.winner, data[data.winner].name);
        return;
      }
  
      // Current turn
      const currentTurn = data.turn;
      statusDiv.textContent = `It's ${data[currentTurn].name}'s turn to guess.`;
  
      // The word to guess is from the *opponent*'s list
      const opponentId = (currentTurn === 'player1') ? 'player2' : 'player1';
      const opponentWords = data[opponentId].words || [];
      const opponentIndex = data[opponentId].currentIndex || 0;
  
      if (opponentIndex >= opponentWords.length) {
        // Possibly the opponent's list is done. 
        currentClueDiv.textContent = `No more words to guess from ${data[opponentId].name}.`;
        return;
      }
  
      const targetWord = opponentWords[opponentIndex];
      const partialReveal = data.partialReveal || 1;
  
      // Build the clue with partial reveal
      const revealedString = targetWord.substring(0, partialReveal);
      const hiddenCount = targetWord.length - partialReveal;
      currentClueDiv.textContent = 
        `Clue: ${revealedString}${"_".repeat(Math.max(hiddenCount, 0))}`;
    });
  }
  
  /****************************************************
   *  8. GUESS & REVEAL LETTERS
   ****************************************************/
  function submitGuess() {
    const guess = guessInput.value.trim();
    guessInput.value = "";
    if (!guess) return;
  
    db.ref(`games/${localGameId}`).once('value').then((snapshot) => {
      const data = snapshot.val();
      if (!data || !data.gameActive) return;
  
      const currentTurn = data.turn;
      const opponentId = (currentTurn === 'player1') ? 'player2' : 'player1';
  
      const opponentWords = data[opponentId].words || [];
      const opponentIndex = data[opponentId].currentIndex || 0;
      const targetWord = opponentWords[opponentIndex] || "";
  
      if (guess.toLowerCase() === targetWord.toLowerCase()) {
        // Correct guess
        guessMessage.textContent = "Correct guess!";
        const newIndex = opponentIndex + 1;
        
        let updates = {};
        updates[`games/${localGameId}/${opponentId}/currentIndex`] = newIndex;
  
        // Check if the opponent has no more words left
        if (newIndex >= opponentWords.length) {
          // Current guesser has guessed them all -> current guesser wins
          updates[`games/${localGameId}/winner`] = currentTurn;
          updates[`games/${localGameId}/gameActive`] = false;
        } else {
          // Switch turns
          updates[`games/${localGameId}/turn`] = opponentId;
          updates[`games/${localGameId}/partialReveal`] = 1; // reset for next word
        }
  
        return db.ref().update(updates);
      } else {
        guessMessage.textContent = "Wrong guess. Reveal more letters or try again.";
      }
    });
  }
  
  function revealNextLetter() {
    // Only the current guessing player can reveal
    db.ref(`games/${localGameId}`).once('value').then((snapshot) => {
      const data = snapshot.val();
      if (!data || !data.gameActive) return;
  
      if (data.turn !== localPlayerId) {
        guessMessage.textContent = "It's not your turn to reveal letters.";
        return;
      }
  
      const opponentId = (data.turn === 'player1') ? 'player2' : 'player1';
      const opponentWords = data[opponentId].words || [];
      const opponentIndex = data[opponentId].currentIndex || 0;
      const targetWord = opponentWords[opponentIndex] || "";
      
      let partialReveal = data.partialReveal || 1;
      if (partialReveal < targetWord.length) {
        partialReveal++;
        db.ref(`games/${localGameId}`).update({ partialReveal });
      } else {
        guessMessage.textContent = "All letters are already revealed!";
      }
    });
  }
  
  /****************************************************
   *  9. GAME OVER
   ****************************************************/
  function displayWinner(winnerId, winnerName) {
    gameBoardPanel.style.display = 'none';
    gameOverPanel.style.display = 'block';
    winnerMessage.innerHTML = `The winner is <strong>${winnerName}</strong> (${winnerId}).`;
  }
  
  /****************************************************
   *  10. UTILITY HELPERS
   ****************************************************/
  function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  // Parse the URL query string, e.g. ?gameId=ABC123
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }