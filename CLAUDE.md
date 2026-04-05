# Offline Notes Chrome Extension

## PROJECT

This is an offline-first Chrome/Chromium extension for taking and managing notes directly in the browser, inspired by mozilla/notes but with no sync, accounts, or network features.  
Users can create, edit, and delete notes in a simple UI, with data stored entirely on the local machine using browser extension storage.

Primary goals:
- Quick capture of short and long-form notes while browsing.
- Zero setup: install, pin the extension, and start typing.
- Works fully offline, no servers, no external APIs.

Non-goals:
- No sync across devices or accounts.
- No collaboration or multi-user features.
- No telemetry, analytics, or remote logging.

Target users:
- Developers, students, and power users who want an offline notes sidebar while working in Chrome.
- Privacy-conscious users who explicitly do not want cloud sync.


## STACK

Technologies:
- Chrome extension, Manifest V3.
- Vanilla HTML, CSS, and JavaScript (no frameworks, no bundlers).
- `chrome.storage.local` (or `chrome.storage.sync`-like API used in local-only mode) for persistence.
- Optional: basic Markdown-style formatting handled client-side (no external parser unless inlined).

Constraints:
- No build step required; extension should be loadable directly as an unpacked extension.
- Keep JavaScript small and readable; avoid over-engineering.
- Design for both light and dark themes using CSS variables.


## STRUCTURE

Planned folder/file layout (root of extension project):

- `manifest.json`  
  Chrome extension manifest (v3), declares permissions, popup, icons, and content scripts if any.

- `src/`
  - `popup.html`  
    Main notes UI shown when clicking the extension icon.
  - `popup.css`  
    Styling for the popup UI, including light/dark theme variables.
  - `popup.js`  
    Frontend logic for creating, editing, deleting, and listing notes.
  - `storage.js`  
    Small abstraction over `chrome.storage.local` for saving/loading notes.
  - `options.html` (optional)  
    Settings page for extension-level preferences (e.g., default sort, theme).
  - `options.js` (optional)  
    Logic for reading/writing settings.
  - `background.js` (optional)  
    Background/event script if we need alarms, context menu, or notification hooks.

- `assets/`
  - `icon16.png`
  - `icon48.png`
  - `icon128.png`

- `CLAUDE.md`  
  This file, project spec and rules for Claude Code.

- `README.md`  
  Human-facing documentation: what this extension does and how to install it.


## RULES

Hard rules for this project:
- Offline-only:
  - No external network calls from any script.
  - No use of `fetch`, `XMLHttpRequest`, WebSockets, or remote URLs.
- No external dependencies:
  - No CDNs, no third-party JS/CSS from the network.
  - If a small helper library is ever needed, vendor it locally in `src/` and document it here.
- Privacy:
  - No telemetry, analytics, or logging to remote endpoints.
  - No hidden data export; all data stays on the user’s device inside browser storage.
- Simplicity:
  - Use plain DOM APIs and vanilla JS.
  - Keep popup UI responsive and fast; aim for minimal reflows and no heavy animations.
- Robustness:
  - Handle storage failures gracefully (e.g., quota errors) with user-visible messages.
  - Never crash the popup silently; fail with clear, simple error states.
- Manifest:
  - Use Manifest V3 only.
  - Request minimal permissions required (e.g., `storage`, optional `tabs` if absolutely needed).
- Styling:
  - Use CSS variables for themes (`--background`, `--foreground`, etc.).
  - Ensure readable contrast in both light and dark modes.


## COMMANDS

How to run and test the extension locally:

- Build:
  - No build step. All source files are committed as-is.
  - Ensure `manifest.json` points to `src/popup.html` and other entry points correctly.

- Run (Chrome/Chromium):
  1. Open `chrome://extensions/`.
  2. Enable “Developer mode”.
  3. Click “Load unpacked”.
  4. Select the project root folder (containing `manifest.json`).

- Usage:
  - Pin the extension to the toolbar.
  - Click the icon to open the popup.
  - Use the editor to create a new note; it should auto-save to local storage.
  - Notes list should show titles/snippets, with ability to select and edit a note.

- Testing:
  - Manually verify:
    - Notes persist across browser restarts.
    - No features stop working when offline (e.g., turn off Wi-Fi and continue using notes).
    - Extension does not request unexpected permissions.
  - Later: add simple in-browser tests if needed (but no test framework required initially).


## DECISIONS

- Storage choice:
  - Use `chrome.storage.local` instead of IndexedDB for simpler key/value semantics and tight integration with extension APIs.
- No sync:
  - Do not integrate with `chrome.storage.sync`, remote servers, or any Mozilla sync equivalents.
  - This is intentional to keep the mental model “local notebook” and avoid user accounts.
- No frameworks:
  - Avoid React/Vue/Svelte and build a simple component structure with plain JS.
  - Keeps bundle size small and debugging straightforward inside the extension environment.
- UI scope:
  - Focus on text notes with a title and body.
  - Optional lightweight Markdown (bold, italic, headings) can be added later with a basic parser or regex.


## KNOWN ISSUES

(Starting list; keep updated as the project evolves.)

- No import/export yet:
  - Users cannot back up or restore notes to a file.
- No tagging or search:
  - Initial version may only support a flat list of notes without filters.
- No keyboard shortcuts:
  - Keyboard-only workflows (e.g., global shortcut to open notes) are not implemented.


## NEXT STEPS

Short-term:
1. Create initial `manifest.json` for Manifest V3 with minimal permissions.
2. Scaffold `popup.html`, `popup.css`, and `popup.js` with a basic notes list + editor.
3. Implement `storage.js` abstraction over `chrome.storage.local` and wire it into `popup.js`.
4. Add manual testing checklist to `README.md` for offline behavior and persistence.

Medium-term:
5. Add note search (simple text filter over titles and bodies).
6. Add optional dark mode toggle stored in extension settings.
7. Add basic keyboard shortcuts inside the popup (e.g., `Ctrl+N` for new note).

Long-term (optional):
8. Implement import/export notes as JSON or Markdown file, still fully offline.
9. Add lightweight Markdown preview area in the popup.
10. Add an optional options page (`options.html`) for configuring defaults (theme, sort order).
