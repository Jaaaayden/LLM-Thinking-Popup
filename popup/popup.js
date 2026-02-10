document.addEventListener('DOMContentLoaded', () => {
  const chessToggle = document.getElementById('chessToggle');
  const videoToggle = document.getElementById('videoToggle');
  const puzzleStatus = document.getElementById('puzzleStatus');
  const resetPuzzleBtn = document.getElementById('resetPuzzleBtn');
  const resetStatsBtn = document.getElementById('resetStatsBtn');

  // Validate elements exist
  if (!chessToggle || !videoToggle) {
    console.error('Toggle elements not found!');
    return;
  }

  // 1. Load Settings with a Default Fallback
  chrome.storage.sync.get(['chessEnabled', 'videoEnabled'], (data) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      return;
    }

    // Logic: If BOTH are undefined (first run), default Chess to TRUE.
    if (data.chessEnabled === undefined && data.videoEnabled === undefined) {
      chessToggle.checked = true;
      videoToggle.checked = false;
      // Save this default state immediately so it persists
      saveSettings();
    } else {
      // Otherwise, load what the user saved
      chessToggle.checked = data.chessEnabled || false;
      videoToggle.checked = data.videoEnabled || false;
    }
  });

  // 2. Load Puzzle Status
  updatePuzzleStatus();

  // 3. Load Statistics
  loadStatistics();

  // 4. Mutual Exclusivity Listeners
  chessToggle.addEventListener('change', () => {
    if (chessToggle.checked) {
      videoToggle.checked = false; // Turn off video if chess is on
    }
    saveSettings();
  });

  videoToggle.addEventListener('change', () => {
    if (videoToggle.checked) {
      chessToggle.checked = false; // Turn off chess if video is on
    }
    saveSettings();
  });

  // 5. Reset Puzzle Button
  resetPuzzleBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['solvedPuzzleId', 'solvedPuzzleDate']);
    updatePuzzleStatus();
    // Visual feedback
    resetPuzzleBtn.textContent = 'Reset!';
    setTimeout(() => {
      resetPuzzleBtn.textContent = 'Reset Daily Progress';
    }, 1000);
  });

  // 6. Reset Stats Button
  resetStatsBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove([
      'streak',
      'lastActiveDate',
      'mostPuzzlesInSession',
      'totalPuzzlesSolved',
      'totalTimeSpent',
      'avgTimePerPuzzle'
    ]);
    loadStatistics();
    // Visual feedback
    resetStatsBtn.textContent = 'Reset!';
    setTimeout(() => {
      resetStatsBtn.textContent = 'Reset All Stats';
    }, 1000);
  });

  function saveSettings() {
    chrome.storage.sync.set({
      chessEnabled: chessToggle.checked,
      videoEnabled: videoToggle.checked
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save settings:', chrome.runtime.lastError);
      } else {
        console.log('Settings saved:', {
          chess: chessToggle.checked,
          video: videoToggle.checked
        });
      }
    });
  }

  async function updatePuzzleStatus() {
    try {
      // Fetch today's daily puzzle
      const response = await fetch('https://lichess.org/api/puzzle/daily');
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      const todayPuzzleId = data.puzzle.id;
      const today = new Date().toISOString().split('T')[0];
      
      // Check storage
      const stored = await chrome.storage.local.get(['solvedPuzzleId', 'solvedPuzzleDate']);
      
      if (stored.solvedPuzzleId === todayPuzzleId && stored.solvedPuzzleDate === today) {
        puzzleStatus.textContent = "✓ You've solved today's puzzle!";
        puzzleStatus.className = 'status-text solved';
      } else {
        puzzleStatus.textContent = "○ Daily puzzle waiting for you";
        puzzleStatus.className = 'status-text pending';
      }
    } catch (error) {
      puzzleStatus.textContent = "Unable to check status";
      puzzleStatus.className = 'status-text error';
    }
  }

  async function loadStatistics() {
    const stats = await chrome.storage.local.get([
      'streak',
      'mostPuzzlesInSession',
      'avgTimePerPuzzle',
      'totalPuzzlesSolved'
    ]);

    document.getElementById('streakValue').textContent = stats.streak || 0;
    document.getElementById('mostPuzzlesValue').textContent = stats.mostPuzzlesInSession || 0;
    document.getElementById('avgTimeValue').textContent = formatTime(stats.avgTimePerPuzzle || 0);
    document.getElementById('totalPuzzlesValue').textContent = stats.totalPuzzlesSolved || 0;
  }

  function formatTime(ms) {
    if (ms === 0) return '-';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
});