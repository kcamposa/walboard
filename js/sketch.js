// Hand-drawn style: builds outlines with small irregularities.
// Each element has a fixed seed, so its stroke does not change between renders.
window.WB = window.WB || {};

// Seeded pseudo-random generator (linear congruential): returns numbers between 0 and 1
WB.createRandom = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const SEGMENT_LENGTH = 24; // distance between points on straight sides
const CORNER_STEPS = 6; // points per rounded corner
const MAX_CORNER_RADIUS = 32;
const MAX_POLYGON_RADIUS = 10;
const INFRA_CORNER_RADIUS = 8;
const WOBBLE = 2.2; // maximum wave offset, in pixels
const WAVE_LENGTH = 90; // approximate distance between waves
const JITTER = 0.35; // fine jitter, in pixels
const END_TAPER = 20; // on open lines, the offset fades out near the ends
WB.SKETCH_PASSES = 2; // number of overlapping strokes

// Points along the outline of a rectangle with rounded corners (clockwise)
// maxRadius / ratio: corner radius limits (absolute and relative to the shorter side)
function roundedRectOutline(x, y, w, h, maxRadius = MAX_CORNER_RADIUS, ratio = 0.25) {
  const r = Math.min(maxRadius, w * ratio, h * ratio);
  const points = [];

  function edge(x1, y1, x2, y2) {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / SEGMENT_LENGTH));
    for (let i = 0; i < n; i++) {
      points.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
    }
  }

  function corner(cx, cy, startAngle) {
    for (let i = 0; i < CORNER_STEPS; i++) {
      const a = startAngle + (Math.PI / 2) * (i / CORNER_STEPS);
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }

  edge(x + r, y, x + w - r, y);
  corner(x + w - r, y + r, -Math.PI / 2);
  edge(x + w, y + r, x + w, y + h - r);
  corner(x + w - r, y + h - r, 0);
  edge(x + w - r, y + h, x + r, y + h);
  corner(x + r, y + h - r, Math.PI / 2);
  edge(x, y + h - r, x, y + r);
  corner(x + r, y + r, Math.PI);

  return points;
}

// Points along the outline of a polygon (vertices from 0 to 1), with slightly rounded tips
function polygonOutline(x, y, w, h, vertices) {
  const corners = vertices.map(([vx, vy]) => [x + vx * w, y + vy * h]);
  const count = corners.length;
  const points = [];

  for (let i = 0; i < count; i++) {
    const prev = corners[(i - 1 + count) % count];
    const curr = corners[i];
    const next = corners[(i + 1) % count];
    const lenIn = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]) || 1;
    const lenOut = Math.hypot(next[0] - curr[0], next[1] - curr[1]) || 1;
    const r = Math.min(MAX_POLYGON_RADIUS, lenIn * 0.2, lenOut * 0.2);

    // Tip: curve from just before the vertex to just after it
    const from = [curr[0] - ((curr[0] - prev[0]) / lenIn) * r, curr[1] - ((curr[1] - prev[1]) / lenIn) * r];
    const to = [curr[0] + ((next[0] - curr[0]) / lenOut) * r, curr[1] + ((next[1] - curr[1]) / lenOut) * r];
    for (let s = 0; s < CORNER_STEPS; s++) {
      const t = s / CORNER_STEPS;
      const u = 1 - t;
      points.push([
        u * u * from[0] + 2 * u * t * curr[0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * curr[1] + t * t * to[1],
      ]);
    }

    // Straight side up to the next tip
    const sideEnd = [next[0] - ((next[0] - curr[0]) / lenOut) * r, next[1] - ((next[1] - curr[1]) / lenOut) * r];
    const n = Math.max(1, Math.round(Math.hypot(sideEnd[0] - to[0], sideEnd[1] - to[1]) / SEGMENT_LENGTH));
    for (let s = 0; s < n; s++) {
      points.push([to[0] + ((sideEnd[0] - to[0]) * s) / n, to[1] + ((sideEnd[1] - to[1]) * s) / n]);
    }
  }
  return points;
}

// Points along the outline of an ellipse inscribed in the box
function ellipseOutline(x, y, w, h) {
  const rx = w / 2;
  const ry = h / 2;
  const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const n = Math.max(16, Math.round(perimeter / (SEGMENT_LENGTH * 0.75)));
  const points = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    points.push([x + rx + rx * Math.cos(a), y + ry + ry * Math.sin(a)]);
  }
  return points;
}

// Intermediate points along a straight line, so it can be made wavy
function subdivide([x1, y1], [x2, y2]) {
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / SEGMENT_LENGTH));
  const points = [];
  for (let i = 0; i <= n; i++) {
    points.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  }
  return points;
}

