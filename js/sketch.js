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
const MAX_POLYGON_RADIUS = 10;
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

// Puntos a lo largo del contorno de un polígono (vértices de 0 a 1), con las puntas levemente redondeadas
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

    // Punta: curva desde un poco antes del vértice hasta un poco después
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

    // Lado recto hasta la próxima punta
    const sideEnd = [next[0] - ((next[0] - curr[0]) / lenOut) * r, next[1] - ((next[1] - curr[1]) / lenOut) * r];
    const n = Math.max(1, Math.round(Math.hypot(sideEnd[0] - to[0], sideEnd[1] - to[1]) / SEGMENT_LENGTH));
    for (let s = 0; s < n; s++) {
      points.push([to[0] + ((sideEnd[0] - to[0]) * s) / n, to[1] + ((sideEnd[1] - to[1]) * s) / n]);
    }
  }
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

// Puntos de un arco de elipse entre dos ángulos (incluye ambos extremos)
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

// Alto de las tapas del cilindro
function cylinderCapHeight(w, h) {
  return Math.min(h * 0.15, w * 0.25);
}

// Cilindro: tapa superior (mitad de atrás), lado derecho, base y lado izquierdo
function cylinderOutline(x, y, w, h) {
  const ry = cylinderCapHeight(w, h);
  const cx = x + w / 2;
  const top = arcPoints(cx, y + ry, w / 2, ry, Math.PI, Math.PI * 2);
  const right = subdivide([x + w, y + ry], [x + w, y + h - ry]).slice(1, -1);
  const bottom = arcPoints(cx, y + h - ry, w / 2, ry, 0, Math.PI);
  const left = subdivide([x, y + h - ry], [x, y + ry]).slice(1, -1);
  return [...top, ...right, ...bottom, ...left];
}

// Nube: una elipse con bultos hacia afuera
function cloudOutline(x, y, w, h) {
  const bumps = 7;
  const depth = 0.18; // qué tan marcados son los bultos
  const n = bumps * 10;
  const points = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const scale = 1 - depth + depth * Math.abs(Math.sin((a * bumps) / 2));
    points.push([x + w / 2 + (w / 2) * scale * Math.cos(a), y + h / 2 + (h / 2) * scale * Math.sin(a)]);
  }
  return points;
}

// Globo de diálogo: rectángulo redondeado con una cola abajo a la izquierda
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

// Nota adhesiva: cuadrado con la esquina inferior derecha doblada
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

// Líneas interiores que completan algunas formas (no forman parte del contorno)
WB.shapeDetails = function (el) {
  const { x, y, width: w, height: h } = el;
  if (el.type === "cylinder") {
    // Mitad de adelante de la tapa superior
    const ry = cylinderCapHeight(w, h);
    return [arcPoints(x + w / 2, y + ry, w / 2, ry, 0, Math.PI)];
  }
  if (el.type === "stickyNote") {
    // Pliegue de la esquina doblada
    const fx = x + w * (1 - STICKY_FOLD);
    const fy = y + h * (1 - STICKY_FOLD);
    return [[[x + w, fy], [fx, fy], [fx, y + h]]];
  }
  return [];
};

// Contorno a mano de una forma de recuadro (el recuadro debe tener ancho y alto positivos).
// pass: número de trazo (0, 1…); cada uno usa otra semilla para que no coincidan
WB.traceSketchyShape = function (ctx, el, pass = 0) {
  const random = WB.createRandom(el.seed + pass * 7919);
  traceClosedCurve(ctx, wobble(shapeOutline(el), random, true));
};

// Línea recta a mano entre dos puntos absolutos
WB.traceSketchyLine = function (ctx, from, to, seed, pass = 0) {
  const random = WB.createRandom(seed + pass * 7919);
  WB.traceOpenCurve(ctx, wobble(subdivide(from, to), random, false));
};

// Recorrido abierto a mano por varios puntos (los tramos rectos se subdividen para poder ondularlos)
WB.traceSketchyPath = function (ctx, points, seed, pass = 0) {
  const random = WB.createRandom(seed + pass * 7919);
  const dense = [points[0]];
  for (let i = 1; i < points.length; i++) dense.push(...subdivide(points[i - 1], points[i]).slice(1));
  WB.traceOpenCurve(ctx, wobble(dense, random, false));
};
