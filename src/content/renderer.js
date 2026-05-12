// Thin coordinator. Owns the overlay host element and lifecycle; delegates
// rendering to a ChessMode or VideoMode and data to PuzzleService/StatsService.
// See .claude/docs/architectural_patterns.md section 1 for the boundary rules.

class OverlayManager {
  constructor() {
    this.host = null;
    this.currentType = null;
    this.activeMode = null;

    this.styles = new OverlayStyles();
    this.sounds = new SoundPlayer();
    this.puzzles = new PuzzleService();
    this.stats = new StatsService();
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
    this.styles.inject();

    // Load sounds when showing
    this.sounds.load();

    if (type === 'chess') {
      this.activeMode = new ChessMode(this.host, this.sounds, this.puzzles, this.stats);
    } else if (type === 'video') {
      this.activeMode = new VideoMode(this.host);
    }

    if (this.activeMode) {
      this.activeMode.onCloseRequested = () => this.hide();
      this.activeMode.render();
    }

    document.body.appendChild(this.host);

    // Fade in animation
    requestAnimationFrame(() => {
      this.host.classList.add('visible');
    });
  }

  hide() {
    const modeToCleanup = this.activeMode;
    this.activeMode = null;

    if (modeToCleanup) {
      // cleanup may be async (ChessMode persists session stats); fire-and-forget
      // is fine because we don't need to block the fade-out on it.
      Promise.resolve(modeToCleanup.cleanup()).catch(console.error);
    }

    if (this.host) {
      this.host.classList.remove('visible');
      setTimeout(() => {
        if (this.host) {
          this.host.remove();
          this.host = null;
          this.currentType = null;
          this.styles.remove();
        }
      }, 300);
    }
  }
}

window.OverlayManager = OverlayManager;
window.overlayManager = new OverlayManager();
