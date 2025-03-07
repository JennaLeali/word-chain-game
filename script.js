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
  const replayBtn = document.getElementById('replayBtn');
  
  /****************************************************
   *  3. GAME STATE
   ****************************************************/
  let localPlayerName = "";
  let localGameId = "";
  let localPlayerId = "";
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
  replayBtn.addEventListener('click', replayGame);
  
  // On page load, check if there's a gameId in the URL
  window.addEventListener('DOMContentLoaded', () => {
    const existingGameId = getQueryParam('gameId');
    if (existingGameId) {
      gameIdInput.value = existingGameId;
      setupMessage.textContent = 
        `Detected gameId=${existingGameId}. Enter your name and click "Join Game".`;
    }
  });
  
  /****************************************************
   *  5. CREATE OR JOIN A GAME
   ****************************************************/
  function createNewGame() {
    localPlayerName = playerNameInput.value.trim();
    if (!localPlayerName) {
      setupMessage.textContent = "Please enter a name.";
      return;
    }
  
    localGameId = generateGameId();
    localPlayerId = "player1";
    isGameCreator = true;
  
    // partialReveal = 1 so we show the first letter of the second word from the start
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
      partialReveal: 1
    }).then(() => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?gameId=${localGameId}`;
      
      setupMessage.innerHTML = `
        <strong>Game created!</strong><br>
        Game ID: <strong>${localGameId}</strong><br>
        Share this link with your opponent:<br>
        <a href="${shareUrl}" target="_blank">${shareUrl}</a>
        <br><br>
        After copying the link, click "Continue to Word Entry".
      `;
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
      if (gameData.player1 && gameData.player2 && gameData.player2.name) {
        setupMessage.textContent = "This game is already full.";
        return;
      }
  
      localPlayerId = "player2";
      return db.ref(`games/${localGameId}/player2`).update({
        name: localPlayerName
      }).then(() => {
        setupMessage.textContent = `Joined game with ID: ${localGameId}`;
        setupPanel.style.display = 'none';
        wordEntryPanel.style.display = 'block';
      });
    });
  }
  
  function proceedToWordEntry() {
    setupPanel.style.display = 'none';
    wordEntryPanel.style.display = 'block';
  }
  
  /****************************************************
   *  6. SUBMIT WORDS
   ****************************************************/
  function submitWords() {
    const rawWords = wordListTextarea.value.trim();
    if (!rawWords) {
      entryMessage.textContent = "Please enter at least one two-word phrase.";
      return;
    }
  
    const phraseArr = rawWords
      .split(/[\n,]+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  
    // Validate each phrase has exactly 2 words
    for (let i = 0; i < phraseArr.length; i++) {
      const parts = phraseArr[i].split(/\s+/);
      if (parts.length !== 2) {
        entryMessage.textContent = 
          `Phrase "${phraseArr[i]}" must contain exactly two words.`;
        return;
      }
    }
  
    // Ensure last word of phrase[i-1] = first word of phrase[i]
    for (let i = 1; i < phraseArr.length; i++) {
      const prevParts = phraseArr[i - 1].split(/\s+/);
      const currParts = phraseArr[i].split(/\s+/);
  
      const prevLastWord = prevParts[1].toLowerCase();
      const currFirstWord = currParts[0].toLowerCase();
  
      if (prevLastWord !== currFirstWord) {
        entryMessage.textContent =
          `Chain error at "${phraseArr[i - 1]}" → "${phraseArr[i]}". 
           The last word of the previous phrase must match the first word of the next.`;
        return;
      }
    }
  
    // Store the final list in DB
    const updates = {};
    updates[`games/${localGameId}/${localPlayerId}/words`] = phraseArr;
    updates[`games/${localGameId}/${localPlayerId}/isReady`] = true;
  
    db.ref().update(updates).then(() => {
      entryMessage.textContent = "Phrase list submitted. Waiting for the other player...";
  
      // Wait for both players' isReady == true
      db.ref(`games/${localGameId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
  
        if (data.player1.isReady && data.player2.isReady) {
          wordEntryPanel.style.display = 'none';
          gameBoardPanel.style.display = 'block';
          initGameListener();
        }
      });
    });
  }
  
  /****************************************************
   *  7. MAIN GAME LISTENER
   ****************************************************/
  function initGameListener() {
    db.ref(`games/${localGameId}`).on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
  
      if (!data.gameActive) {
        // If game ended
        if (data.winner) {
          displayWinner(data.winner, data[data.winner].name);
        }
        return;
      }
  
      if (data.winner) {
        displayWinner(data.winner, data[data.winner].name);
        return;
      }
  
      const currentTurn = data.turn;
      statusDiv.textContent = `It's ${data[currentTurn].name}'s turn to guess.`;
  
      const opponentId = (currentTurn === 'player1') ? 'player2' : 'player1';
      const opponentWords = data[opponentId].words || [];
      const opponentIndex = data[opponentId].currentIndex || 0;
  
      if (opponentIndex >= opponentWords.length) {
        currentClueDiv.textContent = 
          `No more phrases to guess from ${data[opponentId].name}.`;
        return;
      }
  
      const targetPhrase = opponentWords[opponentIndex];
      const [firstWord, secondWord] = targetPhrase.split(/\s+/);
  
      const partialReveal = data.partialReveal || 1;
      const revealCount = Math.min(partialReveal, secondWord.length);
  
      const revealedLetters = secondWord.substring(0, revealCount);
      const hiddenCount = secondWord.length - revealCount;
      const underscores = "_".repeat(hiddenCount);
  
      currentClueDiv.textContent = 
        `Clue: ${firstWord} ${revealedLetters}${underscores}`;
    });
  }
  
  /****************************************************
   *  8. GUESS & REVEAL LETTERS (TRANSACTIONS)
   ****************************************************/
  
  /**
   * SUBMIT GUESS
   * - If guess is correct: remain your turn, move to next word, partialReveal=1
   * - If guess is wrong: switch turn, partialReveal=1
   */
  function submitGuess() {
    const guess = guessInput.value.trim();
    guessInput.value = "";
    if (!guess) return;
  
    const gameRef = db.ref(`games/${localGameId}`);
  
    gameRef.transaction((gameData) => {
      if (!gameData || !gameData.gameActive) return gameData;
  
      // 1. If it's not our turn, do nothing
      if (gameData.turn !== localPlayerId) {
        console.log("[GUESS] Not your turn. Aborting transaction.");
        return gameData;
      }
  
      // 2. Identify the opponent's current word
      const opponentId = (gameData.turn === 'player1') ? 'player2' : 'player1';
      const opponentIndex = gameData[opponentId].currentIndex || 0;
      const opponentWords = gameData[opponentId].words || [];
  
      if (opponentIndex >= opponentWords.length) {
        console.log("[GUESS] Opponent has no more words. Aborting.");
        return gameData;
      }
  
      const targetPhrase = opponentWords[opponentIndex];
      const [firstWord, secondWord] = targetPhrase.split(/\s+/);
  
      // 3. Compare guess to secondWord
      const normalizedGuess = guess.toLowerCase();
      const normalizedAnswer = secondWord.toLowerCase();
  
      console.log("[GUESS] guess=", normalizedGuess, "| answer=", normalizedAnswer);
  
      if (normalizedGuess === normalizedAnswer) {
        // == CORRECT GUESS ==
        console.log("[GUESS] Correct guess!");
        gameData[opponentId].currentIndex = opponentIndex + 1;
  
        // If no more words left -> current player wins
        if (gameData[opponentId].currentIndex >= opponentWords.length) {
          gameData.winner = gameData.turn;
          gameData.gameActive = false;
          console.log("[GUESS] Player", gameData.turn, "wins!");
        } else {
          // Stay on same turn, partialReveal=1 for the next word
          gameData.partialReveal = 1;
        }
      } else {
        // == WRONG GUESS ==
        console.log("[GUESS] Wrong guess. Switching turn to", opponentId);
        gameData.turn = opponentId;
        gameData.partialReveal = 1;
      }
  
      return gameData;
    }, (error, committed, snapshot) => {
      if (error) {
        console.error("[GUESS] transaction error:", error);
      } else if (!committed) {
        guessMessage.textContent = "It's not your turn to guess!";
      } else {
        // Transaction success
        const updatedData = snapshot.val();
  
        // If the turn is still local => guess was correct
        // If the turn switched => guess was wrong
        if (updatedData.turn === localPlayerId) {
          guessMessage.textContent = "Correct guess!";
        } else {
          guessMessage.textContent = "Wrong guess. Next player's turn!";
        }
      }
    });
  }
  
  /**
   * REVEAL NEXT LETTER
   * - If you reveal a letter, your turn ends immediately, partialReveal=1 for the next player
   */
  function revealNextLetter() {
    const gameRef = db.ref(`games/${localGameId}`);
  
    gameRef.transaction((gameData) => {
      if (!gameData || !gameData.gameActive) return gameData;
  
      if (gameData.turn !== localPlayerId) {
        console.log("[REVEAL] Not your turn. Aborting transaction.");
        return gameData;
      }
  
      const opponentId = (gameData.turn === 'player1') ? 'player2' : 'player1';
      const opponentWords = gameData[opponentId].words || [];
      const opponentIndex = gameData[opponentId].currentIndex || 0;
  
      if (opponentIndex >= opponentWords.length) {
        console.log("[REVEAL] Opponent has no more words. Aborting.");
        return gameData;
      }
  
      const targetPhrase = opponentWords[opponentIndex];
      const [firstWord, secondWord] = targetPhrase.split(/\s+/);
  
      let partialReveal = gameData.partialReveal || 1;
  
      // Reveal exactly one more letter
      if (partialReveal < secondWord.length) {
        partialReveal++;
        gameData.partialReveal = partialReveal;
        console.log("[REVEAL] One letter revealed. partialReveal=", partialReveal);
      } else {
        console.log("[REVEAL] Already fully revealed. No change.");
      }
  
      // End your turn
      console.log("[REVEAL] Switch turn to", opponentId);
      gameData.turn = opponentId;
      gameData.partialReveal = 1;
  
      return gameData;
    }, (error, committed, snapshot) => {
      if (error) {
        console.error("[REVEAL] transaction error:", error);
      } else if (!committed) {
        guessMessage.textContent = "It's not your turn to reveal letters.";
      } else {
        guessMessage.textContent = "You revealed a letter. Next player's turn!";
      }
    });
  }
  
  /****************************************************
   *  9. GAME OVER & REPLAY
   ****************************************************/
  function displayWinner(winnerId, winnerName) {
    gameBoardPanel.style.display = 'none';
    gameOverPanel.style.display = 'block';
    winnerMessage.innerHTML = 
      `The winner is <strong>${winnerName}</strong> (${winnerId}).`;
  }
  
  function replayGame() {
    const updates = {
      gameActive: true,
      winner: null,
      turn: "player1",
      partialReveal: 1,
      "player1/currentIndex": 0,
      "player1/isReady": false,
      "player1/words": [],
      "player2/currentIndex": 0,
      "player2/isReady": false,
      "player2/words": []
    };
  
    db.ref(`games/${localGameId}`).update(updates).then(() => {
      gameOverPanel.style.display = 'none';
      wordListTextarea.value = "";
      entryMessage.textContent = "";
      wordEntryPanel.style.display = 'block';
    });
  }
  
  /****************************************************
   *  10. UTILITY HELPERS
   ****************************************************/
  function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }