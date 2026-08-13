(() => {
  "use strict";

  const STORAGE_KEY = "ytArrowKeysFixSettings";
  const PAGE_EVENT_NAME = "yt-arrow-keys-fix-action";
  const BRIDGE_SCRIPT_ID = "yt-arrow-keys-fix-page-bridge";
  const DEFAULT_SETTINGS = {
    seekSeconds: 5,
    volumeStepPercent: 5,
    shortsVolumeOverride: true,
    keybinds: {
      seekBackward: "ArrowLeft",
      seekForward: "ArrowRight",
      volumeUp: "ArrowUp",
      volumeDown: "ArrowDown"
    }
  };

  const ACTIONS = [
    "seekBackward",
    "seekForward",
    "volumeUp",
    "volumeDown"
  ];

  let settings = cloneDefaults();

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function mergeSettings(saved = {}) {
    return {
      ...cloneDefaults(),
      ...saved,
      keybinds: {
        ...DEFAULT_SETTINGS.keybinds,
        ...(saved.keybinds || {})
      }
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readSettings() {
    if (!globalThis.chrome?.storage?.sync) {
      return Promise.resolve(cloneDefaults());
    }

    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        resolve(mergeSettings(result[STORAGE_KEY]));
      });
    });
  }

  function isShortsPage() {
    return location.pathname.startsWith("/shorts/") ||
      Boolean(document.querySelector("ytd-reel-video-renderer[is-active]"));
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        "input, textarea, select, [contenteditable=''], [contenteditable='true'], yt-searchbox"
      )
    );
  }

  function hasBlockingModifier(event) {
    return event.altKey || event.ctrlKey || event.metaKey;
  }

  function getActionForKey(key) {
    return ACTIONS.find((action) => settings.keybinds[action] === key) || null;
  }

  function getCapturedAction(event) {
    if (hasBlockingModifier(event) || isEditableTarget(event.target)) {
      return null;
    }

    const action = getActionForKey(event.key);
    if (!action) {
      return null;
    }

    if (
      isShortsPage() &&
      !settings.shortsVolumeOverride &&
      (action === "volumeUp" || action === "volumeDown")
    ) {
      return null;
    }

    return action;
  }

  function injectPageBridge() {
    if (!globalThis.chrome?.runtime?.getURL || document.getElementById(BRIDGE_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = BRIDGE_SCRIPT_ID;
    script.src = chrome.runtime.getURL("page-bridge.js");
    script.async = false;
    script.onload = () => script.remove();
    (document.head || document.documentElement).append(script);
  }

  function handleAction(action) {
    const seekSeconds = clamp(Number(settings.seekSeconds) || 5, 1, 60);
    const volumeStepPercent = clamp(Number(settings.volumeStepPercent) || 5, 1, 50);

    window.dispatchEvent(new CustomEvent(PAGE_EVENT_NAME, {
      detail: JSON.stringify({
        action,
        seekSeconds,
        volumeStepPercent
      })
    }));
  }

  injectPageBridge();

  addEventListener(
    "keydown",
    (event) => {
      const action = getCapturedAction(event);
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      handleAction(action);
    },
    true
  );

  addEventListener(
    "keyup",
    (event) => {
      if (!getCapturedAction(event)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  readSettings().then((loadedSettings) => {
    settings = loadedSettings;
  });

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[STORAGE_KEY]) {
      return;
    }

    settings = mergeSettings(changes[STORAGE_KEY].newValue);
  });
})();
