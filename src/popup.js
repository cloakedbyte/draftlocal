/**
 * popup.js — note list + editor logic.
 *
 * Depends on storage.js being loaded first (declared in popup.html).
 * All state lives in `state`; DOM is only mutated through render functions.
 */

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  notes: [],          // Array<{ id, title, body, updatedAt }>
  activeId: null,     // id of the currently selected note, or null
  saveTimer: null,    // debounce handle for auto-save
  searchQuery: "",    // current search filter string
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

const TITLE_WORD_LIMIT = 100;

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

  // Sort newest-updated first
  const sorted = [...visible].sort((a, b) => b.updatedAt - a.updatedAt);

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
    return;
  }

  noteTitle.value = note.title;
  noteBody.value = note.body;
  noteTitle.disabled = false;
  noteBody.disabled = false;
  btnDeleteNote.disabled = false;
  resizeTitleField();
  updateTitleWordCount();
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
 * Enforce the 100-word limit on title input.
 * If the new value would exceed the limit, truncate to the last valid word.
 */
function enforceTitleWordLimit() {
  const words = noteTitle.value.trim().split(/\s+/).filter(Boolean);
  if (words.length > TITLE_WORD_LIMIT) {
    // Preserve trailing space only if still within limit
    noteTitle.value = words.slice(0, TITLE_WORD_LIMIT).join(" ");
  }
}

/** Auto-grow the title textarea to fit its content with no scroll. */
function resizeTitleField() {
  noteTitle.style.height = "auto";
  noteTitle.style.height = noteTitle.scrollHeight + "px";
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    state.notes = await loadNotes();
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

// ─── Event Listeners ──────────────────────────────────────────────────────────

btnNewNote.addEventListener("click", createNote);

btnDeleteNote.addEventListener("click", () => {
  const note = getActiveNote();
  const name = note && note.title ? `"${note.title}"` : "this note";
  if (window.confirm(`Delete ${name}?`)) {
    removeActiveNote();
  }
});

noteTitle.addEventListener("input", () => {
  enforceTitleWordLimit();
  resizeTitleField();
  updateTitleWordCount();
  scheduleSave();
});
noteBody.addEventListener("input", scheduleSave);

// Keyboard shortcut: Ctrl+N / Cmd+N → new note
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    createNote();
  }
});

btnDismissErr.addEventListener("click", hideError);

searchInput.addEventListener("input", () => {
  state.searchQuery = searchInput.value.trim();
  renderNoteList();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAll();
