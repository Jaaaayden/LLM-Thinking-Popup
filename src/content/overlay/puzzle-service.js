class PuzzleService {
  async loadInitialQueue() {
    const queue = [];

    const dailySolved = await this.isDailySolvedToday();

    if (!dailySolved) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'FETCH_DAILY_PUZZLE' });
        if (response && response.success) {
          const data = response.data;
          const pgn = data.game.pgn;
          const fen = this.pgnToFen(pgn);

          queue.push({
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

    // WARNING: Do not adjust default number of puzzles fetched
    // LiChess API only allows one at a time
    else {
      const initial = await this.fetchOne();
      if (initial) queue.push(initial);
    }

    if (queue.length === 0) {
      queue.push({
        id: 'fallback',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        solution: [],
        isDaily: false
      });
    }

    return queue;
  }

  async fetchOne() {
    try {
      const stored = await chrome.storage.sync.get(['puzzleDifficulty']);
      const difficulty = stored.puzzleDifficulty || 'normal';
      const response = await chrome.runtime.sendMessage({ action: 'FETCH_TRAINING_PUZZLE', difficulty });

      if (response && response.success) {
        const data = response.data;
        const fen = this.pgnToFen(data.game.pgn);

        return {
          id: data.puzzle.id,
          fen: fen,
          solution: data.puzzle.solution,
          isDaily: false
        };
      }
    } catch (e) {
      console.log('Error fetching puzzle:', e);
    }
    return null;
  }

  async isDailySolvedToday() {
    try {
      const stored = await chrome.storage.local.get(['solvedPuzzleId', 'solvedPuzzleDate']);
      const today = new Date().toISOString().split('T')[0];
      if (stored.solvedPuzzleDate === today && stored.solvedPuzzleId) {
        return true;
      }
    } catch (e) {
      console.log('Could not check daily puzzle status');
    }
    return false;
  }

  async markDailySolved(puzzleId) {
    if (!puzzleId) return;
    const today = new Date().toISOString().split('T')[0];
    await chrome.storage.local.set({
      solvedPuzzleId: puzzleId,
      solvedPuzzleDate: today
    });
  }

  pgnToFen(pgn) {
    try {
      const tempGame = new Chess();
      if (pgn && pgn.trim()) {
        const moves = pgn.trim().split(/\s+/);
        for (const move of moves) {
          if (move.match(/^\d+\.$/) || move.match(/^\{/) || move.match(/^\[/)) continue;
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
}

window.PuzzleService = PuzzleService;
