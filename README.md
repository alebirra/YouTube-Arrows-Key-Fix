# YouTube Arrow Keys Fix

Chrome extension that makes YouTube keyboard seek and volume controls consistent, configurable, and Shorts-aware.

## Features

- Configurable seek seconds and volume step percentage from the toolbar popup.
- Live settings sync through `chrome.storage.sync`; open YouTube tabs update without reload.
- Remappable shortcuts for seek backward, seek forward, volume up, and volume down.
- Shorts-aware Up/Down behavior: either control volume or leave native Shorts navigation alone.
- Native YouTube player notification updated with the configured seek and volume values.
- Reset to defaults from the popup.
- Text fields and editable areas are ignored so search and comments still behave normally.

## Defaults

- Left: seek backward 5 seconds
- Right: seek forward 5 seconds
- Up: volume up 5%
- Down: volume down 5%
- Shorts Up/Down volume override: on

## Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this extension folder.
5. Reload any open YouTube tabs.

## Notes

The extension has no build step. The popup and content script are plain MV3 files.
