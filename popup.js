(() => {
  "use strict";

  const STORAGE_KEY = "ytArrowKeysFixSettings";
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
    ["seekBackward", "Seek back"],
    ["seekForward", "Seek forward"],
    ["volumeUp", "Volume up"],
    ["volumeDown", "Volume down"]
  ];

  const KEY_LABELS = {
    " ": "Space",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down"
  };

  const elements = {
    seekSeconds: document.querySelector("#seekSeconds"),
    seekSecondsValue: document.querySelector("#seekSecondsValue"),
    volumeStepPercent: document.querySelector("#volumeStepPercent"),
    volumeStepPercentValue: document.querySelector("#volumeStepPercentValue"),
    shortsVolumeOverride: document.querySelector("#shortsVolumeOverride"),
    keybindGrid: document.querySelector("#keybindGrid"),
    conflictState: document.querySelector("#conflictState"),
    syncState: document.querySelector("#syncState"),
    resetDefaults: document.querySelector("#resetDefaults")
  };

  let settings = cloneDefaults();
  let recordingAction = null;
  let saveTimer = null;

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

  function saveSettings(nextSettings = settings) {
    settings = mergeSettings(nextSettings);
    elements.syncState.textContent = "Saving";
    elements.syncState.classList.add("is-saving");

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
        elements.syncState.textContent = "Synced";
        elements.syncState.classList.remove("is-saving");
      });
    }, 80);
  }

  function keyLabel(key) {
    return KEY_LABELS[key] || key;
  }

  function valueText(id, value) {
    if (id === "seekSeconds") {
      return `${value}s`;
    }

    return `${value}%`;
  }

  function updateSliderOutput(id) {
    const input = elements[id];
    const output = elements[`${id}Value`];
    output.textContent = valueText(id, input.value);
  }

  function renderKeybinds() {
    elements.keybindGrid.textContent = "";

    ACTIONS.forEach(([action, label]) => {
      const row = document.createElement("div");
      row.className = "keybind-row";

      const rowLabel = document.createElement("label");
      rowLabel.textContent = label;

      const button = document.createElement("button");
      button.className = "key-button";
      button.type = "button";
      button.dataset.action = action;
      button.textContent = recordingAction === action ? "Press key" : keyLabel(settings.keybinds[action]);
      button.title = "Click, then press a key";
      button.addEventListener("click", () => {
        recordingAction = recordingAction === action ? null : action;
        renderKeybinds();
      });

      row.append(rowLabel, button);
      elements.keybindGrid.append(row);
    });

    renderConflicts();
  }

  function renderConflicts() {
    const counts = {};
    Object.values(settings.keybinds).forEach((key) => {
      counts[key] = (counts[key] || 0) + 1;
    });

    const duplicateKeys = Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    document.querySelectorAll(".key-button").forEach((button) => {
      const action = button.dataset.action;
      button.classList.toggle("is-recording", recordingAction === action);
      button.classList.toggle("is-conflict", duplicateKeys.includes(settings.keybinds[action]));
    });

    if (duplicateKeys.length) {
      elements.conflictState.textContent = "Duplicate";
      elements.conflictState.classList.add("has-conflict");
      return;
    }

    elements.conflictState.textContent = "";
    elements.conflictState.classList.remove("has-conflict");
  }

  function render() {
    elements.seekSeconds.value = settings.seekSeconds;
    elements.volumeStepPercent.value = settings.volumeStepPercent;
    elements.shortsVolumeOverride.checked = settings.shortsVolumeOverride;

    updateSliderOutput("seekSeconds");
    updateSliderOutput("volumeStepPercent");
    renderKeybinds();
  }

  function bindSlider(id) {
    const input = elements[id];
    input.addEventListener("input", () => {
      const value = Number(input.value);
      settings = {
        ...settings,
        [id]: value
      };
      updateSliderOutput(id);
      saveSettings(settings);
    });
  }

  bindSlider("seekSeconds");
  bindSlider("volumeStepPercent");

  elements.shortsVolumeOverride.addEventListener("change", () => {
    saveSettings({
      ...settings,
      shortsVolumeOverride: elements.shortsVolumeOverride.checked
    });
  });

  elements.resetDefaults.addEventListener("click", () => {
    recordingAction = null;
    saveSettings(cloneDefaults());
    render();
  });

  document.addEventListener("keydown", (event) => {
    /* If we are recording a new keybind, handle assignment. */
    if (recordingAction) {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        recordingAction = null;
        renderKeybinds();
        return;
      }

      if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) {
        return;
      }

      settings = {
        ...settings,
        keybinds: {
          ...settings.keybinds,
          [recordingAction]: event.key
        }
      };
      recordingAction = null;
      saveSettings(settings);
      renderKeybinds();
      return;
    }

    /* Not recording — if the pressed key matches any configured keybind,
       close the popup immediately so the NEXT press reaches YouTube. This
       prevents arrow keys from accidentally sliding the range inputs. */
    const isKeybind = Object.values(settings.keybinds).includes(event.key);
    if (isKeybind) {
      event.preventDefault();
      window.close();
    }
  });

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    settings = mergeSettings(result[STORAGE_KEY]);
    render();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[STORAGE_KEY]) {
      return;
    }

    settings = mergeSettings(changes[STORAGE_KEY].newValue);
    render();
  });
})();
