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
    this.isTrainingMode = false;
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

    if (type === 'chess') this.renderChess();
    else if (type === 'video') this.renderVideo();

    document.body.appendChild(this.host);
    
    // Fade in animation
    requestAnimationFrame(() => {
      this.host.classList.add('visible');
    });
  }

  hide() {
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

  cleanupChess() {
    this.board = null;
    this.game = null;
    this.puzzleSolution = [];
    this.currentMoveIndex = 0;
    this.isPlayerTurn = false;
    this.isTrainingMode = false;
  }

  injectStyles() {
    // We check if styles exist to avoid duplicates
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
        background: rgba(0,0,0,0.92); 
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

      #braintease-overlay .bt-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 60px 20px 20px 20px;
        background: transparent;
      }
      
      #braintease-overlay .bt-close-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        z-index: 10002;
      }
      
      #braintease-overlay .bt-title {
        color: white;
        font-size: 18px;
        margin-bottom: 4px;
      }
      
      #braintease-overlay .bt-board-frame {
        background: #769656;
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }
      
      /* THIS ID IS CRITICAL FOR JQUERY TO FIND */
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

      /* HIDE GLOBAL ARTIFACTS: 
         This hides the "leaked" pieces at the bottom of the screen 
         that aren't inside our overlay 
      */
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
    const container = document.createElement('div');
    container.className = 'bt-container';
    
    // Append container IMMEDIATELY so it exists in DOM
    this.host.appendChild(container);

    const title = document.createElement('div');
    title.className = 'bt-title';
    title.textContent = 'Solve a puzzle while the AI thinks...';
    container.appendChild(title);

    const puzzleData = await this.getDailyPuzzleInfo();
    
    if (puzzleData.alreadySolved) {
      title.textContent = "You've solved today's puzzle! Here's a training puzzle...";
      await this.renderTrainingPuzzle(container);
    } else if (puzzleData.error) {
      title.textContent = 'Could not load daily puzzle. Loading training puzzle...';
      await this.renderTrainingPuzzle(container);
    } else {
      await this.renderDailyPuzzle(container, puzzleData);
    }

    this.addCloseBtn(container);
  }

  async getDailyPuzzleInfo() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'FETCH_DAILY_PUZZLE' });
      
      if (!response || !response.success) {
        throw new Error(response ? response.error : 'Failed to get response from background');
      }

      const data = response.data;
      const puzzleId = data.puzzle.id;
      const today = new Date().toISOString().split('T')[0];
      
      const stored = await chrome.storage.local.get(['solvedPuzzleId', 'solvedPuzzleDate']);
      const alreadySolved = stored.solvedPuzzleId === puzzleId && stored.solvedPuzzleDate === today;

      // Derive FEN from PGN - the Lichess API returns PGN, not FEN
      const pgn = data.game.pgn;
      const fen = this.pgnToFen(pgn);

      return {
        puzzleId: puzzleId,
        date: today,
        alreadySolved: alreadySolved, 
        fen: fen,
        solution: data.puzzle.solution,
        initialPly: data.game.ply || 0
      };
    } catch (error) {
      console.error('Error fetching daily puzzle:', error);
      return { error: true, message: error.message };
    }
  }

  // Convert PGN moves to FEN position
  pgnToFen(pgn) {
    try {
      const tempGame = new Chess();
      if (pgn && pgn.trim()) {
        // PGN from Lichess is space-separated moves like "e4 e5 Nf3 Nc6"
        const moves = pgn.trim().split(/\s+/);
        for (const move of moves) {
          // Skip move numbers and annotations
          if (move.match(/^\d+\.$/) || move.match(/^\{/) || move.match(/^\[/)) continue;
          // Try to make the move (handles both SAN and UCI)
          const result = tempGame.move(move, { sloppy: true });
          if (!result) {
            // Try as UCI if SAN fails
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

  async renderDailyPuzzle(container, puzzleData) {
    this.currentPuzzleId = puzzleData.puzzleId;
    this.dailyPuzzleDate = puzzleData.date;
    this.puzzleSolution = puzzleData.solution || [];

    // Frame
    const boardFrame = document.createElement('div');
    boardFrame.className = 'bt-board-frame';
    
    // The specific DIV ID jquery looks for
    const boardDiv = document.createElement('div');
    boardDiv.id = 'bt-chessboard';
    boardFrame.appendChild(boardDiv);
    container.appendChild(boardFrame);

    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'bt-status';
    statusDiv.id = 'bt-puzzle-status';
    statusDiv.textContent = 'Find the best move!';
    container.appendChild(statusDiv);

    this.game = new Chess(puzzleData.fen);
    
    // Determine whose turn it is based on the FEN
    const isWhiteToMove = puzzleData.fen.includes(' w ');
    this.isPlayerTurn = true; // Player always plays the correct side

    // If the puzzle starts with opponent's move, play it first
    if (this.puzzleSolution.length > 0 && !isWhiteToMove) {
      // First move in solution is opponent's move
      setTimeout(() => this.makeOpponentMove(), 800);
    }

    const config = {
      draggable: true,
      position: this.game.fen(),
      onDragStart: (source, piece) => this.onDragStart(source, piece),
      onDrop: (source, target) => this.onDrop(source, target),
      onSnapEnd: () => this.onSnapEnd(),
      pieceTheme: (piece) => this.getUnicodePiece(piece),
      showNotation: true
    };

    // Initialize using the direct element reference
    this.board = Chessboard(boardDiv, config);
  }

  async renderTrainingPuzzle(container) {
    this.isTrainingMode = true;
    
    try {
      // Fetch a training puzzle from Lichess
      const response = await chrome.runtime.sendMessage({ action: 'FETCH_TRAINING_PUZZLE' });
      
      if (!response || !response.success) {
        throw new Error('Failed to fetch training puzzle');
      }

      const data = response.data;
      const pgn = data.game.pgn;
      const fen = this.pgnToFen(pgn);
      this.puzzleSolution = data.puzzle.solution || [];
      this.currentPuzzleId = data.puzzle.id;

      const boardFrame = document.createElement('div');
      boardFrame.className = 'bt-board-frame';
      
      const boardDiv = document.createElement('div');
      boardDiv.id = 'bt-chessboard';
      boardFrame.appendChild(boardDiv);
      container.appendChild(boardFrame);

      const statusDiv = document.createElement('div');
      statusDiv.className = 'bt-status';
      statusDiv.id = 'bt-puzzle-status';
      statusDiv.textContent = 'Training Puzzle - Find the best move!';
      container.appendChild(statusDiv);

      this.game = new Chess(fen);
      
      // Determine whose turn it is
      const isWhiteToMove = fen.includes(' w ');
      this.isPlayerTurn = true;

      // If the puzzle starts with opponent's move, play it first
      if (this.puzzleSolution.length > 0 && !isWhiteToMove) {
        setTimeout(() => this.makeOpponentMove(), 800);
      }

      const config = {
        draggable: true,
        position: this.game.fen(),
        onDragStart: (source, piece) => this.onDragStart(source, piece),
        onDrop: (source, target) => this.onDrop(source, target),
        onSnapEnd: () => this.onSnapEnd(),
        pieceTheme: (piece) => this.getUnicodePiece(piece),
        showNotation: true
      };

      this.board = Chessboard(boardDiv, config);
    } catch (error) {
      console.error('Error loading training puzzle:', error);
      // Fallback to free play mode
      this.renderFreePlayMode(container);
    }
  }

  renderFreePlayMode(container) {
    const boardFrame = document.createElement('div');
    boardFrame.className = 'bt-board-frame';
    
    const boardDiv = document.createElement('div');
    boardDiv.id = 'bt-chessboard';
    boardFrame.appendChild(boardDiv);
    container.appendChild(boardFrame);

    const statusDiv = document.createElement('div');
    statusDiv.className = 'bt-status';
    statusDiv.textContent = 'Free Play Mode';
    container.appendChild(statusDiv);

    this.game = new Chess();
    const config = {
      draggable: true,
      position: 'start',
      onDragStart: (source, piece) => {
        if (this.game.game_over()) return false;
        if (piece.search(/^b/) !== -1) return false;
        return true;
      },
      onDrop: (source, target) => {
        const move = this.game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';
      },
      onSnapEnd: () => this.board.position(this.game.fen()),
      pieceTheme: (piece) => this.getUnicodePiece(piece),
      showNotation: true
    };

    this.board = Chessboard(boardDiv, config);
  }

  // This tricks chessboard.js into rendering pieces without external images
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
    const move = this.game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    const expectedMove = this.puzzleSolution[this.currentMoveIndex];
    const playedMove = source + target;
    
    if (playedMove === expectedMove) {
      this.currentMoveIndex++;
      this.showStatus('Good move!', 'success');
      if (this.currentMoveIndex >= this.puzzleSolution.length) {
        this.onPuzzleSolved();
        return;
      }
      this.isPlayerTurn = false;
      setTimeout(() => this.makeOpponentMove(), 600);
    } else {
      this.game.undo();
      this.showStatus('Try again!', 'error');
      return 'snapback';
    }
  }

  onSnapEnd() {
    this.board.position(this.game.fen());
  }

  makeOpponentMove() {
    if (this.currentMoveIndex >= this.puzzleSolution.length) return;
    const opponentMove = this.puzzleSolution[this.currentMoveIndex];
    const from = opponentMove.substring(0, 2);
    const to = opponentMove.substring(2, 4);
    
    this.game.move({ from, to, promotion: 'q' });
    this.board.position(this.game.fen());
    this.currentMoveIndex++;
    this.isPlayerTurn = true;
    
    if (this.currentMoveIndex >= this.puzzleSolution.length) {
      this.onPuzzleSolved();
    }
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('bt-puzzle-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'bt-status ' + (type || '');
    }
  }

  async onPuzzleSolved() {
    this.showStatus('Puzzle solved! Great job!', 'success');
    if (!this.isTrainingMode) {
      await this.markPuzzleAsSolved();
    }
  }

  async markPuzzleAsSolved() {
    if (this.currentPuzzleId && this.dailyPuzzleDate) {
      await chrome.storage.local.set({
        solvedPuzzleId: this.currentPuzzleId,
        solvedPuzzleDate: this.dailyPuzzleDate
      });
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

    const VIDEOS = ["dQw4w9WgXcQ"];
    const randomId = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=0&mute=1`;
    iframe.style.cssText = "width: 315px; height: 560px; border: none; border-radius: 12px;";
    container.appendChild(iframe);
    
    this.addCloseBtn(container);
  }

  addCloseBtn(container) {
    const btn = document.createElement('button');
    btn.className = 'bt-close-btn';
    btn.innerText = "✕ Close";
    btn.onclick = () => this.hide();
    container.appendChild(btn);
  }
}

window.overlayManager = new OverlayManager();