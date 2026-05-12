class VideoMode {
  constructor(host) {
    this.host = host;
    this.videoMuted = true;
    this.onCloseRequested = null;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'bt-container';
    this.host.appendChild(container);

    const title = document.createElement('div');
    title.className = 'bt-title';
    title.textContent = 'Quick distraction...';
    container.appendChild(title);

    const VIDEOS = ["jNQXAC9IVRw", "9bZkp7q19f0", "dQw4w9WgXcQ"];
    let randomId = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];

    const iframe = document.createElement('iframe');
    iframe.id = 'bt-video-iframe';
    iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=1&mute=1&enablejsapi=1`;
    iframe.style.cssText = "width: 560px; height: 315px; border: none; border-radius: 12px;";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    container.appendChild(iframe);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'bt-video-controls';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'bt-video-btn';
    muteBtn.innerHTML = '🔇 Unmute Video';
    muteBtn.onclick = () => {
      this.videoMuted = !this.videoMuted;
      iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=1&mute=${this.videoMuted ? 1 : 0}&enablejsapi=1`;
      muteBtn.innerHTML = this.videoMuted ? '🔇 Unmute Video' : '🔊 Mute Video';
    };
    controlsDiv.appendChild(muteBtn);

    // Not enough videos so skipping has chance to play same video multiple times
    const skipBtn = document.createElement('button');
    skipBtn.className = 'bt-video-btn';
    skipBtn.innerHTML = '⏭️ Skip Video';
    skipBtn.onclick = () => {
      randomId = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
      iframe.src = `https://www.youtube.com/embed/${randomId}?autoplay=1&controls=1&mute=${this.videoMuted ? 1 : 0}&enablejsapi=1`;
    };
    controlsDiv.appendChild(skipBtn);

    container.appendChild(controlsDiv);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-close-btn';
    closeBtn.innerText = '✕ Close';
    closeBtn.onclick = () => { if (this.onCloseRequested) this.onCloseRequested(); };
    container.appendChild(closeBtn);
  }

  cleanup() {
    // VideoMode owns no resources beyond its DOM nodes, which are removed when
    // the overlay host is detached. Nothing to tear down here.
  }
}

window.VideoMode = VideoMode;
