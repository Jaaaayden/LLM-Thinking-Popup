// very long class -- will refactor in near future (surely)

class OverlayManager {
  constructor() {
    this.host = null;
    this.currentType = null;
    this.currentPuzzleId = null;
    this.dailyPuzzleDate = null;
    this.board = null;
    this.game = null;
    this.puzzleSolution = [];
    this.currentMoveIndex = 0;
    this.isPlayerTurn = false;
    this.isTrainingMode = false; // if lichess api breaks it'll display empty board
    this.audioEnabled = true;
    this.sounds = {};
    this.videoMuted = true;

    this.sessionPuzzles = [];
    this.sessionStartTime = null;
    this.puzzleStartTime = null;
    this.currentPuzzleIndex = 0;
    this.puzzleQueue = [];
    this.hintsUsed = new Set();
    this.solvedPuzzleIds = new Set();
    this.skippedPuzzleIds = new Set();
    this.pendingPromotion = null;
    this.promotionKeyListener = null;
  }

  async loadSounds() {
    try {
      // Core sounds
      this.sounds.success = new Audio(chrome.runtime.getURL('assets/success-sound.mp3'));
      this.sounds.error = new Audio(chrome.runtime.getURL('assets/error-sound.mp3'));
      
      // Move-specific sounds
      this.sounds.moveSelf = new Audio(chrome.runtime.getURL('assets/move-self.mp3'));
      this.sounds.moveOpponent = new Audio(chrome.runtime.getURL('assets/move-opponent.mp3'));
      this.sounds.capture = new Audio(chrome.runtime.getURL('assets/capture.mp3'));
      this.sounds.castle = new Audio(chrome.runtime.getURL('assets/castle.mp3'));
      this.sounds.promote = new Audio(chrome.runtime.getURL('assets/promote.mp3'));
      this.sounds.moveCheck = new Audio(chrome.runtime.getURL('assets/move-check.mp3'));
      this.sounds.illegal = new Audio(chrome.runtime.getURL('assets/illegal.mp3'));
      
      // Preload sounds
      Object.values(this.sounds).forEach(sound => {
        sound.load();
        sound.volume = 0.5;
      });
    } catch (e) {
      console.log('Audio not available:', e);
      this.audioEnabled = false;
    }
  }

  playSound(soundName) {
    if (!this.audioEnabled || !this.sounds[soundName]) return;
    
    try {
      const sound = this.sounds[soundName];
      sound.currentTime = 0;
      sound.play().catch(e => {
        console.log('Sound play blocked:', e);
      });
    } catch (e) {
      console.log('Error playing sound:', e);
    }
  }

  
  playMoveSound(move, isOpponent = false) {
    if (!this.audioEnabled) return;
    
    // Determine which sound to play based on move type
    let soundName = isOpponent ? "moveOpponent" : "moveSelf";
    
    if (move) {
      if (move.captured) {
        soundName = "capture";
      } else if (move.flags && move.flags.includes("k")) {
        // Kingside castling
        soundName = "castle";
      } else if (move.flags && move.flags.includes("q")) {
        // Queenside castling
        soundName = "castle";
      } else if (move.promotion) {
        soundName = "promote";
      }
    }
    
    this.playSound(soundName);
  }

  playCheckSound() {
    if (!this.audioEnabled) return;
    this.playSound("moveCheck");
  }


  show(type) {
    if (this.host) {
      if (this.currentType === type) return;
      this.hide();
    }

    this.currentType = type;
    
    // Create the main overlay container
    this.host = document.createElement('div');
    this.host.id = 'braintease-overlay';
    
    // Inject our specific styles directly into the document head
    // ensuring they are available globally for the board logic
    this.injectStyles();

    // Load sounds when showing
    this.loadSounds();

    if (type === 'chess') this.renderChess();
    else if (type === 'video') this.renderVideo();

    document.body.appendChild(this.host);
    
    // Fade in animation
    requestAnimationFrame(() => {
      this.host.classList.add('visible');
    });
  }

  hide() {
    this.saveSessionStats();
    this.cleanupChess();
    if (this.host) {
      this.host.classList.remove('visible');
      setTimeout(() => {
        if (this.host) {
          this.host.remove();
          this.host = null;
          this.currentType = null;
          this.removeStyles(); // Cleanup CSS
        }
      }, 300);
    }
  }

