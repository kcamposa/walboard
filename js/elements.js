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

WB.DEFAULT_FONT_SIZE = 20;

// Width and height a text takes on the canvas
const measureCtx = document.createElement("canvas").getContext("2d");
WB.measureText = function (text, fontSize) {
  measureCtx.font = `${fontSize}px ${WB.getFontFamily()}`;
  const lines = text.split("\n");
  return {
    width: Math.max(...lines.map((line) => measureCtx.measureText(line).width)),
    height: lines.length * fontSize * WB.LINE_HEIGHT,
  };
};

let nextId = 1;

// Types drawn with a list of points instead of a box
WB.LINEAR_TYPES = ["line", "arrow", "doubleArrow", "elbowArrow", "pencil"];
// Linear types defined by a start and an end point
WB.TWO_POINT_TYPES = ["line", "arrow", "doubleArrow", "elbowArrow"];

// Whether the type can have a background: box shapes, except texts and infrastructure icons
WB.isFillable = function (type) {
  return !WB.LINEAR_TYPES.includes(type) && type !== "text" && !WB.INFRA_SHAPES[type];
};

// style (optional): { strokeColor, fillColor } chosen in the style panel
WB.createElement = function (type, x, y, style = {}) {
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
  if (style.strokeColor) el.strokeColor = style.strokeColor;
  if (style.fillColor && style.fillColor !== "transparent" && WB.isFillable(type)) {
    el.fillColor = style.fillColor;
  } else {
    // Shapes like the sticky note have their own background unless another one is chosen
    const extra = WB.EXTRA_SHAPES[type];
    if (extra && extra.fillColor) el.fillColor = extra.fillColor;
  }
  if (type === "text") {
    el.text = "";
    el.fontSize = WB.DEFAULT_FONT_SIZE;
  }
  if (WB.LINEAR_TYPES.includes(type)) {
    // Points relative to (x, y). Lines and arrows: start and end. Pencil: the whole path.
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
