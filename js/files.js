// Saving and opening drawings as .walboard files (JSON), plus an automatic copy in the browser.
window.WB = window.WB || {};

const FILE_TYPE = "walboard";
const FILE_VERSION = 1;
const FILE_EXTENSION = ".walboard";
const AUTOSAVE_KEY = "walboard:autosave";

WB.serializeScene = function (elements, view) {
  return JSON.stringify({ type: FILE_TYPE, version: FILE_VERSION, elements, view }, null, 2);
};

// Returns { elements, view } or throws an Error with a readable message
WB.parseScene = function (text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file is damaged or is not a Walboard drawing.");
  }
  if (!data || data.type !== FILE_TYPE || !Array.isArray(data.elements)) {
    throw new Error("This file is not a Walboard drawing.");
  }
  return { elements: data.elements, view: data.view || null };
};

// File chosen with the last "Save"; later saves write straight to it (Chrome and Edge only)
let currentFileHandle = null;

// Saves the text to a file. Returns false if the user cancelled
WB.saveSceneFile = async function (text) {
  if (window.showSaveFilePicker) {
    try {
      if (!currentFileHandle) {
        currentFileHandle = await window.showSaveFilePicker({
          suggestedName: `drawing${FILE_EXTENSION}`,
          types: [{ description: "Walboard drawing", accept: { "application/json": [FILE_EXTENSION] } }],
        });
      }
      const writable = await currentFileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
      // The picker is not allowed here (e.g. opened as a local file): fall back to a download
      currentFileHandle = null;
    }
  }
  WB.downloadBlob(new Blob([text], { type: "application/json" }), `drawing${FILE_EXTENSION}`);
  return true;
};

// Saves a blob through the browser's downloads
WB.downloadBlob = function (blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

// Exports the elements as a PNG image
WB.exportPng = function (elements) {
  WB.renderToImage(elements).toBlob((blob) => WB.downloadBlob(blob, "drawing.png"), "image/png");
};

// Lets the user pick a file and resolves with its text (or null if cancelled)
WB.openSceneFile = function () {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${FILE_EXTENSION},.json`;
    input.addEventListener("change", async () => {
      const file = input.files[0];
      // A file opened this way cannot be written back, so the next save asks again
      currentFileHandle = null;
      resolve(file ? await file.text() : null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
};

// Automatic copy in this browser, so reloading the page does not lose the drawing.
// Storage can be unavailable (private mode, blocked site data); then it is silently skipped
WB.autosave = function (elements, view) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, WB.serializeScene(elements, view));
  } catch {
    // ignore
  }
};

WB.loadAutosave = function () {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    return text ? WB.parseScene(text) : null;
  } catch {
    return null;
  }
};