  async saveSessionStats() {
    if (this.sessionPuzzles.length === 0) return;
    
    const sessionEndTime = Date.now();
    const totalTime = sessionEndTime - this.sessionStartTime;
    const avgTime = totalTime / this.sessionPuzzles.length;
    
    const stats = await chrome.storage.local.get([
      'mostPuzzlesInSession',
      'totalPuzzlesSolved',
      'totalTimeSpent',
      'avgTimePerPuzzle'
    ]);
    
    // Update most puzzles in one session
    const mostPuzzles = Math.max(stats.mostPuzzlesInSession || 0, this.sessionPuzzles.length);
    
    // Update running averages
    const totalPuzzles = (stats.totalPuzzlesSolved || 0) + this.sessionPuzzles.length;
    const totalTimeSpent = (stats.totalTimeSpent || 0) + totalTime;
    const newAvgTime = totalTimeSpent / totalPuzzles;
    
    await chrome.storage.local.set({
      mostPuzzlesInSession: mostPuzzles,
      totalPuzzlesSolved: totalPuzzles,
      totalTimeSpent: totalTimeSpent,
      avgTimePerPuzzle: Math.round(newAvgTime)
    });
  }

  cleanupChess() {
    this.hidePromotionPrompt();
    this.pendingPromotion = null;
    if (this.board) {
      try { this.board.destroy(); } catch (e) { /* ignore if already torn down */ }
      document.querySelectorAll('body > img.piece-417db').forEach(el => el.remove());
    }
    this.board = null;
    this.game = null;
    this.puzzleSolution = [];
    this.currentMoveIndex = 0;
    this.isPlayerTurn = false;
    this.isTrainingMode = false;
  }

