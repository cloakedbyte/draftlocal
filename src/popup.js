/**
 * popup.js — note list + editor logic.
 *
 * Depends on storage.js being loaded first (declared in popup.html).
 * All state lives in `state`; DOM is only mutated through render functions.
 */

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  notes: [],           // Array<{ id, title, body, updatedAt }>
  activeId: null,      // id of the currently selected note, or null
  saveTimer: null,     // debounce handle for auto-save
  searchQuery: "",     // current search filter string
  sortOrder: "newest", // "newest" | "oldest" | "title"
  pendingDelete: null, // { note, timer } — undo delete slot
  viewMode: "edit",   // "edit" | "preview"
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const noteList         = document.getElementById("note-list");
const noteTitle        = document.getElementById("note-title");
const noteBody         = document.getElementById("note-body");
const btnNewNote       = document.getElementById("btn-new-note");
const btnDeleteNote    = document.getElementById("btn-delete-note");
const saveStatus       = document.getElementById("save-status");
const errorBanner      = document.getElementById("error-banner");
const errorMessage     = document.getElementById("error-message");
const btnDismissErr    = document.getElementById("btn-dismiss-error");
const searchInput      = document.getElementById("search");
const titleWordCount   = document.getElementById("title-word-count");
const btnExport        = document.getElementById("btn-export");
const btnImport        = document.getElementById("btn-import");
const importFileInput  = document.getElementById("import-file");
const btnThemeToggle   = document.getElementById("btn-theme-toggle");
const emptyState       = document.getElementById("empty-state");
const quotaBanner      = document.getElementById("quota-banner");
const quotaMessage     = document.getElementById("quota-message");
const btnDismissQuota  = document.getElementById("btn-dismiss-quota");
const undoToast        = document.getElementById("undo-toast");
const btnUndoDelete    = document.getElementById("btn-undo-delete");
const resizeHandle     = document.getElementById("resize-handle");
const btnExpandToggle  = document.getElementById("btn-expand-toggle");
const btnTabEdit       = document.getElementById("btn-tab-edit");
const btnTabPreview    = document.getElementById("btn-tab-preview");
const notePreview      = document.getElementById("note-preview");

const TITLE_WORD_LIMIT = 50;

// ─── Error display ────────────────────────────────────────────────────────────

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
  errorMessage.textContent = "";
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderNoteList() {
  noteList.innerHTML = "";

  // Filter by search query (case-insensitive match on title or body)
  const q = state.searchQuery.toLowerCase();
  const visible = q
    ? state.notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q)
      )
    : state.notes;

  // Sort according to user preference
  let sorted;
  if (state.sortOrder === "oldest") {
    sorted = [...visible].sort((a, b) => a.updatedAt - b.updatedAt);
  } else if (state.sortOrder === "title") {
    sorted = [...visible].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "")
    );
  } else {
    // default: newest first
    sorted = [...visible].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  if (sorted.length === 0 && q) {
    const empty = document.createElement("li");
    empty.className = "note-list-empty";
    empty.textContent = "No results";
    noteList.appendChild(empty);
    return;
  }

  for (const note of sorted) {
    const li = document.createElement("li");
    li.dataset.id = note.id;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", note.id === state.activeId ? "true" : "false");
    if (note.id === state.activeId) li.classList.add("active");

    const titleEl = document.createElement("div");
    titleEl.className = "note-item-title";
    titleEl.textContent = note.title || "Untitled";

    const snippetEl = document.createElement("div");
    snippetEl.className = "note-item-snippet";
    snippetEl.textContent = note.body.slice(0, 60) || "…";

    li.appendChild(titleEl);
    li.appendChild(snippetEl);
    li.addEventListener("click", () => selectNote(note.id));
    noteList.appendChild(li);
  }
}

