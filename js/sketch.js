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

// Desplaza cada punto hacia afuera o hacia adentro del contorno: ondulaciones suaves y un temblor fino
function wobble(points, random) {
  const count = points.length;

  // Distancia recorrida hasta cada punto, para repartir las ondulaciones a lo largo del contorno
  const dist = [0];
  for (let i = 1; i <= count; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i % count];
    dist.push(dist[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = dist[count] || 1;

  // Valores al azar en puntos de control; entre ellos se interpola con una curva suave
  const knots = Math.max(4, Math.round(total / WAVE_LENGTH));
  const amplitude = Math.min(WOBBLE, total / 80);
  const knotValues = Array.from({ length: knots }, () => (random() * 2 - 1) * amplitude);
  function waveAt(d) {
    const t = (d / total) * knots;
    const i = Math.floor(t) % knots;
    const blend = (1 - Math.cos((t - Math.floor(t)) * Math.PI)) / 2;
    return knotValues[i] * (1 - blend) + knotValues[(i + 1) % knots] * blend;
  }

  const offsets = points.map((_, i) => waveAt(dist[i]) + (random() * 2 - 1) * JITTER);

  return points.map(([px, py], i) => {
    const [ax, ay] = points[(i - 1 + count) % count];
    const [bx, by] = points[(i + 1) % count];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    return [px + nx * offsets[i], py + ny * offsets[i]];
  });
}

// Traza una curva cerrada y suave que pasa entre los puntos dados
function traceClosedCurve(ctx, points) {
  const count = points.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[count - 1], points[0]);

  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < count; i++) {
    const next = mid(points[i], points[(i + 1) % count]);
    ctx.quadraticCurveTo(points[i][0], points[i][1], next[0], next[1]);
  }
  ctx.closePath();
}

// pass: número de trazo (0, 1…); cada uno usa otra semilla para que no coincidan
WB.traceSketchyRect = function (ctx, el, pass = 0) {
  const random = WB.createRandom(el.seed + pass * 7919);
  traceClosedCurve(ctx, wobble(roundedRectOutline(el.x, el.y, el.width, el.height), random));
};
