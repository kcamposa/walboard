// Geometry helpers: element bounds, hit testing, moving and scaling.
window.WB = window.WB || {};

// Camera: the scene point shown at the top-left corner of the screen, and the zoom level.
// Screen position = (scene position - view.x / view.y) * zoom
WB.view = { x: 0, y: 0, zoom: 1 };

// Sizes in screen pixels: divided by the zoom so they look the same at any zoom level
const HIT_TOLERANCE = 8; // how close a click must be to a line to hit it
WB.HANDLE_SIZE = 9; // size of the resize handles
WB.SELECTION_PADDING = 6; // gap between the elements and the selection frame

// Line and pencil points are stored relative to (x, y); this converts them to canvas coordinates
WB.absolutePoints = function (el) {
  return el.points.map(([px, py]) => [el.x + px, el.y + py]);
};

// Points a line goes through. The elbow arrow turns at right angles halfway:
// horizontal-vertical-horizontal, or vertical-horizontal-vertical when it is taller than wide
WB.lineRoute = function (el) {
  const [from, to] = WB.absolutePoints(el);
  if (el.type !== "elbowArrow") return [from, to];

  const horizontalFirst = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]);
  const corners = horizontalFirst
    ? [[(from[0] + to[0]) / 2, from[1]], [(from[0] + to[0]) / 2, to[1]]]
    : [[from[0], (from[1] + to[1]) / 2], [to[0], (from[1] + to[1]) / 2]];
  // Skip repeated points (a straight elbow arrow has no real corners)
  return [from, ...corners, to].filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
};

