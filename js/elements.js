// Element model: each shape on the canvas is a plain object with these properties.
window.WB = window.WB || {};

WB.DEFAULT_STYLE = {
  strokeColor: "#041e42", // Walmart navy
  fillColor: "transparent",
  strokeWidth: 2,
};

// Font for canvas text: taken from the --font-hand CSS variable
WB.getFontFamily = function () {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim();
};

WB.DEFAULT_FONT_SIZE = 20;
WB.FONT_SIZES = { S: 16, M: 20, L: 28, XL: 36 };
WB.FONT_STYLES = ["bold", "italic", "underline", "strike"]; // on / off flags of texts and labels

// Shapes that can hold text inside (or below): every box shape
WB.canHaveLabel = function (type) {
  return !WB.LINEAR_TYPES.includes(type) && type !== "text";
};

// Default text position: centered inside the shape; infrastructure icons get it below, like a caption
WB.defaultTextAlign = (el) => (el.type === "text" ? "left" : "center");
WB.defaultVerticalAlign = (el) => (WB.INFRA_SHAPES[el.type] ? "below" : "middle");

// Canvas font for an element: its size plus bold / italic
WB.fontFor = function (el) {
  return `${el.italic ? "italic " : ""}${el.bold ? "bold " : ""}${el.fontSize}px ${WB.getFontFamily()}`;
};

// Splits text into lines that fit in maxWidth, breaking between words. el: the element whose font is used.
// A single word wider than maxWidth stays whole if it fits in wordMaxWidth (default: maxWidth); otherwise it is cut
WB.wrapText = function (text, el, maxWidth, wordMaxWidth = maxWidth) {
  measureCtx.font = WB.fontFor(el);
  const fits = (line) => measureCtx.measureText(line).width <= maxWidth;
  const wordFits = (word) => measureCtx.measureText(word).width <= wordMaxWidth;
  const lines = [];
  text.split("\n").forEach((paragraph) => {
    let line = "";
    paragraph.split(" ").forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        return;
      }
      if (line) lines.push(line);
      line = "";
      if (wordFits(word)) {
        line = word;
        return;
      }
      // A single word wider than the whole space is cut into pieces
      for (const char of word) {
        if (line && !fits(line + char)) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    });
    lines.push(line);
  });
  return lines;
};

// Width and height a text takes on the canvas
const measureCtx = document.createElement("canvas").getContext("2d");
WB.measureText = function (text, el) {
  measureCtx.font = WB.fontFor(el);
  const lines = text.split("\n");
  return {
    width: Math.max(...lines.map((line) => measureCtx.measureText(line).width)),
    height: lines.length * el.fontSize * WB.LINE_HEIGHT,
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
    el.fontSize = style.fontSize || WB.DEFAULT_FONT_SIZE;
    el.textAlign = style.textAlign || "left";
  }
  // Font styles chosen for the next text
  WB.FONT_STYLES.forEach((key) => {
    if (style[key] && (type === "text" || WB.canHaveLabel(type))) el[key] = true;
  });
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