   injectStyles() {
    if (document.getElementById('braintease-styles')) return;

    const style = document.createElement('style');
    style.id = 'braintease-styles';
    style.textContent = `
      #braintease-overlay {
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100vw; 
        height: 100vh; 
        z-index: 2147483647; 
        background: rgba(0,0,0,0.95); 
        display: flex; 
        justify-content: center; 
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: auto;
      }

      #braintease-overlay.visible {
        opacity: 1;
      }

      #braintease-overlay .bt-main-layout {
        display: flex;
        align-items: stretch;
        gap: 0;
        height: 90vh;
        max-width: 95vw;
      }

      #braintease-overlay .bt-sidebar {
        width: 60px;
        background: #2d2d2d;
        border-radius: 12px 0 0 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 8px;
        gap: 8px;
        overflow-y: auto;
      }

      #braintease-overlay .bt-sidebar-item {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: #3d3d3d;
        color: #888;
        border: 2px solid transparent;
      }

      #braintease-overlay .bt-sidebar-item:hover {
        background: #4d4d4d;
      }

      #braintease-overlay .bt-sidebar-item.current {
        background: #769656;
        color: white;
        border-color: #9bc063;
      }

      #braintease-overlay .bt-sidebar-item.completed {
        background: #4CAF50;
        color: white;
      }

      #braintease-overlay .bt-sidebar-item.completed::after {
        content: '✓';
      }

      #braintease-overlay .bt-sidebar-item.skipped {
        background: #b8860b;
        color: white;
      }

      #braintease-overlay .bt-sidebar-item.skipped::after {
        content: '→';
      }

      #braintease-overlay .bt-content-area {
        background: #1a1a1a;
        border-radius: 0 12px 12px 0;
        padding: 24px 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 500px;
      }

      #braintease-overlay .bt-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        flex: 1;
      }
      
      #braintease-overlay .bt-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-bottom: 8px;
      }
      
      #braintease-overlay .bt-close-btn {
        padding: 8px 16px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: background 0.2s;
      }
      
      #braintease-overlay .bt-close-btn:hover {
        background: #ff6666;
      }
      
      #braintease-overlay .bt-audio-btn {
        padding: 8px 12px;
        background: rgba(255,255,255,0.1);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      
      #braintease-overlay .bt-audio-btn:hover {
        background: rgba(255,255,255,0.2);
      }
      
      #braintease-overlay .bt-audio-btn.muted {
        opacity: 0.6;
      }
      
      #braintease-overlay .bt-title {
        color: white;
        font-size: 18px;
        margin-bottom: 4px;
      }

      #braintease-overlay .bt-puzzle-info {
        color: #888;
        font-size: 13px;
        margin-bottom: 8px;
      }
      
      #braintease-overlay .bt-board-frame {
        background: #769656;
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }
      
      #bt-chessboard {
        width: 400px;
        height: 400px;
      }
      
      #braintease-overlay .bt-status {
        color: #fff;
        font-size: 14px;
        min-height: 20px;
      }
      
      #braintease-overlay .bt-status.success { color: #4CAF50; }
      #braintease-overlay .bt-status.error { color: #ff6b6b; }

      #braintease-overlay .bt-hint-btn {
        padding: 8px 16px;
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
        border: 1px solid rgba(255, 193, 7, 0.4);
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
        margin-top: 8px;
      }

      #braintease-overlay .bt-hint-btn:hover:not(:disabled) {
        background: rgba(255, 193, 7, 0.3);
      }

      #braintease-overlay .bt-hint-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      #braintease-overlay .bt-hint-highlight {
        box-shadow: inset 0 0 0 4px #ffc107 !important;
      }

      #braintease-overlay .bt-skip-btn {
        padding: 8px 16px;
        background: rgba(255, 152, 0, 0.2);
        color: #ff9800;
        border: 1px solid rgba(255, 152, 0, 0.4);
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
        margin-top: 8px;
      }

      #braintease-overlay .bt-skip-btn:hover:not(:disabled) {
        background: rgba(255, 152, 0, 0.3);
      }

      #braintease-overlay .bt-skip-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      #braintease-overlay .bt-promotion-prompt {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #ffc107;
        border-radius: 10px;
        padding: 16px 24px;
        color: #ffc107;
        font-size: 15px;
        font-weight: 600;
        text-align: center;
        z-index: 10;
        pointer-events: none;
        white-space: nowrap;
      }

      #braintease-overlay .bt-session-stats {
        display: flex;
        gap: 20px;
        margin-top: 12px;
        padding: 12px 20px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
      }

      #braintease-overlay .bt-stat-item {
        text-align: center;
      }

      #braintease-overlay .bt-stat-value {
        color: #4CAF50;
        font-size: 18px;
        font-weight: 600;
      }

      #braintease-overlay .bt-stat-label {
        color: #888;
        font-size: 11px;
        text-transform: uppercase;
      }

      #braintease-overlay .bt-video-controls {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }
      
      #braintease-overlay .bt-video-btn {
        padding: 8px 16px;
        background: rgba(255,255,255,0.1);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      
      #braintease-overlay .bt-video-btn:hover {
        background: rgba(255,255,255,0.2);
      }

      body > .chessboard-2173d,
      body > .board-b72b1,
      body > img.piece-417db {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  removeStyles() {
    const style = document.getElementById('braintease-styles');
    if (style) style.remove();
  }

  async renderChess() {
    this.sessionStartTime = Date.now();
    this.sessionPuzzles = [];
    this.currentPuzzleIndex = 0;
    this.puzzleQueue = [];
    this.hintsUsed.clear();
    this.solvedPuzzleIds.clear();
    this.skippedPuzzleIds.clear();
    
    // Pre-load puzzle queue
    await this.loadPuzzleQueue();
    
    const mainLayout = document.createElement('div');
    mainLayout.className = 'bt-main-layout';
    // Append container IMMEDIATELY so it exists in DOM
    this.host.appendChild(mainLayout);

    // Create sidebar
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'bt-sidebar';
    this.sidebar.id = 'bt-sidebar';
    mainLayout.appendChild(this.sidebar);

    // Create content area
    const contentArea = document.createElement('div');
    contentArea.className = 'bt-content-area';
    mainLayout.appendChild(contentArea);

    const container = document.createElement('div');
    container.className = 'bt-container';
    contentArea.appendChild(container);

    // Header with controls
    const header = document.createElement('div');
    header.className = 'bt-header';
    
    const audioBtn = document.createElement('button');
    audioBtn.className = 'bt-audio-btn';
    audioBtn.innerHTML = '🔊 Sound';
    audioBtn.onclick = () => {
      this.audioEnabled = !this.audioEnabled;
      audioBtn.innerHTML = this.audioEnabled ? '🔊 Sound' : '🔇 Sound';
      audioBtn.classList.toggle('muted', !this.audioEnabled);
    };
    header.appendChild(audioBtn);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-close-btn';
    closeBtn.innerText = '✕ Close';
    closeBtn.onclick = () => this.hide();
    header.appendChild(closeBtn);
    
    container.appendChild(header);

    // Title
    const title = document.createElement('div');
    title.className = 'bt-title';
    title.textContent = 'Chess Puzzles';
    title.id = 'bt-puzzle-title';
    container.appendChild(title);

    // Puzzle info
    const puzzleInfo = document.createElement('div');
    puzzleInfo.className = 'bt-puzzle-info';
    puzzleInfo.id = 'bt-puzzle-info';
    container.appendChild(puzzleInfo);

    // Board container
    const boardContainer = document.createElement('div');
    boardContainer.id = 'bt-board-container';
    container.appendChild(boardContainer);

    // Hint button
    const hintBtn = document.createElement('button');
    hintBtn.className = 'bt-hint-btn';
    hintBtn.id = 'bt-hint-btn';
    hintBtn.innerHTML = '💡 Hint';
    hintBtn.onclick = () => this.showHint();
    container.appendChild(hintBtn);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'bt-skip-btn';
    skipBtn.id = 'bt-skip-btn';
    skipBtn.innerHTML = '⏭ Skip';
    skipBtn.onclick = () => this.onSkipPuzzle();
    container.appendChild(skipBtn);

    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'bt-status';
    statusDiv.id = 'bt-puzzle-status';
    container.appendChild(statusDiv);

    // Session stats
    const statsDiv = document.createElement('div');
    statsDiv.className = 'bt-session-stats';
    statsDiv.id = 'bt-session-stats';
    container.appendChild(statsDiv);

    this.updateSidebar();
    this.renderCurrentPuzzle();
  }

  async fetchMorePuzzles(count = 1) {
    // Show a loading status if we are waiting
    this.showStatus('Fetching new puzzles...', '');
    
    let addedCount = 0;
    
    for (let i = 0; i < count; i++) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'FETCH_TRAINING_PUZZLE' });
        
        if (response && response.success) {
          const data = response.data;
          const fen = this.pgnToFen(data.game.pgn);
          
          this.puzzleQueue.push({
            id: data.puzzle.id,
            fen: fen,
            solution: data.puzzle.solution,
            isDaily: false
          });
          addedCount++;
        }
      } catch (e) {
        console.log('Error fetching puzzle:', e);
      }
    }
    
    if (addedCount > 0) {
      this.updateSidebar();
    }
    
    return addedCount;
  }

  async loadPuzzleQueue() {
  // Check if daily puzzle was already solved today
  let dailySolved = false;
    try {
      const stored = await chrome.storage.local.get(['solvedPuzzleId', 'solvedPuzzleDate']);
      const today = new Date().toISOString().split('T')[0];
      if (stored.solvedPuzzleDate === today && stored.solvedPuzzleId) {
        dailySolved = true;
      }
    } catch (e) {
      console.log('Could not check daily puzzle status');
    }

    // Try to get daily puzzle first (only if not already solved)
    if (!dailySolved) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'FETCH_DAILY_PUZZLE' });
      if (response && response.success) {
        const data = response.data;
        const pgn = data.game.pgn;
        const fen = this.pgnToFen(pgn); 
        // Derive FEN from PGN - the Lichess API returns PGN, not FEN
        
        this.puzzleQueue.push({
          id: data.puzzle.id,
          fen: fen,
          solution: data.puzzle.solution,
          isDaily: true
        });
      }
    } catch (e) {
      console.log('Could not load daily puzzle');
    }
    }

    // Load 4 training puzzles (always)
    // Rate limit being reached -- trying 1 to see if better
    else {
      await this.fetchMorePuzzles(); // Load initial batch
    }
    
    // Fallback if no puzzles loaded
    if (this.puzzleQueue.length === 0) {
      this.puzzleQueue.push({
        id: 'fallback',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        solution: [],
        isDaily: false
      });
    }
  }

  updateSidebar() {
    const sidebar = document.getElementById('bt-sidebar');
    if (!sidebar) return;
    
    sidebar.innerHTML = '';
    
    for (let i = 0; i < this.puzzleQueue.length; i++) {
      const item = document.createElement('div');
      item.className = 'bt-sidebar-item';
      item.textContent = i + 1;
      
      const puzzle = this.puzzleQueue[i];
      if (puzzle && this.solvedPuzzleIds.has(puzzle.id)) {
        item.classList.add('completed');
        item.textContent = '';
      } else if (puzzle && this.skippedPuzzleIds.has(puzzle.id)) {
        item.classList.add('skipped');
        item.textContent = '';
      } else if (i === this.currentPuzzleIndex) {
        item.classList.add('current');
      }

      sidebar.appendChild(item);
    }
  }

  goToPuzzle(index) {
    if (index < 0 || index >= this.puzzleQueue.length) return;
    this.currentPuzzleIndex = index;
    this.updateSidebar();
    this.renderCurrentPuzzle();
  }

  renderCurrentPuzzle() {
    const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
    if (!puzzle) return;

    this.puzzleStartTime = Date.now();
    this.currentPuzzleId = puzzle.id;
    this.puzzleSolution = puzzle.solution || [];
    this.currentMoveIndex = 0;

    // Update title and info
    const title = document.getElementById('bt-puzzle-title');
    const info = document.getElementById('bt-puzzle-info');
    if (title) title.textContent = puzzle.isDaily ? "Today's Daily Puzzle" : `Puzzle #${this.currentPuzzleIndex + 1}`;
    if (info) info.textContent = puzzle.isDaily ? 'Solve this one to maintain your streak!' : 'Training puzzle';


    // Clear and render board
    const container = document.getElementById('bt-board-container');
    if (container) {
      container.innerHTML = '';
      
      const boardFrame = document.createElement('div');
      boardFrame.className = 'bt-board-frame';
      
      const boardDiv = document.createElement('div');
      boardDiv.id = 'bt-chessboard';
      boardFrame.appendChild(boardDiv);
      container.appendChild(boardFrame);

      this.game = new Chess(puzzle.fen);
      
      const playerColor = this.game.turn() === 'w' ? 'white' : 'black';

      this.isPlayerTurn = true;

      const config = {
        draggable: true,
        position: this.game.fen(),
        orientation: playerColor,
        onDragStart: (source, piece) => this.onDragStart(source, piece),
        onDrop: (source, target) => this.onDrop(source, target),
        onSnapEnd: () => this.onSnapEnd(),
        pieceTheme: (piece) => this.getUnicodePiece(piece),
        showNotation: true
      };

      this.board = Chessboard(boardDiv, config);
    }

    // Reset status
    const status = document.getElementById('bt-puzzle-status');
    if (status) {
      status.textContent = 'Find the best move!';
      status.className = 'bt-status';
    }

    // Reset hint button
    const hintBtn = document.getElementById('bt-hint-btn');
    if (hintBtn) {
      const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
      const hintAlreadyUsed = puzzle && this.hintsUsed.has(puzzle.id);
      hintBtn.disabled = hintAlreadyUsed;
      hintBtn.innerHTML = hintAlreadyUsed ? '💡 Hint Used' : '💡 Hint';
    }

    // Reset skip button
    const skipBtn = document.getElementById('bt-skip-btn');
    if (skipBtn) skipBtn.disabled = false;

    // Clean up any pending promotion from previous puzzle
    this.hidePromotionPrompt();
    this.pendingPromotion = null;

    this.updateSessionStats();
  }