function renderEditor() {
  const note = state.notes.find((n) => n.id === state.activeId);

  if (!note) {
    noteTitle.value = "";
    noteBody.value = "";
    noteTitle.disabled = true;
    noteBody.disabled = true;
    btnDeleteNote.disabled = true;
    saveStatus.textContent = "";
    titleWordCount.textContent = "0 / " + TITLE_WORD_LIMIT;
    titleWordCount.classList.remove("at-limit");
    // Show empty state only when there are truly no notes at all
    emptyState.hidden = state.notes.length > 0;
    document.getElementById("editor-toolbar").hidden = state.notes.length === 0;
    document.getElementById("title-wrapper").hidden  = state.notes.length === 0;
    document.getElementById("note-body").hidden       = state.notes.length === 0;
    document.getElementById("note-preview").hidden    = true;
    document.getElementById("status-bar").hidden      = state.notes.length === 0;
    return;
  }

  emptyState.hidden = true;
  document.getElementById("editor-toolbar").hidden = false;
  document.getElementById("title-wrapper").hidden  = false;
  document.getElementById("status-bar").hidden      = false;

  noteTitle.value = note.title;
  noteBody.value = note.body;
  noteTitle.disabled = false;
  noteBody.disabled = false;
  btnDeleteNote.disabled = false;
  resizeTitleField();
  updateTitleWordCount();

  if (state.viewMode === "preview") {
    showPreviewMode();
  } else {
    showEditMode();
  }
}

function showEditMode() {
  state.viewMode = "edit";
  noteBody.hidden    = false;
  notePreview.hidden = true;
  btnTabEdit.setAttribute("aria-selected", "true");
  btnTabPreview.setAttribute("aria-selected", "false");
}

function showPreviewMode() {
  state.viewMode = "preview";
  notePreview.innerHTML = renderMarkdown(noteBody.value);
  noteBody.hidden    = true;
  notePreview.hidden = false;
  btnTabEdit.setAttribute("aria-selected", "false");
  btnTabPreview.setAttribute("aria-selected", "true");
}

function setSaveStatus(text) {
  saveStatus.textContent = text;
}

/** Count words in a string (split on whitespace, ignore empty tokens). */
function countWords(str) {
  return str.trim() === "" ? 0 : str.trim().split(/\s+/).length;
}

/** Update the word counter badge; return true if within limit. */
function updateTitleWordCount() {
  const count = countWords(noteTitle.value);
  titleWordCount.textContent = count + " / " + TITLE_WORD_LIMIT;
  const atLimit = count >= TITLE_WORD_LIMIT;
  titleWordCount.classList.toggle("at-limit", atLimit);
  return !atLimit;
}

/**
 * Enforce the 50-word limit on title input.
 * If the new value would exceed the limit, truncate to the last valid word.
 */
function enforceTitleWordLimit() {
  const words = noteTitle.value.trim().split(/\s+/).filter(Boolean);
  if (words.length > TITLE_WORD_LIMIT) {
    noteTitle.value = words.slice(0, TITLE_WORD_LIMIT).join(" ");
  }
}

