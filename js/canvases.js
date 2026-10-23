// Canvas store: keeps every canvas in the browser (localStorage).
//   walboard:canvases      → list of { id, name, updatedAt }
//   walboard:canvas:<id>   → the canvas drawing, in the same format as a .walboard file
//   walboard:current       → id of the open canvas
// If the browser blocks storage (private mode, blocked site data), canvases live in memory
// until the page is closed.
window.WB = window.WB || {};

const INDEX_KEY = "walboard:canvases";
const CURRENT_KEY = "walboard:current";
const LEGACY_AUTOSAVE_KEY = "walboard:autosave"; // single drawing saved before canvases existed
const sceneKey = (id) => `walboard:canvas:${id}`;

const memoryStorage = new Map();

function readItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStorage.has(key) ? memoryStorage.get(key) : null;
  }
}

function writeItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    memoryStorage.delete(key);
  }
}

function readIndex() {
  try {
    const list = JSON.parse(readItem(INDEX_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list) {
  writeItem(INDEX_KEY, JSON.stringify(list));
}

// "Untitled N" with the first N not used yet
function nextUntitledName(list) {
  const names = new Set(list.map((c) => c.name));
  let n = 1;
  while (names.has(`Untitled ${n}`)) n++;
  return `Untitled ${n}`;
}

WB.canvasStore = {
  // Canvases, most recently edited first
  list() {
    return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  get(id) {
    return readIndex().find((c) => c.id === id) || null;
  },

  // Creates a canvas (empty, or with the given scene) and returns its { id, name, updatedAt }
  create(name, scene) {
    const list = readIndex();
    const meta = {
      id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || nextUntitledName(list),
      updatedAt: Date.now(),
    };
    writeIndex([...list, meta]);
    const content = scene || { elements: [], view: null };
    writeItem(sceneKey(meta.id), WB.serializeScene(content.elements, content.view));
    return meta;
  },

  // Returns { elements, view } of a canvas
  load(id) {
    try {
      return WB.parseScene(readItem(sceneKey(id)));
    } catch {
      return { elements: [], view: null };
    }
  },

  // touch: whether the content changed (moves the canvas to the top of the list).
  // Saving only the view (pan / zoom) does not touch it
  save(id, elements, view, touch = true) {
    writeItem(sceneKey(id), WB.serializeScene(elements, view));
    if (touch) {
      writeIndex(readIndex().map((c) => (c.id === id ? { ...c, updatedAt: Date.now() } : c)));
    }
  },

  rename(id, name) {
    writeIndex(readIndex().map((c) => (c.id === id ? { ...c, name } : c)));
  },

  remove(id) {
    writeIndex(readIndex().filter((c) => c.id !== id));
    removeItem(sceneKey(id));
  },

  getCurrentId() {
    return readItem(CURRENT_KEY);
  },

  setCurrentId(id) {
    writeItem(CURRENT_KEY, id);
  },

  // Makes sure there is at least one canvas and returns the id to open.
  // The drawing from before canvases existed becomes the first canvas
  init() {
    if (!readIndex().length) {
      let legacy = null;
      try {
        legacy = WB.parseScene(readItem(LEGACY_AUTOSAVE_KEY));
      } catch {
        // nothing to migrate
      }
      const meta = WB.canvasStore.create(null, legacy);
      removeItem(LEGACY_AUTOSAVE_KEY);
      WB.canvasStore.setCurrentId(meta.id);
    }
    const currentId = WB.canvasStore.getCurrentId();
    return WB.canvasStore.get(currentId) ? currentId : WB.canvasStore.list()[0].id;
  },
};