// Smallest box { x, y, width, height } containing the element
WB.getBounds = function (el) {
  if (!el.points) return WB.normalizeElement({ x: el.x, y: el.y, width: el.width, height: el.height });
  const points = WB.absolutePoints(el);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

// Smallest box containing several elements (null if there are none)
WB.getCommonBounds = function (elements) {
  if (!elements.length) return null;
  const boxes = elements.map(WB.getBounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
};

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Whether the point { x, y } touches the element.
// Lines and pencil strokes are hit near the stroke; every other element anywhere inside its box
WB.hitTest = function (el, p) {
  const point = [p.x, p.y];
  if (el.points) {
    const route = el.type === "pencil" ? WB.absolutePoints(el) : WB.lineRoute(el);
    const tolerance = HIT_TOLERANCE / WB.view.zoom + el.strokeWidth / 2;
    if (route.length === 1) return Math.hypot(point[0] - route[0][0], point[1] - route[0][1]) <= tolerance;
    return route.slice(1).some((b, i) => distanceToSegment(point, route[i], b) <= tolerance);
  }
  const b = WB.getBounds(el);
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
};

// Topmost element under the point, or null
WB.elementAt = function (elements, p) {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (WB.hitTest(elements[i], p)) return elements[i];
  }
  return null;
};

// Whether box `inner` is completely inside box `outer`
WB.boxContains = function (outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
};

// Selection frame with its padding around the selected elements' bounds
WB.selectionFrame = function (bounds) {
  const pad = WB.SELECTION_PADDING / WB.view.zoom;
  return { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
};

// Positions of the four resize handles of a selection frame: nw, ne, sw, se
WB.handlePositions = function (frame) {
  return {
    nw: [frame.x, frame.y],
    ne: [frame.x + frame.width, frame.y],
    sw: [frame.x, frame.y + frame.height],
    se: [frame.x + frame.width, frame.y + frame.height],
  };
};

// Name of the resize handle under the point, or null
WB.handleAt = function (frame, p) {
  const reach = WB.HANDLE_SIZE / WB.view.zoom;
  const found = Object.entries(WB.handlePositions(frame)).find(
    ([, [hx, hy]]) => Math.abs(p.x - hx) <= reach && Math.abs(p.y - hy) <= reach,
  );
  return found ? found[0] : null;
};

// Moves an element: `original` is a copy taken when the drag started
WB.moveElement = function (el, original, dx, dy) {
  el.x = original.x + dx;
  el.y = original.y + dy;
};

// Scales an element around the anchor point: `original` is a copy taken when the resize started
WB.scaleElement = function (el, original, anchor, sx, sy) {
  el.x = anchor[0] + (original.x - anchor[0]) * sx;
  el.y = anchor[1] + (original.y - anchor[1]) * sy;

  if (original.points) {
    el.points = original.points.map(([px, py]) => [px * sx, py * sy]);
  } else if (original.type === "text") {
    el.fontSize = Math.max(4, original.fontSize * sy);
    Object.assign(el, WB.measureText(el.text, el));
  } else {
    el.width = original.width * sx;
    el.height = original.height * sy;
  }
};

// ---- Text inside shapes (labels) ----

const LABEL_PADDING = 10;
const MIN_BELOW_WIDTH = 160; // labels below a shape can be wider than it
// Part of the box (top, right, bottom, left) left empty so the text stays inside non-rectangular shapes
const LABEL_INSETS = {
  ellipse: [0.15, 0.15, 0.15, 0.15],
  diamond: [0.25, 0.25, 0.25, 0.25],
  triangle: [0.45, 0.22, 0.05, 0.22],
  hexagon: [0.05, 0.15, 0.05, 0.15],
  star: [0.32, 0.3, 0.25, 0.3],
  parallelogram: [0, 0.18, 0, 0.18],
  cloud: [0.18, 0.15, 0.18, 0.15],
  speechBubble: [0, 0, 0.22, 0],
  cylinder: [0.2, 0, 0.08, 0],
  stickyNote: [0, 0, 0.12, 0],
};

// Area available for the label: inside the shape, or under it when the label goes below
WB.labelArea = function (el) {
  const b = WB.getBounds(el);
  if ((el.verticalAlign || WB.defaultVerticalAlign(el)) === "below") {
    const width = Math.max(b.width, MIN_BELOW_WIDTH);
    return { x: b.x + b.width / 2 - width / 2, y: b.y + b.height + 8, width, height: 0 };
  }
  const [top, right, bottom, left] = WB.INFRA_SHAPES[el.type] ? [0, 0, 0, 0] : LABEL_INSETS[el.type] || [0, 0, 0, 0];
  return {
    x: b.x + b.width * left + LABEL_PADDING,
    y: b.y + b.height * top + LABEL_PADDING,
    width: Math.max(1, b.width * (1 - left - right) - LABEL_PADDING * 2),
    height: Math.max(0, b.height * (1 - top - bottom) - LABEL_PADDING * 2),
  };
};

// Top of a block of text of the given height inside the label area, following the vertical alignment
WB.labelTop = function (el, area, textHeight) {
  switch (el.verticalAlign || WB.defaultVerticalAlign(el)) {
    case "top":
    case "below":
      return area.y;
    case "bottom":
      return area.y + area.height - textHeight;
    default:
      return area.y + (area.height - textHeight) / 2;
  }
};

// Where each line of the label goes: { lines, x, y, width, lineHeight, align }
WB.labelLayout = function (el) {
  const area = WB.labelArea(el);
  // Long words may use the whole width of the shape before being cut
  const wordMaxWidth = Math.max(area.width, WB.getBounds(el).width - LABEL_PADDING * 2);
  const lines = WB.wrapText(el.label, el, area.width, wordMaxWidth);
  const lineHeight = el.fontSize * WB.LINE_HEIGHT;
  return {
    lines,
    x: area.x,
    y: WB.labelTop(el, area, lines.length * lineHeight),
    width: area.width,
    lineHeight,
    align: el.textAlign || WB.defaultTextAlign(el),
  };
};

// Bounds including the text below a shape (used when exporting, so it is not cut off)
WB.getVisualBounds = function (el) {
  const b = WB.getBounds(el);
  if (!el.label || (el.verticalAlign || WB.defaultVerticalAlign(el)) !== "below") return b;
  const layout = WB.labelLayout(el);
  const x = Math.min(b.x, layout.x);
  const y = Math.min(b.y, layout.y);
  const right = Math.max(b.x + b.width, layout.x + layout.width);
  const bottom = Math.max(b.y + b.height, layout.y + layout.lines.length * layout.lineHeight);
  return { x, y, width: right - x, height: bottom - y };
};
