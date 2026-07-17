(() => {
  "use strict";

  const SEEK_SECONDS = 5;
  const VOLUME_STEP = 0.05;
  const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function visibleArea(element) {
    const rect = element.getBoundingClientRect();
    const width = clamp(rect.right, 0, innerWidth) - clamp(rect.left, 0, innerWidth);
    const height = clamp(rect.bottom, 0, innerHeight) - clamp(rect.top, 0, innerHeight);
    return Math.max(0, width) * Math.max(0, height);
  }

  function getActiveVideo() {
    const videos = Array.from(document.getElementsByTagName("video"));

    return videos
      .map((video) => ({
        video,
        score: visibleArea(video) + (video.paused ? 0 : 1000000)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.video || null;
  }

  function handleArrow(key) {
    const video = getActiveVideo();
    if (!video) {
      return;
    }

    if (key === "ArrowLeft") {
      video.currentTime = clamp(video.currentTime - SEEK_SECONDS, 0, video.duration || 0);
      return;
    }

    if (key === "ArrowRight") {
      video.currentTime = clamp(video.currentTime + SEEK_SECONDS, 0, video.duration || Infinity);
      return;
    }

    if (key === "ArrowUp") {
      video.muted = false;
      video.volume = clamp(video.volume + VOLUME_STEP, 0, 1);
      return;
    }

    if (key === "ArrowDown") {
      video.volume = clamp(video.volume - VOLUME_STEP, 0, 1);
    }
  }

  addEventListener(
    "keydown",
    (event) => {
      if (!ARROW_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      handleArrow(event.key);
    },
    true
  );
})();
