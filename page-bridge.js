(() => {
  "use strict";

  const EVENT_NAME = "yt-arrow-keys-fix-action";
  const OVERLAY_ID = "ytaf-notification-overlay";
  const OVERLAY_STYLE_ID = "ytaf-notification-style";
  let notifyTimer;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function visibleArea(element) {
    const rect = element.getBoundingClientRect();
    const width = clamp(rect.right, 0, innerWidth) - clamp(rect.left, 0, innerWidth);
    const height = clamp(rect.bottom, 0, innerHeight) - clamp(rect.top, 0, innerHeight);
    return Math.max(0, width) * Math.max(0, height);
  }

  function isShortsPage() {
    return location.pathname.startsWith("/shorts/") ||
      Boolean(document.querySelector("ytd-reel-video-renderer[is-active]"));
  }

  function getActiveShortsVideo() {
    const activeRenderer = document.querySelector(
      "ytd-reel-video-renderer[is-active], ytd-shorts-player-controls[is-active]"
    );
    const activeVideo = activeRenderer?.querySelector("video");

    if (activeVideo) {
      return activeVideo;
    }

    const shortsVideos = Array.from(
      document.querySelectorAll("ytd-reel-video-renderer video, ytd-shorts video")
    );

    return shortsVideos
      .map((video) => ({
        video,
        score: visibleArea(video) + (video.paused ? 0 : 1000000)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.video || null;
  }

  function getActiveVideo() {
    if (isShortsPage()) {
      const shortsVideo = getActiveShortsVideo();
      if (shortsVideo) {
        return shortsVideo;
      }
    }

    return Array.from(document.getElementsByTagName("video"))
      .map((video) => ({
        video,
        score: visibleArea(video) + (video.paused ? 0 : 1000000)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.video || null;
  }

  function getPlayer(video) {
    return video?.closest(".html5-video-player") ||
      document.querySelector(".html5-video-player");
  }

  function getCurrentTime(player, video) {
    if (typeof player?.getCurrentTime === "function") {
      return Number(player.getCurrentTime()) || 0;
    }

    return video?.currentTime || 0;
  }

  function getDuration(player, video) {
    if (typeof player?.getDuration === "function") {
      return Number(player.getDuration()) || 0;
    }

    return video?.duration || 0;
  }

  function seekBy(player, video, seconds) {
    if (typeof player?.seekBy === "function") {
      player.seekBy(seconds);
      return;
    }

    const duration = getDuration(player, video);
    const target = clamp(
      getCurrentTime(player, video) + seconds,
      0,
      duration || Number.POSITIVE_INFINITY
    );

    if (typeof player?.seekTo === "function") {
      player.seekTo(target, true);
      return;
    }

    if (video) {
      video.currentTime = target;
    }
  }

  function getVolume(player, video) {
    if (typeof player?.getVolume === "function") {
      return clamp(Number(player.getVolume()) || 0, 0, 100);
    }

    return clamp(Math.round((video?.volume || 0) * 100), 0, 100);
  }

  function setVolume(player, video, volumePercent) {
    if (volumePercent > 0 && typeof player?.unMute === "function") {
      player.unMute();
    }

    if (typeof player?.setVolume === "function") {
      player.setVolume(volumePercent);
    } else if (video) {
      video.muted = volumePercent === 0;
      video.volume = volumePercent / 100;
    }

    video?.dispatchEvent(new Event("volumechange", { bubbles: true }));

    if (volumePercent === 0 && typeof player?.mute === "function") {
      player.mute();
    }
  }

  /* ---- Custom notification overlay ---- */

  function ensureNotificationStyle() {
    if (document.getElementById(OVERLAY_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = OVERLAY_STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        font-family: "YouTube Noto", Roboto, Arial, sans-serif;
        font-size: 20px;
        font-weight: 500;
        padding: 10px 22px;
        border-radius: 8px;
        pointer-events: none;
        z-index: 79;
        opacity: 0;
        transition: opacity 0.15s ease;
        white-space: nowrap;
      }
      #${OVERLAY_ID}.ytaf-visible {
        opacity: 1;
      }
    `;
    document.documentElement.append(style);
  }

  function showNotification(player, text) {
    if (!player) {
      return;
    }

    ensureNotificationStyle();

    let overlay = player.querySelector(`#${OVERLAY_ID}`);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      player.append(overlay);
    }

    overlay.textContent = text;
    /* Reset the class to restart the CSS transition */
    overlay.classList.remove("ytaf-visible");
    void overlay.offsetWidth;
    overlay.classList.add("ytaf-visible");

    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      overlay.classList.remove("ytaf-visible");
    }, 900);
  }

  /* ---- Action handler ---- */

  function handleAction(action, seekSeconds, volumeStepPercent) {
    const video = getActiveVideo();
    const player = getPlayer(video);

    if (!video && !player) {
      return;
    }

    if (action === "seekBackward") {
      seekBy(player, video, -seekSeconds);
      showNotification(player, `−${seekSeconds} seconds`);
      return;
    }

    if (action === "seekForward") {
      seekBy(player, video, seekSeconds);
      showNotification(player, `+${seekSeconds} seconds`);
      return;
    }

    if (action === "volumeUp" || action === "volumeDown") {
      const direction = action === "volumeUp" ? 1 : -1;
      const nextVolume = clamp(getVolume(player, video) + direction * volumeStepPercent, 0, 100);
      setVolume(player, video, nextVolume);
      showNotification(player, `Volume ${nextVolume}%`);
    }
  }

  window.addEventListener(EVENT_NAME, (event) => {
    let detail = {};

    try {
      detail = JSON.parse(event.detail || "{}");
    } catch {
      detail = {};
    }

    const seekSeconds = clamp(Number(detail.seekSeconds) || 5, 1, 60);
    const volumeStepPercent = clamp(Number(detail.volumeStepPercent) || 5, 1, 50);

    handleAction(detail.action, seekSeconds, volumeStepPercent);
  });
})();
