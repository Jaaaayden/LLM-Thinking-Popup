class ChessMode {
  constructor(host, sounds, puzzles, stats) {
    this.host = host;
    this.sounds = sounds;
    this.puzzles = puzzles;
    this.stats = stats;

    this.board = null;
    this.game = null;
    this.puzzleSolution = [];
    this.currentMoveIndex = 0;
    this.isPlayerTurn = false;
    this.isTrainingMode = false; // if lichess api breaks it'll display empty board
    this.currentPuzzleId = null;

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
    this.sidebar = null;
    this.onCloseRequested = null;
  }

  async render() {
    this.sessionStartTime = Date.now();
    this.sessionPuzzles = [];
    this.currentPuzzleIndex = 0;
    this.puzzleQueue = [];
    this.hintsUsed.clear();
    this.solvedPuzzleIds.clear();
    this.skippedPuzzleIds.clear();

    // Pre-load puzzle queue
    this.puzzleQueue = await this.puzzles.loadInitialQueue();

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
      const next = !this.sounds.enabled;
      this.sounds.setEnabled(next);
      audioBtn.innerHTML = next ? '🔊 Sound' : '🔇 Sound';
      audioBtn.classList.toggle('muted', !next);
    };
    header.appendChild(audioBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-close-btn';
    closeBtn.innerText = '✕ Close';
    closeBtn.onclick = () => { if (this.onCloseRequested) this.onCloseRequested(); };
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

  async cleanup() {
    await this.stats.saveSession(this.sessionPuzzles, this.sessionStartTime);
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

  async loadMorePuzzles(count = 1) {
    // Show a loading status if we are waiting
    this.showStatus('Fetching new puzzles...', '');

    let addedCount = 0;

    for (let i = 0; i < count; i++) {
      const puzzle = await this.puzzles.fetchOne();
      if (puzzle) {
        this.puzzleQueue.push(puzzle);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.updateSidebar();
    }

    return addedCount;
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
        this.sounds.play('illegal');
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
      this.sounds.play('illegal');
      return 'snapback';
    }

    this.applyCorrectMove(move, source, target);
  }

  applyCorrectMove(move, source, target, promotionChar = '') {
    const expectedMove = this.puzzleSolution[this.currentMoveIndex];
    const playedMove = source + target + promotionChar;

    if (playedMove === expectedMove) {
      this.sounds.playMove(move, false);
      if (this.game.in_check()) {
        setTimeout(() => this.sounds.playCheck(), 100);
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
      this.sounds.play('error');
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

    this.sounds.playMove(move, true);

    if (this.game.in_check()) {
      setTimeout(() => this.sounds.playCheck(), 100);
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
    this.sounds.play('success');
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
      await this.puzzles.markDailySolved(puzzle.id);
      await this.stats.updateStreak();
    }

    // Fetch the next puzzle and advance to it once loaded
    this.showStatus('Solved! Loading more...', 'success');
    this.loadMorePuzzles(1).then(addedCount => {
      if (addedCount > 0) {
        this.goToPuzzle(this.currentPuzzleIndex + 1);
      }
    }).catch(console.error);
  }

  async onSkipPuzzle() {
    const skipBtn = document.getElementById('bt-skip-btn');
    if (skipBtn) {
      skipBtn.disabled = true;
      // Show countdown to avoid rate limiting
      const delayMs = 3000 + Math.random() * 2000; // 3-5s
      const endTime = Date.now() + delayMs;
      const countdown = setInterval(() => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (skipBtn && remaining > 0) {
          skipBtn.innerHTML = `⏳ ${remaining}s`;
        } else {
          clearInterval(countdown);
        }
      }, 200);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      clearInterval(countdown);
      if (skipBtn) skipBtn.innerHTML = '⏭ Skip';
    }

    const puzzle = this.puzzleQueue[this.currentPuzzleIndex];
    if (puzzle) this.skippedPuzzleIds.add(puzzle.id);
    this.updateSidebar();

    const addedCount = await this.loadMorePuzzles(1);
    if (addedCount > 0) {
      this.goToPuzzle(this.currentPuzzleIndex + 1);
    } else if (skipBtn) {
      skipBtn.disabled = false;
    }
  }
}

window.ChessMode = ChessMode;
