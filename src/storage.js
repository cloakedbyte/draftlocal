/**
 * storage.js — thin abstraction over chrome.storage.local for notes.
 *
 * Data shape:
 *   chrome.storage.local key: "notes"
 *   value: Array of { id: string, title: string, body: string, updatedAt: number }
 */

const STORAGE_KEY = "notes";

/**
 * Load all notes from local storage.
 * @returns {Promise<Array>} Resolves with the notes array (may be empty).
 */
function loadNotes() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[STORAGE_KEY] || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Save the full notes array back to local storage, replacing whatever was there.
 * @param {Array} notes
 * @returns {Promise<void>}
 */
function saveAllNotes(notes) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: notes }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Upsert a single note. If a note with the same id exists it is replaced;
 * otherwise it is appended.
 * @param {Object} note  Must have at minimum { id, title, body, updatedAt }
 * @returns {Promise<void>}
 */
async function saveNote(note) {
  const notes = await loadNotes();
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    notes[idx] = note;
  } else {
    notes.push(note);
  }
  return saveAllNotes(notes);
}

/**
 * Delete a note by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteNote(id) {
  const notes = await loadNotes();
  return saveAllNotes(notes.filter((n) => n.id !== id));
}

/**
 * Generate a simple unique id (timestamp + random suffix).
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