/** Auto-grow the title textarea to fit its content with no scroll. */
function resizeTitleField() {
  noteTitle.style.height = "auto";
  noteTitle.style.height = noteTitle.scrollHeight + "px";
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Return the effective current theme ("dark" or "light"), factoring in system pref. */
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return "dark";
  if (t === "light") return "light";
  // auto — check system
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Update the toggle button icon to reflect the current theme. */
function updateThemeToggleIcon() {
  btnThemeToggle.textContent = effectiveTheme() === "dark" ? "\u2600" : "\u263D";
  btnThemeToggle.title = effectiveTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

async function loadAll() {
  try {
    const [notes, settings] = await Promise.all([loadNotes(), loadSettings()]);
    state.notes     = notes;
    state.sortOrder = settings.sortOrder || "newest";
    document.documentElement.dataset.theme = settings.theme || "auto";
    if (settings.sidebarWidth) {
      document.documentElement.style.setProperty("--sidebar-width", settings.sidebarWidth + "px");
    }
    if (settings.expanded) {
      document.documentElement.classList.add("expanded");
      btnExpandToggle.textContent = "\u229F"; // ⊟ collapse icon
      btnExpandToggle.title = "Collapse popup (Ctrl+E)";
    }
    updateThemeToggleIcon();
    renderNoteList();
    renderEditor();
  } catch (err) {
    showError("Failed to load notes: " + err.message);
  }
}

function selectNote(id) {
  // Flush any pending save for the previously active note first
  if (state.saveTimer !== null) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    flushSave();
  }
  state.activeId = id;
  state.viewMode = "edit"; // always land in edit mode when switching notes
  renderNoteList();
  renderEditor();
  noteTitle.focus();
}

async function createNote() {
  // Clear search so the new note is always visible in the list
  state.searchQuery = "";
  searchInput.value = "";

  const note = {
    id: generateId(),
    title: "",
    body: "",
    updatedAt: Date.now(),
  };
  state.notes.push(note);
  state.activeId = note.id;

  try {
    await saveNote(note);
  } catch (err) {
    showError("Could not save new note: " + err.message);
  }

  renderNoteList();
  renderEditor();
  noteTitle.focus();
}

async function removeActiveNote() {
  if (!state.activeId) return;

  const id = state.activeId;
  state.activeId = null;
  state.notes = state.notes.filter((n) => n.id !== id);

  try {
    await deleteNote(id);
  } catch (err) {
    showError("Could not delete note: " + err.message);
  }

  // Select the next most‑recent note if any
  if (state.notes.length > 0) {
    const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
    state.activeId = sorted[0].id;
  }

  renderNoteList();
  renderEditor();
}

function getActiveNote() {
  return state.notes.find((n) => n.id === state.activeId) || null;
}

/** Write the current editor contents into state (no storage call). */
function syncEditorToState() {
  const note = getActiveNote();
  if (!note) return;
  note.title = noteTitle.value;
  note.body = noteBody.value;
  note.updatedAt = Date.now();
}

/** Immediately persist the active note to storage. */
async function flushSave() {
  const note = getActiveNote();
  if (!note) return;
  try {
    setSaveStatus("Saving…");
    await saveNote(note);
    setSaveStatus("Saved");
    setTimeout(() => setSaveStatus(""), 1500);
    // Refresh sidebar snippet without losing cursor position
    renderNoteList();
    checkStorageQuota();
  } catch (err) {
    showError("Auto-save failed: " + err.message);
    setSaveStatus("");
  }
}

/** Debounced save triggered on every keystroke (500 ms quiet period). */
function scheduleSave() {
  syncEditorToState();
  setSaveStatus("Unsaved changes");
  if (state.saveTimer !== null) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    flushSave();
  }, 500);
}

/** Check storage quota and show warning banner if >80% full. */
function checkStorageQuota() {
  if (!chrome.storage.local.getBytesInUse) return;
  chrome.storage.local.getBytesInUse(null, (bytes) => {
    if (chrome.runtime.lastError) return;
    const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10 MB default
    const pct = bytes / quota;
    if (pct > 0.8) {
      const used = (bytes / 1024).toFixed(0);
      const total = (quota / 1024).toFixed(0);
      quotaMessage.textContent = `Storage ${Math.round(pct * 100)}% full (${used} KB / ${total} KB) — consider exporting old notes.`;
      quotaBanner.hidden = false;
    } else {
      quotaBanner.hidden = true;
    }
  });
}

// ─── Undo Delete ──────────────────────────────────────────────────────────

const UNDO_TIMEOUT_MS = 4000;

/** Show the undo toast for a deleted note. */
function showUndoToast(noteLabel) {
  undoToast.querySelector("#undo-toast-msg").textContent =
    `“${noteLabel || "Untitled"}” deleted`;
  undoToast.hidden = false;
}

function hideUndoToast() {
  undoToast.hidden = true;
}

/**
 * Soft-delete: remove from state + UI immediately, hold in pendingDelete.
 * After UNDO_TIMEOUT_MS, commit the delete to storage.
 */
