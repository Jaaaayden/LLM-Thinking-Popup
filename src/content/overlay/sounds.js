class SoundPlayer {
  constructor() {
    this.enabled = true;
    this.sounds = {};
  }

  load() {
    try {
      this.sounds.success = new Audio(chrome.runtime.getURL('assets/success-sound.mp3'));
      this.sounds.error = new Audio(chrome.runtime.getURL('assets/error-sound.mp3'));

      this.sounds.moveSelf = new Audio(chrome.runtime.getURL('assets/move-self.mp3'));
      this.sounds.moveOpponent = new Audio(chrome.runtime.getURL('assets/move-opponent.mp3'));
      this.sounds.capture = new Audio(chrome.runtime.getURL('assets/capture.mp3'));
      this.sounds.castle = new Audio(chrome.runtime.getURL('assets/castle.mp3'));
      this.sounds.promote = new Audio(chrome.runtime.getURL('assets/promote.mp3'));
      this.sounds.moveCheck = new Audio(chrome.runtime.getURL('assets/move-check.mp3'));
      this.sounds.illegal = new Audio(chrome.runtime.getURL('assets/illegal.mp3'));

      Object.values(this.sounds).forEach(sound => {
        sound.load();
        sound.volume = 0.5;
      });
    } catch (e) {
      console.log('Audio not available:', e);
      this.enabled = false;
    }
  }

  play(soundName) {
    if (!this.enabled || !this.sounds[soundName]) return;

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

  playMove(move, isOpponent = false) {
    if (!this.enabled) return;

    let soundName = isOpponent ? "moveOpponent" : "moveSelf";

    if (move) {
      if (move.captured) {
        soundName = "capture";
      } else if (move.flags && move.flags.includes("k")) {
        soundName = "castle";
      } else if (move.flags && move.flags.includes("q")) {
        soundName = "castle";
      } else if (move.promotion) {
        soundName = "promote";
      }
    }

    this.play(soundName);
  }

  playCheck() {
    if (!this.enabled) return;
    this.play("moveCheck");
  }

  setEnabled(value) {
    this.enabled = value;
  }
}

window.SoundPlayer = SoundPlayer;
