# DraftLocal

**DraftLocal** is a minimal offline-only note-taking Chrome extension. No accounts, no sync, no network requests — your notes stay on your machine.

> Version 0.0.1

## Install

1. Clone or download this repo.
2. Open `chrome://extensions/` in Chrome or Chromium.
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and select the project root folder (the one containing `manifest.json`).
5. Pin the extension to the toolbar for quick access.

## Usage

| Action | How |
|---|---|
| New note | Click **+** in the sidebar or press `Ctrl+N` |
| Edit note | Click a note in the list, type in the editor |
| Delete note | Click **🗑 Delete** in the toolbar, confirm prompt |
| Auto-save | Happens automatically 500 ms after you stop typing |
| Search notes | Type in the **Search…** box at the top of the sidebar |
| Export notes | Click **↑ Export** in the sidebar footer (saves as Markdown) |
| Import notes | Click **↓ Import** in the sidebar footer |

## Offline testing checklist

- [ ] Disable Wi-Fi / go offline.
- [ ] Create a new note — it should save without errors.
- [ ] Reload the extension popup — notes should still be present.
- [ ] Restart the browser — notes should persist across restarts.
- [ ] Open `chrome://extensions/` → check no unexpected permissions are requested (only `storage`).

## Project structure

```
manifest.json        Chrome extension manifest (v3)
src/
  popup.html         Main UI
  popup.css          Styles + light/dark theme CSS variables
  popup.js           Note list + editor logic
  storage.js         chrome.storage.local abstraction
assets/
  icon16.png
  icon48.png
  icon128.png
CLAUDE.md            Project spec
README.md            This file
```

## Known limitations

- No keyboard shortcut to open the popup from outside the browser (browser limitation without additional permissions).
