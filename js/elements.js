// Element model: each shape on the canvas is a plain object with these properties.
window.WB = window.WB || {};

WB.DEFAULT_STYLE = {
  strokeColor: "#1f1f1f",
  fillColor: "transparent",
  strokeWidth: 2,
};

// Font for canvas text: taken from the --font-hand CSS variable
WB.getFontFamily = function () {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim();
};

let nextId = 1;

// Types drawn with a list of points instead of a box
WB.LINEAR_TYPES = ["line", "arrow", "pencil"];

WB.createElement = function (type, x, y) {
  const el = {
    id: `el-${Date.now()}-${nextId++}`,
    type,
    x,
    y,
    width: 0,
    height: 0,
    seed: Math.floor(Math.random() * 2 ** 31), // fixes the shape of the hand-drawn stroke
    ...WB.DEFAULT_STYLE,
  };
  const extra = WB.EXTRA_SHAPES[type];
  if (extra && extra.fillColor) el.fillColor = extra.fillColor;
  if (WB.LINEAR_TYPES.includes(type)) {
    // Points relative to (x, y). Line and arrow: start and end. Pencil: the whole path.
    el.points = type === "pencil" ? [[0, 0]] : [[0, 0], [0, 0]];
  }
  return el;
};

// Turns negative width/height (dragging up or left) into positive values
WB.normalizeElement = function (el) {
  if (el.width < 0) {
    el.x += el.width;
    el.width = -el.width;
  }
  if (el.height < 0) {
    el.y += el.height;
    el.height = -el.height;
  }
  return el;
};
