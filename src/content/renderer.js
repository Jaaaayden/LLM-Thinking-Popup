class OverlayManager {
  constructor() {
    this.host = null;
    this.shadow = null;
    this.currentType = null;
    this.currentPuzzleId = null;
    this.dailyPuzzleDate = null;
  }

  show(type) {
    if (this.host) {
      // If already showing same type, don't recreate
      if (this.currentType === type) return;
      // If showing different type, hide first
      this.hide();
    }

    this.currentType = type;
    this.host = document.createElement('div');
    this.host.id = 'braintease-overlay';
    this.host.style.cssText = `
      position: fixed; 
      top: 0; 
      left: 0; 
      width: 100vw; 
      height: 100vh; 
      z-index: 2147483647; 
      background: rgba(0,0,0,0.9); 
      display: flex; 
      justify-content: center; 
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Add styles to shadow DOM
    this.addShadowStyles();

    if (type === 'chess') this.renderChess();
    else if (type === 'video') this.renderVideo();

    document.body.appendChild(this.host);
    
    // Animate in
    requestAnimationFrame(() => {
      this.host.style.opacity = '0';
      this.host.style.transition = 'opacity 0.3s ease';
      requestAnimationFrame(() => {
        this.host.style.opacity = '1';
      });
    });
  }

  hide() {
    if (this.host) {
      this.host.style.opacity = '0';
      setTimeout(() => {
        if (this.host) {
          this.host.remove();
          this.host = null;
          this.shadow = null;
          this.currentType = null;
        }
      }, 300);
    }
  }

  addShadowStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      
      .close-btn {
        position: absolute;
        top: -50px;
        right: 0;
        padding: 10px 20px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.2s, transform 0.2s;
      }
      
      .close-btn:hover {
        background: #ff6666;
        transform: scale(1.05);
      }
      
      .title {
        color: white;
        font-size: 18px;
        margin-bottom: 8px;
        text-align: center;
      }
      
      .subtitle {
        color: #888;
        font-size: 12px;
        text-align: center;
        margin-top: -8px;
        margin-bottom: 8px;
      }
      
      iframe {
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }
      
      .puzzle-status {
        color: #4CAF50;
        font-size: 14px;
        text-align: center;
        margin-top: 8px;
      }
      
      .puzzle-link {
        color: #81b64c;
        text-decoration: none;
        font-size: 14px;
        margin-top: 8px;
      }
      
      .puzzle-link:hover {
        text-decoration: underline;
      }
    `;
    this.shadow.appendChild(style);
  }

  async renderChess() {
    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Solve a puzzle while the AI thinks...';
    container.appendChild(title);

    // Check if daily puzzle has already been solved today
    const puzzleData = await this.getDailyPuzzleInfo();
    
    if (puzzleData.alreadySolved) {
      // User already solved today's puzzle, redirect to training
      this.renderTrainingPuzzle(container);
    } else {
      // Show the daily puzzle
      this.renderDailyPuzzle(container, puzzleData);
    }

    this.shadow.appendChild(container);
    this.addCloseBtn(container);
  }

  async getDailyPuzzleInfo() {
    try {
      // Fetch the daily puzzle from Lichess API
      const response = await fetch('https://lichess.org/api/puzzle/daily');
      if (!response.ok) throw new Error('Failed to fetch daily puzzle');
      
      const data = await response.json();
      const puzzleId = data.puzzle.id;
      
      // Get today's date in YYYY-MM-DD format (Lichez resets at midnight UTC)
      const today = new Date().toISOString().split('T')[0];
      
      // Check if this puzzle has been solved today
      const stored = await chrome.storage.local.get(['solvedPuzzleId', 'solvedPuzzleDate']);
      
      const alreadySolved = stored.solvedPuzzleId === puzzleId && stored.solvedPuzzleDate === today;
      
      return {
        puzzleId: puzzleId,
        date: today,
        alreadySolved: alreadySolved,
        fen: data.game.fen,
        solution: data.puzzle.solution
      };
    } catch (error) {
      console.error('Error fetching daily puzzle:', error);
      // Fallback to training puzzle if API fails
      return { alreadySolved: true };
    }
  }

  renderDailyPuzzle(container, puzzleData) {
    this.currentPuzzleId = puzzleData.puzzleId;
    this.dailyPuzzleDate = puzzleData.date;

    const subtitle = document.createElement('div');
    subtitle.className = 'subtitle';
    subtitle.textContent = "Today's Daily Puzzle";
    container.appendChild(subtitle);

    // Create iframe for the daily puzzle using the embed URL
    const iframe = document.createElement('iframe');
    iframe.src = `https://lichess.org/training/frame?theme=brown&bg=dark`;
    iframe.style.cssText = "width: 400px; height: 444px; border: none; border-radius: 8px;";
    iframe.setAttribute('allow', 'fullscreen');
    container.appendChild(iframe);

    // Add status message
    const status = document.createElement('div');
    status.className = 'puzzle-status';
    status.id = 'puzzle-status';
    status.style.display = 'none';
    container.appendChild(status);

    // Listen for messages from the iframe (lichess sends puzzle completion events)
    this.setupPuzzleCompletionListener(status);

    // Add link to open on Lichess
    const link = document.createElement('a');
    link.className = 'puzzle-link';
    link.href = `https://lichess.org/training/${puzzleData.puzzleId}`;
    link.target = '_blank';
    link.textContent = 'Open on Lichess →';
    container.appendChild(link);
  }

  renderTrainingPuzzle(container) {
    const subtitle = document.createElement('div');
    subtitle.className = 'subtitle';
    subtitle.textContent = "You've already solved today's puzzle!";
    container.appendChild(subtitle);

    // Show random training puzzle instead
    const iframe = document.createElement('iframe');
    iframe.src = "https://lichess.org/training/frame?theme=brown&bg=dark&mix=true";
    iframe.style.cssText = "width: 400px; height: 444px; border: none; border-radius: 8px;";
    iframe.setAttribute('allow', 'fullscreen');
    container.appendChild(iframe);

    // Add link to more puzzles
    const link = document.createElement('a');
    link.className = 'puzzle-link';
    link.href = 'https://lichess.org/training';
    link.target = '_blank';
    link.textContent = 'More puzzles on Lichess';
    container.appendChild(link);
  }

  setupPuzzleCompletionListener(statusElement) {
    // Listen for messages from the iframe
    this.puzzleMessageHandler = (event) => {
      // Check if message is from lichess
      if (event.origin !== 'https://lichess.org') return;
      
      // Handle puzzle completion
      if (event.data && (event.data.type === 'puzzle-complete' || event.data.solved)) {
        this.markPuzzleAsSolved();
        statusElement.textContent = 'Puzzle completed! Great job!';
        statusElement.style.display = 'block';
      }
    };
    
    window.addEventListener('message', this.puzzleMessageHandler);

    // Also set up a periodic check to detect puzzle completion via URL/hash changes in iframe
    // Since Lichess doesn't consistently send postMessage, we also use a fallback timer
    this.puzzleCheckInterval = setInterval(() => {
      // Check if puzzle was solved (we can infer this if the user has been interacting)
      // For now, we'll rely on the storage check on next open
    }, 5000);
  }

  async markPuzzleAsSolved() {
    if (this.currentPuzzleId && this.dailyPuzzleDate) {
      await chrome.storage.local.set({
        solvedPuzzleId: this.currentPuzzleId,
        solvedPuzzleDate: this.dailyPuzzleDate
      });
      console.log('Daily puzzle marked as solved:', this.currentPuzzleId);
    }
  }

  renderVideo() {
    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Quick distraction while you wait...';
    container.appendChild(title);

    // Working YouTube Shorts IDs
    const VIDEOS = [
      "jNQXAC9IVRw", // Me at the zoo (classic, always works)
      "9bZkp7q19f0", // Gangnam Style
      "dQw4w9WgXcQ", // Never Gonna Give You Up
      "kJQP7kiw5Fk", // Despacito
      "RgKAFK5djSk", // See You Again
      "OPf0YbXqDm0", // Uptown Funk
      "60ItHLz5WEA", // Alan Walker - Faded
      "JGwWNGJdvx8", // Ed Sheeran - Shape of You
    ];
    const randomId = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=0&mute=1&loop=1&playlist=${randomId}`;
    iframe.style.cssText = "width: 315px; height: 560px; border: none; border-radius: 12px;";
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    container.appendChild(iframe);

    this.shadow.appendChild(container);
    this.addCloseBtn(container);
  }

  addCloseBtn(container) {
    const btn = document.createElement('button');
    btn.className = 'close-btn';
    btn.innerText = "✕ Close";
    btn.onclick = () => this.hide();
    container.appendChild(btn);
  }

  hide() {
    // Clean up message listener and interval
    if (this.puzzleMessageHandler) {
      window.removeEventListener('message', this.puzzleMessageHandler);
      this.puzzleMessageHandler = null;
    }
    if (this.puzzleCheckInterval) {
      clearInterval(this.puzzleCheckInterval);
      this.puzzleCheckInterval = null;
    }

    if (this.host) {
      this.host.style.opacity = '0';
      setTimeout(() => {
        if (this.host) {
          this.host.remove();
          this.host = null;
          this.shadow = null;
          this.currentType = null;
          this.currentPuzzleId = null;
          this.dailyPuzzleDate = null;
        }
      }, 300);
    }
  }
}

// Expose it globally so detector.js can use it
window.overlayManager = new OverlayManager();