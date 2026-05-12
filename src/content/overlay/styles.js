class OverlayStyles {
  inject() {
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

  remove() {
    const style = document.getElementById('braintease-styles');
    if (style) style.remove();
  }
}

window.OverlayStyles = OverlayStyles;
