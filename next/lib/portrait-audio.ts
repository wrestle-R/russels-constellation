// Lazy media playback: never fetch or start sound before a reveal.
export function createPortraitAudio() {
  let audio: HTMLAudioElement | undefined;
  let active = false;
  let attempted = false;
  let disposed = false;
  const stop = () => {
    active = false;
    attempted = false;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };
  const play = () => {
    if (!active || disposed || document.hidden || attempted) return;
    audio ??= new Audio("/audio/spider-man-guitar.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    attempted = true;
    // Autoplay denial is expected before a visitor's first interaction.
    void audio
      .play()
      .then(() => {
        if (!active || disposed || document.hidden) audio?.pause();
      })
      .catch(() => {});
  };
  const retry = () => {
    attempted = false;
    play();
  };
  const hide = () => {
    if (document.hidden) stop();
  };
  document.addEventListener("pointerdown", retry);
  document.addEventListener("keydown", retry);
  document.addEventListener("pointerup", retry);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("blur", stop);
  return {
    update(visible: boolean) {
      if (!visible) {
        if (active) stop();
        return;
      }
      active = true;
      play();
    },
    dispose() {
      disposed = true;
      stop();
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
      document.removeEventListener("pointerup", retry);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", stop);
      audio?.removeAttribute("src");
      audio?.load();
    },
  };
}
