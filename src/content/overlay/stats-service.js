class StatsService {
  async saveSession(sessionPuzzles, sessionStartTime) {
    if (sessionPuzzles.length === 0) return;

    const sessionEndTime = Date.now();
    const totalTime = sessionEndTime - sessionStartTime;

    const stats = await chrome.storage.local.get([
      'mostPuzzlesInSession',
      'totalPuzzlesSolved',
      'totalTimeSpent',
      'avgTimePerPuzzle'
    ]);

    const mostPuzzles = Math.max(stats.mostPuzzlesInSession || 0, sessionPuzzles.length);

    const totalPuzzles = (stats.totalPuzzlesSolved || 0) + sessionPuzzles.length;
    const totalTimeSpent = (stats.totalTimeSpent || 0) + totalTime;
    const newAvgTime = totalTimeSpent / totalPuzzles;

    await chrome.storage.local.set({
      mostPuzzlesInSession: mostPuzzles,
      totalPuzzlesSolved: totalPuzzles,
      totalTimeSpent: totalTimeSpent,
      avgTimePerPuzzle: Math.round(newAvgTime)
    });
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
}

window.StatsService = StatsService;