function softDeleteNote(id) {
  // Cancel any existing pending delete first (commit it immediately)
  commitPendingDelete();

  const note = state.notes.find((n) => n.id === id);
  if (!note) return;

  // Remove from state
  state.notes = state.notes.filter((n) => n.id !== id);
  if (state.activeId === id) {
    state.activeId = state.notes.length > 0
      ? [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
      : null;
  }

  renderNoteList();
  renderEditor();

  // Set up undo slot
  const timer = setTimeout(commitPendingDelete, UNDO_TIMEOUT_MS);
  state.pendingDelete = { note, timer };
  showUndoToast(note.title);
}

/** Permanently delete the pending note from storage. */
async function commitPendingDelete() {
  if (!state.pendingDelete) return;
  const { note, timer } = state.pendingDelete;
  clearTimeout(timer);
  state.pendingDelete = null;
  hideUndoToast();
  try {
    await deleteNote(note.id);
  } catch (err) {
    showError("Could not delete note: " + err.message);
  }
}

/** Restore a soft-deleted note. */
function undoDelete() {
  if (!state.pendingDelete) return;
  const { note, timer } = state.pendingDelete;
  clearTimeout(timer);
  state.pendingDelete = null;
  hideUndoToast();
  // Put the note back
  state.notes.push(note);
  state.activeId = note.id;
  renderNoteList();
  renderEditor();
}

/**
 * Serialize all notes to a Markdown string.
 * Format per note:
 *   # Title\n\nBody\n\n---\n\n
 * Notes with no title use "Untitled".
 */
function notesToMarkdown(notes) {
  return notes
    .map((n) => {
      const title = (n.title.trim() || "Untitled").replace(/\n/g, " ");
      return `# ${title}\n\n${n.body.trim()}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Parse a Markdown string back into a notes array.
 * Splits on `---` (with surrounding blank lines), then reads the first `# heading`
 * as the title and the rest as the body.
 * Fresh ids + updatedAt are assigned (Markdown carries no metadata).
 */
function markdownToNotes(md) {
  const blocks = md.split(/\n\s*---\s*\n/);
  const notes = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    let title = "";
    let bodyStart = 0;

    if (lines[0].startsWith("# ")) {
      title = lines[0].slice(2).trim();
      bodyStart = 1;
      // skip blank line after heading
      if (lines[1] !== undefined && lines[1].trim() === "") bodyStart = 2;
    }

    const body = lines.slice(bodyStart).join("\n").trim();
    notes.push({ id: generateId(), title, body, updatedAt: Date.now() });
  }

  return notes;
}

/** Export all notes to a downloadable Markdown file. */
function exportNotes() {
  if (state.notes.length === 0) {
    showError("No notes to export.");
    return;
  }
  const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const md   = notesToMarkdown(sorted);
  const blob = new Blob([md], { type: "text/markdown; charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "notes-export.md";
  a.click();
  URL.revokeObjectURL(url);
}

/** Import notes from a Markdown file chosen by the user. */
function importNotes(file) {
  const reader = new FileReader();

  reader.onload = async (e) => {
    const parsed = markdownToNotes(e.target.result);

    if (parsed.length === 0) {
      showError("Import failed: no notes found in the file.");
      return;
    }

    // Ask: merge (keep existing + add new) or replace?
    const doReplace = state.notes.length > 0
      ? window.confirm(
          `Replace all ${state.notes.length} existing note(s) with the ${parsed.length} imported note(s)?\n\nClick OK to replace, Cancel to merge (append).`
        )
      : true;

    const merged = doReplace ? parsed : [...state.notes, ...parsed];

    try {
      await saveAllNotes(merged);
      state.notes = merged;
      state.activeId = null;
      renderNoteList();
      renderEditor();
    } catch (err) {
      showError("Import failed: could not save notes \u2014 " + err.message);
    }
  };

  reader.onerror = () => showError("Import failed: could not read the file.");
  reader.readAsText(file);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

btnNewNote.addEventListener("click", createNote);

btnDeleteNote.addEventListener("click", () => {
  if (!state.activeId) return;
  softDeleteNote(state.activeId);
});

/**
 * Block further typing in the title once the word limit is reached.
 * Allows: Backspace, Delete, Arrow keys, Home, End, Tab, Ctrl/Cmd combos (cut, undo, etc.).
 */
noteTitle.addEventListener("keydown", (e) => {
  const allowedKeys = [
    "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "Home", "End", "Tab", "Escape", "Enter",
  ];
  if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;

  // Only block when already AT the limit and the next char would add a word.
  // A word is added when typing a non-space after a space (or at end of last word
  // and the current count == limit). Simplest safe approach: block any printable
  // character keystroke when count has reached the limit.
  if (countWords(noteTitle.value) >= TITLE_WORD_LIMIT) {
    e.preventDefault();
  }
});

noteTitle.addEventListener("input", () => {
  enforceTitleWordLimit();
  resizeTitleField();
  updateTitleWordCount();
  scheduleSave();
});
noteBody.addEventListener("input", scheduleSave);

// Keyboard shortcut: Ctrl+N / Cmd+N → new note; Ctrl+E → expand/collapse; Ctrl+P → toggle preview
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    createNote();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "e") {
    e.preventDefault();
    toggleExpand();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    if (state.activeId) {
      state.viewMode === "preview" ? showEditMode() : showPreviewMode();
    }
  }
});

btnDismissErr.addEventListener("click", hideError);

btnDismissQuota.addEventListener("click", () => { quotaBanner.hidden = true; });

btnUndoDelete.addEventListener("click", undoDelete);

async function toggleExpand() {
  const isExpanded = document.documentElement.classList.toggle("expanded");
  btnExpandToggle.textContent = isExpanded ? "\u229F" : "\u229E"; // ⊟ collapse / ⊞ expand
  btnExpandToggle.title = isExpanded ? "Collapse popup (Ctrl+E)" : "Expand popup (Ctrl+E)";
  try {
    const settings = await loadSettings();
    await saveSettings(Object.assign({}, settings, { expanded: isExpanded }));
  } catch (err) {
    showError("Could not save expand state: " + err.message);
  }
}

btnExpandToggle.addEventListener("click", toggleExpand);

btnTabEdit.addEventListener("click", () => {
  if (state.activeId) showEditMode();
});

btnTabPreview.addEventListener("click", () => {
  if (state.activeId) showPreviewMode();
});

btnThemeToggle.addEventListener("click", async () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  updateThemeToggleIcon();
  try {
    const settings = await loadSettings();
    await saveSettings(Object.assign({}, settings, { theme: next }));
  } catch (err) {
    showError("Could not save theme: " + err.message);
  }
});

btnExport.addEventListener("click", exportNotes);

btnImport.addEventListener("click", () => {
  importFileInput.value = ""; // reset so same file can be re-imported
  importFileInput.click();
});

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if (file) importNotes(file);
});