// Shifts each point to one side of the line or the other: smooth waves plus fine jitter.
// closed: whether the outline is closed (rectangle, ellipse) or open (line)
function wobble(points, random, closed) {
  const count = points.length;
  const at = (i) => (closed ? points[(i + count) % count] : points[Math.min(count - 1, Math.max(0, i))]);

  // Distance travelled up to each point, to spread the waves along the stroke
  const dist = [0];
  const segments = closed ? count : count - 1;
  for (let i = 1; i <= segments; i++) {
    const [ax, ay] = at(i - 1);
    const [bx, by] = at(i);
    dist.push(dist[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = dist[segments] || 1;

  // Random values at control points; a smooth curve interpolates between them
  const knots = Math.max(closed ? 4 : 1, Math.round(total / WAVE_LENGTH));
  const amplitude = Math.min(WOBBLE, total / 80);
  const knotValues = Array.from({ length: closed ? knots : knots + 1 }, () => (random() * 2 - 1) * amplitude);
  function waveAt(d) {
    const t = (d / total) * knots;
    const i = Math.min(Math.floor(t), knots - 1);
    const blend = (1 - Math.cos((t - i) * Math.PI)) / 2;
    return knotValues[i % knotValues.length] * (1 - blend) + knotValues[(i + 1) % knotValues.length] * blend;
  }

  return points.map(([px, py], i) => {
    let offset = waveAt(dist[i]) + (random() * 2 - 1) * JITTER;
    if (!closed) offset *= Math.min(1, dist[i] / END_TAPER, (total - dist[i]) / END_TAPER);

    const [ax, ay] = at(i - 1);
    const [bx, by] = at(i + 1);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    return [px + nx * offset, py + ny * offset];
  });
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// Traces a smooth closed curve through the given points
function traceClosedCurve(ctx, points) {
  const count = points.length;
  const start = mid(points[count - 1], points[0]);

  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < count; i++) {
    const next = mid(points[i], points[(i + 1) % count]);
    ctx.quadraticCurveTo(points[i][0], points[i][1], next[0], next[1]);
  }
  ctx.closePath();
}

// Traces a smooth open curve from the first point to the last one
WB.traceOpenCurve = function (ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length - 1; i++) {
    const next = mid(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i][0], points[i][1], next[0], next[1]);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
};

// Points of an elliptical arc between two angles (both ends included)
function arcPoints(cx, cy, rx, ry, fromAngle, toAngle) {
  const length = Math.abs(toAngle - fromAngle) * Math.max(rx, ry);
  const n = Math.max(6, Math.round(length / (SEGMENT_LENGTH * 0.6)));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const a = fromAngle + ((toAngle - fromAngle) * i) / n;
    points.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return points;
}

// Height of the cylinder caps
function cylinderCapHeight(w, h) {
  return Math.min(h * 0.15, w * 0.25);
}

// Cylinder: top cap (back half), right side, bottom and left side
function cylinderOutline(x, y, w, h) {
  const ry = cylinderCapHeight(w, h);
  const cx = x + w / 2;
  const top = arcPoints(cx, y + ry, w / 2, ry, Math.PI, Math.PI * 2);
  const right = subdivide([x + w, y + ry], [x + w, y + h - ry]).slice(1, -1);
  const bottom = arcPoints(cx, y + h - ry, w / 2, ry, 0, Math.PI);
  const left = subdivide([x, y + h - ry], [x, y + ry]).slice(1, -1);
  return [...top, ...right, ...bottom, ...left];
}

// Cloud: an ellipse with outward bumps
function cloudOutline(x, y, w, h) {
  const bumps = 7;
  const depth = 0.18; // how pronounced the bumps are
  const n = bumps * 10;
  const points = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const scale = 1 - depth + depth * Math.abs(Math.sin((a * bumps) / 2));
    points.push([x + w / 2 + (w / 2) * scale * Math.cos(a), y + h / 2 + (h / 2) * scale * Math.sin(a)]);
  }
  return points;
}

// Speech bubble: rounded rectangle with a tail at the bottom left
function speechBubbleOutline(x, y, w, h) {
  const bodyH = h * 0.78;
  const r = Math.min(MAX_CORNER_RADIUS, w * 0.2, bodyH * 0.25);
  const bottom = y + bodyH;
  const tail = [
    ...subdivide([x + w * 0.42, bottom], [x + w * 0.16, y + h]).slice(1),
    ...subdivide([x + w * 0.16, y + h], [x + w * 0.24, bottom]).slice(1, -1),
  ];
  return [
    ...subdivide([x + r, y], [x + w - r, y]).slice(0, -1),
    ...arcPoints(x + w - r, y + r, r, r, -Math.PI / 2, 0).slice(0, -1),
    ...subdivide([x + w, y + r], [x + w, bottom - r]).slice(0, -1),
    ...arcPoints(x + w - r, bottom - r, r, r, 0, Math.PI / 2).slice(0, -1),
    ...subdivide([x + w - r, bottom], [x + w * 0.42, bottom]).slice(0, -1),
    ...tail,
    ...subdivide([x + w * 0.24, bottom], [x + r, bottom]).slice(0, -1),
    ...arcPoints(x + r, bottom - r, r, r, Math.PI / 2, Math.PI).slice(0, -1),
    ...subdivide([x, bottom - r], [x, y + r]).slice(0, -1),
    ...arcPoints(x + r, y + r, r, r, Math.PI, Math.PI * 1.5).slice(0, -1),
  ];
}

// Sticky note: square with the bottom-right corner folded
const STICKY_FOLD = 0.2;
const STICKY_VERTICES = [[0, 0], [1, 0], [1, 1 - STICKY_FOLD], [1 - STICKY_FOLD, 1], [0, 1]];

function shapeOutline(el) {
  const { x, y, width: w, height: h } = el;
  switch (el.type) {
    case "ellipse":
      return ellipseOutline(x, y, w, h);
    case "cylinder":
      return cylinderOutline(x, y, w, h);
    case "cloud":
      return cloudOutline(x, y, w, h);
    case "speechBubble":
      return speechBubbleOutline(x, y, w, h);
    case "stickyNote":
      return polygonOutline(x, y, w, h, STICKY_VERTICES);
  }
  const polygon = WB.POLYGON_SHAPES[el.type];
  if (polygon) return polygonOutline(x, y, w, h, polygon.vertices);
  return roundedRectOutline(x, y, w, h);
}

// Inner lines that complete some shapes (not part of the outline)
WB.shapeDetails = function (el) {
  const { x, y, width: w, height: h } = el;
  if (el.type === "cylinder") {
    // Front half of the top cap
    const ry = cylinderCapHeight(w, h);
    return [arcPoints(x + w / 2, y + ry, w / 2, ry, 0, Math.PI)];
  }
  if (el.type === "stickyNote") {
    // Crease of the folded corner
    const fx = x + w * (1 - STICKY_FOLD);
    const fy = y + h * (1 - STICKY_FOLD);
    return [[[x + w, fy], [fx, fy], [fx, y + h]]];
  }
  return [];
};

// Converts the parts of an infrastructure shape (box from 0 to 1) into absolute point lists.
// Returns [{ closed, points }]
WB.infraParts = function (el) {
  const { x, y, width: w, height: h } = el;
  const px = (ux) => x + ux * w;
  const py = (uy) => y + uy * h;
  const toAbs = (list) => list.map(([ux, uy]) => [px(ux), py(uy)]);

  return WB.INFRA_SHAPES[el.type].parts.map((part) => {
    if (part.rect) {
      const [rx, ry, rw, rh] = part.rect;
      return { closed: true, points: roundedRectOutline(px(rx), py(ry), rw * w, rh * h, INFRA_CORNER_RADIUS, 0.12) };
    }
    if (part.ellipse) {
      const [cx, cy, rx, ry] = part.ellipse;
      return { closed: true, points: ellipseOutline(px(cx - rx), py(cy - ry), rx * 2 * w, ry * 2 * h) };
    }
    if (part.poly) return { closed: true, points: polygonOutline(x, y, w, h, part.poly) };
    if (part.arc) {
      const [cx, cy, rx, ry, from, to] = part.arc;
      return { closed: false, points: arcPoints(px(cx), py(cy), rx * w, ry * h, from, to) };
    }
    return { closed: false, points: toAbs(part.path) };
  });
};

// Hand-drawn closed outline through absolute points
WB.traceSketchyClosed = function (ctx, points, seed, pass = 0) {
  const random = WB.createRandom(seed + pass * 7919);
  traceClosedCurve(ctx, wobble(points, random, true));
};

// Hand-drawn outline of a box shape (the box must have positive width and height).
// pass: stroke number (0, 1…); each one uses another seed so they do not overlap exactly
WB.traceSketchyShape = function (ctx, el, pass = 0) {
  const random = WB.createRandom(el.seed + pass * 7919);
  traceClosedCurve(ctx, wobble(shapeOutline(el), random, true));
};

// Hand-drawn straight line between two absolute points
WB.traceSketchyLine = function (ctx, from, to, seed, pass = 0) {
  const random = WB.createRandom(seed + pass * 7919);
  WB.traceOpenCurve(ctx, wobble(subdivide(from, to), random, false));
};

// Hand-drawn open path through several points (straight segments are subdivided so they can be wavy)
WB.traceSketchyPath = function (ctx, points, seed, pass = 0) {
  const random = WB.createRandom(seed + pass * 7919);
  const dense = [points[0]];
  for (let i = 1; i < points.length; i++) dense.push(...subdivide(points[i - 1], points[i]).slice(1));
  WB.traceOpenCurve(ctx, wobble(dense, random, false));
};