  updateSessionStats() {
    const statsDiv = document.getElementById('bt-session-stats');
    if (!statsDiv) return;

    const solvedCount = this.sessionPuzzles.length;
    const currentTime = this.puzzleStartTime ? Math.round((Date.now() - this.puzzleStartTime) / 1000) : 0;
    
    statsDiv.innerHTML = `
      <div class="bt-stat-item">
        <div class="bt-stat-value">${solvedCount}</div>
        <div class="bt-stat-label">Solved</div>
      </div>
      <div class="bt-stat-item">
        <div class="bt-stat-value">${currentTime}s</div>
        <div class="bt-stat-label">Current</div>
      </div>
      <div class="bt-stat-item">
        <div class="bt-stat-value">${this.sessionPuzzles.length > 0 ? Math.round(this.sessionPuzzles.reduce((a, b) => a + b, 0) / this.sessionPuzzles.length / 1000) : 0}s</div>
        <div class="bt-stat-label">Avg Time</div>
      </div>
    `;
  }

  // Convert PGN moves to FEN position
  pgnToFen(pgn) {
    try {
      const tempGame = new Chess();
      if (pgn && pgn.trim()) {
        // PGN from Lichess is space-separated moves like "e4 e5 Nf3 Nc6"
        const moves = pgn.trim().split(/\s+/);
        for (const move of moves) {
          if (move.match(/^\d+\.$/) || move.match(/^\{/) || move.match(/^\[/)) continue;
           // Try to make the move (handles both SAN and UCI)
          const result = tempGame.move(move, { sloppy: true });
          if (!result) {
            if (move.length >= 4) {
              tempGame.move({
                from: move.substring(0, 2),
                to: move.substring(2, 4),
                promotion: move.length > 4 ? move.substring(4, 5) : undefined
              });
            }
          }
        }
      }
      return tempGame.fen();
    } catch (e) {
      console.error('Error converting PGN to FEN:', e);
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
  }

  getUnicodePiece(piece) {
    const pieces = {
      'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
      'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
    };
    const isWhite = piece.charAt(0) === 'w';
    const fill = isWhite ? '#ffffff' : '#000000';
    const stroke = isWhite ? '#000000' : '#ffffff';
    
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">
        <style>.text{font-size:38px;font-family:serif;fill:${fill};stroke:${stroke};stroke-width:1.5px;}</style>
        <text x="50%" y="85%" text-anchor="middle" class="text">${pieces[piece]}</text>
      </svg>`;
      
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  onDragStart(source, piece) {
    if (this.game.game_over()) return false;
    const turn = this.game.turn();
    if ((turn === 'w' && piece.search(/^b/) !== -1) ||
        (turn === 'b' && piece.search(/^w/) !== -1)) return false;
    if (!this.isPlayerTurn) return false;
    return true;
  }

  onDrop(source, target) {
    // Detect pawn promotion before executing the move
    const piece = this.game.get(source);
    const isPromotion = piece && piece.type === 'p' &&
      ((piece.color === 'w' && target[1] === '8') ||
       (piece.color === 'b' && target[1] === '1'));

    if (isPromotion) {
      // Validate the move is legal using a test promotion
      const testMove = this.game.move({ from: source, to: target, promotion: 'q' });
      if (testMove === null) {
        this.playSound('illegal');
        return 'snapback';
      }
      this.game.undo();
      // Suspend player input and await keyboard choice
      this.isPlayerTurn = false;
      this.pendingPromotion = { source, target };
      this.showPromotionPrompt();
      return; // Leave piece visually at target; board.position() called after key press
    }

    const move = this.game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) {
      this.playSound('illegal');
      return 'snapback';
    }

    this.applyCorrectMove(move, source, target);
  }

  applyCorrectMove(move, source, target, promotionChar = '') {
    const expectedMove = this.puzzleSolution[this.currentMoveIndex];
    const playedMove = source + target + promotionChar;

    if (playedMove === expectedMove) {
      this.playMoveSound(move, false);
      if (this.game.in_check()) {
        setTimeout(() => this.playCheckSound(), 100);
      }
      this.clearHintHighlights();
      this.currentMoveIndex++;
      this.showStatus('Good move!', 'success');
      if (this.currentMoveIndex >= this.puzzleSolution.length) {
        setTimeout(() => this.onPuzzleSolved(), 300);
        return;
      }
      this.isPlayerTurn = false;
      setTimeout(() => this.makeOpponentMove(), 600);
    } else {
      this.playSound('error');
      this.game.undo();
      if (this.board) this.board.position(this.game.fen());
      this.showStatus('Try again!', 'error');
      this.isPlayerTurn = true;
    }
  }

  onSnapEnd() {
    if (this.board) this.board.position(this.game.fen());
  }

  showPromotionPrompt() {
    this.showStatus('Promote pawn — press Q, R, B, or K (knight)', '');
    const boardContainer = document.getElementById('bt-board-container');
    if (boardContainer) {
      const prompt = document.createElement('div');
      prompt.id = 'bt-promotion-prompt';
      prompt.className = 'bt-promotion-prompt';
      prompt.textContent = 'Q = Queen  ·  R = Rook  ·  B = Bishop  ·  K = Knight';
      boardContainer.style.position = 'relative';
      boardContainer.appendChild(prompt);
    }
    this.promotionKeyListener = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'q') this.completePromotion('q');
      else if (key === 'r') this.completePromotion('r');
      else if (key === 'b') this.completePromotion('b');
      else if (key === 'k') this.completePromotion('n');
      else if (key === 'escape') this.cancelPromotion();
    };
    document.addEventListener('keydown', this.promotionKeyListener);
  }

  hidePromotionPrompt() {
    const prompt = document.getElementById('bt-promotion-prompt');
    if (prompt) prompt.remove();
    if (this.promotionKeyListener) {
      document.removeEventListener('keydown', this.promotionKeyListener);
      this.promotionKeyListener = null;
    }
  }

  cancelPromotion() {
    this.pendingPromotion = null;
    this.hidePromotionPrompt();
    if (this.board && this.game) this.board.position(this.game.fen());
    this.isPlayerTurn = true;
    this.showStatus('Move cancelled', 'error');
  }

  completePromotion(pieceChar) {
    if (!this.pendingPromotion) return;
    const { source, target } = this.pendingPromotion;
    this.pendingPromotion = null;
    this.hidePromotionPrompt();

    const move = this.game.move({ from: source, to: target, promotion: pieceChar });
    if (!move) {
      if (this.board) this.board.position(this.game.fen());
      this.isPlayerTurn = true;
      return;
    }
    if (this.board) this.board.position(this.game.fen());
    this.applyCorrectMove(move, source, target, pieceChar);
  }

 makeOpponentMove() {
    if (this.currentMoveIndex >= this.puzzleSolution.length) return;
    const opponentMove = this.puzzleSolution[this.currentMoveIndex];
    const from = opponentMove.substring(0, 2);
    const to = opponentMove.substring(2, 4);
    const promotion = opponentMove.length > 4 ? opponentMove[4] : 'q';

    const move = this.game.move({ from, to, promotion });
    
    this.playMoveSound(move, true);
    
    if (this.game.in_check()) {
      setTimeout(() => this.playCheckSound(), 100);
    }
    
    this.board.position(this.game.fen());
    this.currentMoveIndex++;
    this.isPlayerTurn = true;
    
    if (this.currentMoveIndex >= this.puzzleSolution.length) {
      setTimeout(() => this.onPuzzleSolved(), 300);
    }
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('bt-puzzle-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'bt-status ' + (type || '');
    }
  }

  showHint() {
    if (!this.puzzleSolution || this.puzzleSolution.length === 0) return;

    const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
    if (!puzzle) return;

    // Track that hint was used for this puzzle
    this.hintsUsed.add(puzzle.id);

    // Get the next expected move
    const expectedMove = this.puzzleSolution[this.currentMoveIndex];
    if (!expectedMove) return;

    const from = expectedMove.substring(0, 2);
    const to = expectedMove.substring(2, 4);

    // Remove any existing highlights first
    this.clearHintHighlights();

    // Highlight both source and target squares
    const squares = document.querySelectorAll('#bt-chessboard .square-55d63');
    squares.forEach(sq => {
      const sqAttr = sq.getAttribute('data-square');
      if (sqAttr === from || sqAttr === to) {
        sq.classList.add('bt-hint-highlight');
      }
    });

    // Show hint message
    this.showStatus('Hint: Move from ' + from + ' to ' + to, 'success');

    // Update hint button text (but don't disable - allow consecutive hints)
    const hintBtn = document.getElementById('bt-hint-btn');
    if (hintBtn) {
      hintBtn.innerHTML = '💡 Hint Used';
    }
  }

  clearHintHighlights() {
    const squares = document.querySelectorAll('#bt-chessboard .square-55d63');
    squares.forEach(sq => {
      sq.classList.remove('bt-hint-highlight');
    });
  }

  async onPuzzleSolved() {
    this.playSound('success');
    this.showStatus('Puzzle solved! Great job!', 'success');
    
    // Record puzzle completion by ID (for correct sidebar tracking)
    const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
    if (puzzle && puzzle.id) {
      this.solvedPuzzleIds.add(puzzle.id);
    }

    // Record solve time for stats
    const solveTime = Date.now() - this.puzzleStartTime;
    this.sessionPuzzles.push(solveTime);
    
    // Update sidebar
    this.updateSidebar();
    this.updateSessionStats();
    
    // Mark daily puzzle as solved if applicable (puzzle already defined above)
    if (puzzle && puzzle.isDaily) {
      await this.markPuzzleAsSolved();
      await this.updateStreak();
    }

    // Fetch the next puzzle and advance to it once loaded
    this.showStatus('Solved! Loading more...', 'success');
    this.fetchMorePuzzles(1).then(addedCount => {
      if (addedCount > 0) {
        this.goToPuzzle(this.currentPuzzleIndex + 1);
      }
    }).catch(console.error);
  }

  async markPuzzleAsSolved() {
    const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
    if (puzzle && puzzle.id) {
      const today = new Date().toISOString().split('T')[0];
      await chrome.storage.local.set({
        solvedPuzzleId: puzzle.id,
        solvedPuzzleDate: today
      });
    }
  }

  async updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const stats = await chrome.storage.local.get(['streak', 'lastActiveDate']);
    let streak = stats.streak || 0;
    const lastActive = stats.lastActiveDate;
    
    if (lastActive === yesterday) {
      streak++;
    } else if (lastActive !== today) {
      streak = 1;
    }
    
    await chrome.storage.local.set({
      streak: streak,
      lastActiveDate: today
    });
  }

  async onSkipPuzzle() {
    const skipBtn = document.getElementById('bt-skip-btn');
    if (skipBtn) skipBtn.disabled = true;

    const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
    if (puzzle) this.skippedPuzzleIds.add(puzzle.id);
    this.updateSidebar();

    const addedCount = await this.fetchMorePuzzles(1);
    if (addedCount > 0) {
      this.goToPuzzle(this.currentPuzzleIndex + 1);
    } else if (skipBtn) {
      skipBtn.disabled = false;
    }
  }

  renderVideo() {
    const container = document.createElement('div');
    container.className = 'bt-container';
    this.host.appendChild(container);

    const title = document.createElement('div');
    title.className = 'bt-title';
    title.textContent = 'Quick distraction...';
    container.appendChild(title);

    const VIDEOS = ["jNQXAC9IVRw", "9bZkp7q19f0", "dQw4w9WgXcQ"];
    let randomId = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    
    const iframe = document.createElement('iframe');
    iframe.id = 'bt-video-iframe';
    iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=1&mute=1&enablejsapi=1`;
    iframe.style.cssText = "width: 560px; height: 315px; border: none; border-radius: 12px;";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    container.appendChild(iframe);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'bt-video-controls';
    
    const muteBtn = document.createElement('button');
    muteBtn.className = 'bt-video-btn';
    muteBtn.innerHTML = '🔇 Unmute Video';
    muteBtn.onclick = () => {
      this.videoMuted = !this.videoMuted;
      iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=1&mute=${this.videoMuted ? 1 : 0}&enablejsapi=1`;
      muteBtn.innerHTML = this.videoMuted ? '🔇 Unmute Video' : '🔊 Mute Video';
    };
    controlsDiv.appendChild(muteBtn);
    
    // Not enough videos so skipping has chance to play same video multiple times
    const skipBtn = document.createElement('button');
    skipBtn.className = 'bt-video-btn';
    skipBtn.innerHTML = '⏭️ Skip Video';
    skipBtn.onclick = () => {
      randomId = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
      iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=1&mute=${this.videoMuted ? 1 : 0}&enablejsapi=1`;
    };
    controlsDiv.appendChild(skipBtn);
    
    container.appendChild(controlsDiv);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-close-btn';
    closeBtn.innerText = '✕ Close';
    closeBtn.onclick = () => this.hide();
    container.appendChild(closeBtn);
  }
}

window.overlayManager = new OverlayManager();