searchInput.addEventListener("input", () => {
  state.searchQuery = searchInput.value.trim();
  renderNoteList();
});

// ─── Resize handle drag ───────────────────────────────────────────────────────

(function initResize() {
  const MIN_WIDTH = 80;
  const MAX_WIDTH = 300;
  let startX      = 0;
  let startWidth  = 0;
  let dragging    = false;

  resizeHandle.addEventListener("pointerdown", (e) => {
    dragging   = true;
    startX     = e.clientX;
    startWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"),
      10
    ) || 140;
    resizeHandle.setPointerCapture(e.pointerId);
    resizeHandle.classList.add("dragging");
    e.preventDefault();
  });

  resizeHandle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const delta    = e.clientX - startX;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
    document.documentElement.style.setProperty("--sidebar-width", newWidth + "px");
  });

  async function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    resizeHandle.classList.remove("dragging");
    const finalWidth = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, startWidth + (e.clientX - startX))
    );
    try {
      const settings = await loadSettings();
      await saveSettings(Object.assign({}, settings, { sidebarWidth: finalWidth }));
    } catch (err) {
      showError("Could not save sidebar width: " + err.message);
    }
  }

  resizeHandle.addEventListener("pointerup",     endDrag);
  resizeHandle.addEventListener("pointercancel", endDrag);
})();

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAll();
