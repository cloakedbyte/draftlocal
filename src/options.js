"use strict";

/**
 * options.js — reads and writes extension settings.
 * Depends on storage.js being loaded first (declared in options.html).
 */

const themeRadios    = document.querySelectorAll("input[name='theme']");
const sortRadios     = document.querySelectorAll("input[name='sortOrder']");
const saveIndicator  = document.getElementById("save-indicator");

let saveIndicatorTimer = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "auto";
}

function setRadio(radios, value) {
  for (const r of radios) {
    r.checked = r.value === value;
  }
}

function showSaved() {
  saveIndicator.textContent = "Saved";
  if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => {
    saveIndicator.textContent = "";
  }, 1500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const settings = await loadSettings();
    applyTheme(settings.theme);
    setRadio(themeRadios, settings.theme);
    setRadio(sortRadios, settings.sortOrder);
  } catch (err) {
    saveIndicator.textContent = "Could not load settings.";
  }
}

// ─── Event listeners ─────────────────────────────────────────────────────────

async function onSettingChange() {
  const theme = [...themeRadios].find((r) => r.checked)?.value || "auto";
  const sortOrder = [...sortRadios].find((r) => r.checked)?.value || "newest";

  applyTheme(theme);

  try {
    await saveSettings({ theme, sortOrder });
    showSaved();
  } catch (err) {
    saveIndicator.textContent = "Save failed: " + err.message;
  }
}

for (const r of themeRadios)   r.addEventListener("change", onSettingChange);
for (const r of sortRadios)    r.addEventListener("change", onSettingChange);

init();
