const SITE_CONFIG = {
  chatgpt: { 
    stopSelector: '[data-testid="stop-button"]',
    thinkingSelector: '.result-thinking, [data-testid="thinking-indicator"]'
  },
  gemini: { 
    stopSelector: 'mat-icon[fonticon="stop"], mat-icon[data-mat-icon-name="stop"], .stop-button, button[aria-label*="stop" i]',
    thinkingSelector: '.loading-dots, .generating-text, [data-loading="true"], .response-loading'
  }
};

class StateDetector {
  constructor() {
    this.isThinking = false;
    this.site = window.location.hostname.includes('google') ? 'gemini' : 'chatgpt';
    this.observer = null;
    this.checkInterval = null;
    this.lastOverlayTime = 0;
    this.videoWatchedToday = false;
  }

  init() {
    console.log("Initializing detector for:", this.site);

    // Use both MutationObserver and polling for reliability
    this.observer = new MutationObserver(() => this.checkState());
    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-testid']
    });
    
    // Also poll every 500ms as a fallback
    this.checkInterval = setInterval(() => this.checkState(), 500);
    
    // Initial check
    this.checkState();
    console.log("Watching for AI response...");
  }
  
  checkState() {
    const config = SITE_CONFIG[this.site];
    
    // Check for stop button (primary indicator of thinking)
    const stopBtn = document.querySelector(config.stopSelector);
    
    // Also check for thinking indicators as backup
    const thinkingIndicator = config.thinkingSelector ? 
      document.querySelector(config.thinkingSelector) : null;
    
    const currentlyThinking = !!(stopBtn || thinkingIndicator);

    if (currentlyThinking && !this.isThinking) {
      console.log("Thinking started!");
      this.isThinking = true;
      this.onThinkingStart();
    } else if (!currentlyThinking && this.isThinking) {
      console.log("Thinking stopped!");
      this.isThinking = false;
      if (window.overlayManager) window.overlayManager.hide();
    }
  }

  async onThinkingStart() {
    try {
      // Debounce: don't show overlay more than once per 2 seconds
      const now = Date.now();
      if (now - this.lastOverlayTime < 2000) return;
      this.lastOverlayTime = now;

      const settings = await chrome.storage.sync.get(['chessEnabled', 'videoEnabled']);
      
      let playChess = settings.chessEnabled;
      let playVideo = settings.videoEnabled;

      // Handle "First Run" (both undefined)
      if (playChess === undefined && playVideo === undefined) {
        playChess = true; // Default to chess
      }

      // Trigger the Overlay
      if (window.overlayManager) {
        if (playChess) {
          window.overlayManager.show('chess');
        } else if (playVideo) {
          window.overlayManager.show('video');
          // Track video streak
          this.trackVideoStreak();
        }
      }
    } catch (error) {
      console.error("Error in onThinkingStart:", error);
    }
  }

  async trackVideoStreak() {
    if (this.videoWatchedToday) return;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const stats = await chrome.storage.local.get(['streak', 'lastActiveDate', 'lastVideoDate']);
    let streak = stats.streak || 0;
    const lastVideoDate = stats.lastVideoDate;
    
    // Only update streak if we haven't already today
    if (lastVideoDate !== today) {
      if (lastVideoDate === yesterday) {
        streak++;
      } else if (stats.lastActiveDate !== today) {
        // No activity yesterday, start new streak
        streak = 1;
      }
      
      await chrome.storage.local.set({
        streak: streak,
        lastVideoDate: today,
        lastActiveDate: today
      });
      
      this.videoWatchedToday = true;
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.brainTeaseDetector = new StateDetector();
    window.brainTeaseDetector.init();
  });
} else {
  window.brainTeaseDetector = new StateDetector();
  window.brainTeaseDetector.init();
}