// Undo/redo history: stores a copy of all elements after each finished change.
window.WB = window.WB || {};

const MAX_HISTORY = 100;

WB.createHistory = function (elements) {
  // Each entry is the elements serialized as JSON; `index` points to the current one
  const entries = [JSON.stringify(elements)];
  let index = 0;

  return {
    // Records the current elements. Returns false if nothing changed since the last entry
    record(current) {
      const json = JSON.stringify(current);
      if (json === entries[index]) return false;
      entries.splice(index + 1); // a new change discards the redo steps
      entries.push(json);
      if (entries.length > MAX_HISTORY) entries.shift();
      index = entries.length - 1;
      return true;
    },
    canUndo: () => index > 0,
    canRedo: () => index < entries.length - 1,
    // Return a fresh copy of the elements at the previous / next entry
    undo() {
      if (index > 0) index--;
      return JSON.parse(entries[index]);
    },
    redo() {
      if (index < entries.length - 1) index++;
      return JSON.parse(entries[index]);
    },
  };
};
