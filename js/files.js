// Saving and opening drawings as .walboard files (JSON).
window.WB = window.WB || {};

const FILE_TYPE = "walboard";
const FILE_VERSION = 1;
const FILE_EXTENSION = ".walboard";

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

// File chosen with "Save" for each canvas (by key); later saves write straight to it (Chrome and Edge only)
const fileHandles = new Map();

// Saves the text to a file. key: identifies the canvas; name: suggested file name.
// Returns false if the user cancelled
WB.saveSceneFile = async function (text, key, name) {
  const fileName = `${name || "drawing"}${FILE_EXTENSION}`;
  if (window.showSaveFilePicker) {
    try {
      let handle = fileHandles.get(key);
      if (!handle) {
        handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Walboard drawing", accept: { "application/json": [FILE_EXTENSION] } }],
        });
        fileHandles.set(key, handle);
      }
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
      // The picker is not allowed here (e.g. opened as a local file): fall back to a download
      fileHandles.delete(key);
    }
  }
  WB.downloadBlob(new Blob([text], { type: "application/json" }), fileName);
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

// Exports the elements as a PNG image named after the canvas
WB.exportPng = function (elements, name) {
  WB.renderToImage(elements).toBlob((blob) => WB.downloadBlob(blob, `${name || "drawing"}.png`), "image/png");
};

// Lets the user pick a file and resolves with { text, name } (or null if cancelled)
WB.openSceneFile = function () {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${FILE_EXTENSION},.json`;
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      resolve({ text: await file.text(), name: file.name.replace(/\.(walboard|json)$/i, "") });
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
};
