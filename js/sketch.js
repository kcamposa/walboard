// Estilo "a mano": genera contornos con pequeñas irregularidades.
// Cada elemento tiene una semilla fija, así su trazo no cambia entre dibujados.
window.WB = window.WB || {};

// Generador pseudoaleatorio con semilla (congruencial lineal): devuelve números entre 0 y 1
WB.createRandom = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const SEGMENT_LENGTH = 24; // distancia entre puntos en los lados rectos
const CORNER_STEPS = 6; // puntos por esquina redondeada
const MAX_CORNER_RADIUS = 32;
const WOBBLE = 2.2; // desvío máximo de las ondulaciones, en píxeles
const WAVE_LENGTH = 90; // distancia aproximada entre ondulaciones
const JITTER = 0.35; // temblor fino, en píxeles
const END_TAPER = 20; // en líneas abiertas, el desvío se reduce cerca de los extremos
WB.SKETCH_PASSES = 2; // cantidad de trazos superpuestos

// Puntos a lo largo del contorno de un rectángulo con esquinas redondeadas (sentido horario)
function roundedRectOutline(x, y, w, h) {
  const r = Math.min(MAX_CORNER_RADIUS, w * 0.25, h * 0.25);
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

// Puntos a lo largo del contorno de una elipse inscrita en el recuadro
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

// Puntos intermedios a lo largo de una línea recta, para poder ondularla
function subdivide([x1, y1], [x2, y2]) {
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / SEGMENT_LENGTH));
  const points = [];
  for (let i = 0; i <= n; i++) {
    points.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  }
  return points;
}

// Desplaza cada punto hacia un lado u otro de la línea: ondulaciones suaves y un temblor fino.
// closed: si el contorno es cerrado (rectángulo, elipse) o abierto (línea)
function wobble(points, random, closed) {
  const count = points.length;
  const at = (i) => (closed ? points[(i + count) % count] : points[Math.min(count - 1, Math.max(0, i))]);

  // Distancia recorrida hasta cada punto, para repartir las ondulaciones a lo largo del trazo
  const dist = [0];
  const segments = closed ? count : count - 1;
  for (let i = 1; i <= segments; i++) {
    const [ax, ay] = at(i - 1);
    const [bx, by] = at(i);
    dist.push(dist[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = dist[segments] || 1;

  // Valores al azar en puntos de control; entre ellos se interpola con una curva suave
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

// Traza una curva cerrada y suave que pasa entre los puntos dados
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

// Traza una curva abierta y suave que empieza en el primer punto y termina en el último
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

// Contorno a mano de un rectángulo o una elipse (el recuadro debe tener ancho y alto positivos).
// pass: número de trazo (0, 1…); cada uno usa otra semilla para que no coincidan
WB.traceSketchyShape = function (ctx, el, pass = 0) {
  const random = WB.createRandom(el.seed + pass * 7919);
  const outline =
    el.type === "ellipse"
      ? ellipseOutline(el.x, el.y, el.width, el.height)
      : roundedRectOutline(el.x, el.y, el.width, el.height);
  traceClosedCurve(ctx, wobble(outline, random, true));
};

// Línea recta a mano entre dos puntos absolutos
WB.traceSketchyLine = function (ctx, from, to, seed, pass = 0) {
  const random = WB.createRandom(seed + pass * 7919);
  WB.traceOpenCurve(ctx, wobble(subdivide(from, to), random, false));
};
