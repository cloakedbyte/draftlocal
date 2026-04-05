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
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const noteList       = document.getElementById("note-list");
const noteTitle      = document.getElementById("note-title");
const noteBody       = document.getElementById("note-body");
const btnNewNote     = document.getElementById("btn-new-note");
const btnDeleteNote  = document.getElementById("btn-delete-note");
const saveStatus     = document.getElementById("save-status");
const errorBanner    = document.getElementById("error-banner");
const errorMessage   = document.getElementById("error-message");
const btnDismissErr  = document.getElementById("btn-dismiss-error");

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
  // Sort newest-updated first
  const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);

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
    return;
  }

  noteTitle.value = note.title;
  noteBody.value = note.body;
  noteTitle.disabled = false;
  noteBody.disabled = false;
  btnDeleteNote.disabled = false;
}

function setSaveStatus(text) {
  saveStatus.textContent = text;
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

noteTitle.addEventListener("input", scheduleSave);
noteBody.addEventListener("input", scheduleSave);

// Keyboard shortcut: Ctrl+N / Cmd+N → new note
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    createNote();
  }
});

btnDismissErr.addEventListener("click", hideError);

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAll();
