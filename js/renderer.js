// Draws the background and all elements on the canvas.
window.WB = window.WB || {};

const ARROW_HEAD_LENGTH = 18;
const ARROW_HEAD_ANGLE = Math.PI / 7;

WB.renderScene = function (ctx, width, height, elements) {
  const styles = getComputedStyle(document.documentElement);

  ctx.fillStyle = styles.getPropertyValue("--bg");
  ctx.fillRect(0, 0, width, height);

  // Dot grid as a visual guide
  const gap = 20;
  ctx.fillStyle = styles.getPropertyValue("--grid-dot");
  for (let x = gap; x < width; x += gap) {
    for (let y = gap; y < height; y += gap) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  elements.forEach((el) => drawElement(ctx, el));
};

function drawElement(ctx, el) {
  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.fillStyle = el.fillColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (el.type) {
    case "line":
    case "arrow":
    case "doubleArrow":
    case "elbowArrow":
      drawSketchyLine(ctx, el);
      break;
    case "text":
      drawText(ctx, el);
      break;
    case "pencil":
      // Same overlapping hand-drawn strokes as the other shapes
      ctx.lineWidth = el.strokeWidth * 0.75;
      for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
        WB.traceSketchyPath(ctx, absolutePoints(el), el.seed, pass);
        ctx.stroke();
      }
      break;
    default:
      // Box shapes: rectangle, ellipse, polygons, special and infrastructure shapes
      if (WB.INFRA_SHAPES[el.type]) drawInfraShape(ctx, el);
      else drawSketchyShape(ctx, el);
  }

  ctx.restore();
}

function drawSketchyShape(ctx, el) {
  const box = normalized(el);
  if (el.fillColor !== "transparent") {
    WB.traceSketchyShape(ctx, box);
    ctx.fill();
  }
  // Overlapping, slightly thinner strokes: together they give the uneven weight of a hand-drawn line
  ctx.lineWidth = el.strokeWidth * 0.75;
  for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
    WB.traceSketchyShape(ctx, box, pass);
    ctx.stroke();
  }
  WB.shapeDetails(box).forEach((points, i) => {
    for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
      WB.traceSketchyPath(ctx, points, el.seed + (i + 1) * 104729, pass);
      ctx.stroke();
    }
  });
}

function drawInfraShape(ctx, el) {
  const parts = WB.infraParts(normalized(el));
  const body = parts.find((part) => part.closed);
  if (body && el.fillColor !== "transparent") {
    WB.traceSketchyClosed(ctx, body.points, el.seed);
    ctx.fill();
  }
  ctx.lineWidth = el.strokeWidth * 0.75;
  parts.forEach((part, i) => {
    const seed = el.seed + i * 104729;
    for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
      if (part.closed) WB.traceSketchyClosed(ctx, part.points, seed, pass);
      else WB.traceSketchyPath(ctx, part.points, seed, pass);
      ctx.stroke();
    }
  });
}

function drawText(ctx, el) {
  const lineHeight = el.fontSize * WB.LINE_HEIGHT;
  ctx.font = `${el.fontSize}px ${WB.getFontFamily()}`;
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = "top";
  // The editor centers each line inside its line height; the canvas does the same so the text does not jump
  const offset = (lineHeight - el.fontSize) / 2;
  el.text.split("\n").forEach((line, i) => {
    ctx.fillText(line, el.x, el.y + offset + i * lineHeight);
  });
}

function drawSketchyLine(ctx, el) {
  const route = lineRoute(el);
  const strokes = [route];

  // Arrowheads: at the end for every arrow, also at the start for the double arrow
  if (el.type !== "line") {
    strokes.push(...arrowWings(route[route.length - 2], route[route.length - 1]));
  }
  if (el.type === "doubleArrow") {
    strokes.push(...arrowWings(route[1], route[0]));
  }

  ctx.lineWidth = el.strokeWidth * 0.75;
  strokes.forEach((points, i) => {
    for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
      WB.traceSketchyPath(ctx, points, el.seed + i * 104729, pass);
      ctx.stroke();
    }
  });
}

// Points the line goes through. The elbow arrow turns at right angles halfway:
// horizontal-vertical-horizontal, or vertical-horizontal-vertical when it is taller than wide
function lineRoute(el) {
  const [from, to] = absolutePoints(el);
  if (el.type !== "elbowArrow") return [from, to];

  const horizontalFirst = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]);
  const corners = horizontalFirst
    ? [[(from[0] + to[0]) / 2, from[1]], [(from[0] + to[0]) / 2, to[1]]]
    : [[from[0], (from[1] + to[1]) / 2], [to[0], (from[1] + to[1]) / 2]];
  // Skip repeated points (a straight elbow arrow has no real corners)
  return [from, ...corners, to].filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
}

// The two wings of an arrowhead pointing from `from` to `tip`
function arrowWings(from, tip) {
  const length = Math.hypot(tip[0] - from[0], tip[1] - from[1]);
  const head = Math.min(ARROW_HEAD_LENGTH, length / 3);
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  return [-ARROW_HEAD_ANGLE, ARROW_HEAD_ANGLE].map((side) => {
    const a = angle + Math.PI + side;
    return [tip, [tip[0] + head * Math.cos(a), tip[1] + head * Math.sin(a)]];
  });
}

// Line and pencil points are stored relative to (x, y); here they are converted to canvas coordinates
function absolutePoints(el) {
  return el.points.map(([px, py]) => [el.x + px, el.y + py]);
}

// Copy with positive width and height, to draw while dragging in any direction
function normalized(el) {
  return WB.normalizeElement({ ...el });
}
