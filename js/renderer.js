// Draws the background and all elements on the canvas.
window.WB = window.WB || {};

const ARROW_HEAD_LENGTH = 18;
const ARROW_HEAD_ANGLE = Math.PI / 7;

const GRID_GAP = 20; // distance between grid dots, in scene units
const MIN_GRID_GAP_ON_SCREEN = 12; // when zoomed out, skip dots so the grid does not get too dense

// screen: { width, height, dpr } of the canvas in CSS pixels.
// overlay (optional): { selection: elements, marquee: box being dragged to select }
WB.renderScene = function (ctx, screen, elements, overlay = {}) {
  const styles = getComputedStyle(document.documentElement);
  const { x: viewX, y: viewY, zoom } = WB.view;

  // Background in screen coordinates
  ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
  ctx.fillStyle = styles.getPropertyValue("--bg");
  ctx.fillRect(0, 0, screen.width, screen.height);

  // Everything else in scene coordinates, moved and scaled by the camera
  const scale = screen.dpr * zoom;
  ctx.setTransform(scale, 0, 0, scale, -viewX * scale, -viewY * scale);

  drawGrid(ctx, screen, styles.getPropertyValue("--grid-dot"));
  elements.forEach((el) => drawElement(ctx, el));

  const accent = styles.getPropertyValue("--accent");
  if (overlay.selection && overlay.selection.length) drawSelection(ctx, overlay.selection, accent);
  if (overlay.marquee) drawMarquee(ctx, overlay.marquee, accent);
};

const EXPORT_PADDING = 24; // margin around the drawing in exported images
const EXPORT_SCALE = 2; // exported images have twice the resolution, so they stay sharp

// Draws the elements on a new canvas sized to fit them, with a white background and no grid
WB.renderToImage = function (elements) {
  const b = WB.getCommonBounds(elements);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((b.width + EXPORT_PADDING * 2) * EXPORT_SCALE);
  canvas.height = Math.ceil((b.height + EXPORT_PADDING * 2) * EXPORT_SCALE);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const offsetX = (EXPORT_PADDING - b.x) * EXPORT_SCALE;
  const offsetY = (EXPORT_PADDING - b.y) * EXPORT_SCALE;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, offsetX, offsetY);
  elements.forEach((el) => drawElement(ctx, el));
  return canvas;
};

// Dot grid as a visual guide, only over the visible part of the scene
function drawGrid(ctx, screen, color) {
  const { x: viewX, y: viewY, zoom } = WB.view;
  let gap = GRID_GAP;
  while (gap * zoom < MIN_GRID_GAP_ON_SCREEN) gap *= 2;
  const dot = 1.5 / zoom;
  const right = viewX + screen.width / zoom;
  const bottom = viewY + screen.height / zoom;

  ctx.fillStyle = color;
  for (let x = Math.ceil(viewX / gap) * gap; x < right; x += gap) {
    for (let y = Math.ceil(viewY / gap) * gap; y < bottom; y += gap) {
      ctx.fillRect(x, y, dot, dot);
    }
  }
}

// Dashed frame around the selected elements, with a resize handle at each corner.
// Line widths and handle sizes are divided by the zoom so they keep the same size on screen
function drawSelection(ctx, selection, accent) {
  const zoom = WB.view.zoom;
  const frame = WB.selectionFrame(WB.getCommonBounds(selection));
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  const size = WB.HANDLE_SIZE / zoom;
  Object.values(WB.handlePositions(frame)).forEach(([hx, hy]) => {
    ctx.fillRect(hx - size / 2, hy - size / 2, size, size);
    ctx.strokeRect(hx - size / 2, hy - size / 2, size, size);
  });
  ctx.restore();
}

// Translucent box drawn while dragging to select several elements
function drawMarquee(ctx, box, accent) {
  const b = WB.normalizeElement({ ...box });
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(b.x, b.y, b.width, b.height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1 / WB.view.zoom;
  ctx.strokeRect(b.x, b.y, b.width, b.height);
  ctx.restore();
}

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
        WB.traceSketchyPath(ctx, WB.absolutePoints(el), el.seed, pass);
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
  const route = WB.lineRoute(el);
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

// Copy with positive width and height, to draw while dragging in any direction
function normalized(el) {
  return WB.normalizeElement({ ...el });
}
