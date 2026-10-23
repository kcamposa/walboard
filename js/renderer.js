// Dibuja el fondo y todos los elementos en el canvas.
window.WB = window.WB || {};

const ARROW_HEAD_LENGTH = 18;
const ARROW_HEAD_ANGLE = Math.PI / 7;

WB.renderScene = function (ctx, width, height, elements) {
  const styles = getComputedStyle(document.documentElement);

  ctx.fillStyle = styles.getPropertyValue("--bg");
  ctx.fillRect(0, 0, width, height);

  // Cuadrícula de puntos como guía visual
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
    case "rectangle":
    case "ellipse":
      drawSketchyShape(ctx, el);
      break;
    case "line":
    case "arrow":
      drawSketchyLine(ctx, el);
      break;
    case "pencil":
      WB.traceOpenCurve(ctx, absolutePoints(el));
      ctx.stroke();
      break;
  }

  ctx.restore();
}

function drawSketchyShape(ctx, el) {
  const box = normalized(el);
  if (el.fillColor !== "transparent") {
    WB.traceSketchyShape(ctx, box);
    ctx.fill();
  }
  // Trazos superpuestos y algo más finos: juntos dan el grosor desparejo de una línea a mano
  ctx.lineWidth = el.strokeWidth * 0.75;
  for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
    WB.traceSketchyShape(ctx, box, pass);
    ctx.stroke();
  }
}

function drawSketchyLine(ctx, el) {
  const [from, to] = absolutePoints(el);
  const strokes = [[from, to]];

  if (el.type === "arrow") {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const head = Math.min(ARROW_HEAD_LENGTH, length / 3);
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    [-ARROW_HEAD_ANGLE, ARROW_HEAD_ANGLE].forEach((side) => {
      const a = angle + Math.PI + side;
      strokes.push([to, [to[0] + head * Math.cos(a), to[1] + head * Math.sin(a)]]);
    });
  }

  ctx.lineWidth = el.strokeWidth * 0.75;
  strokes.forEach(([a, b], i) => {
    for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
      WB.traceSketchyLine(ctx, a, b, el.seed + i * 104729, pass);
      ctx.stroke();
    }
  });
}

// Los puntos de líneas y lápiz se guardan relativos a (x, y); acá se pasan a coordenadas del lienzo
function absolutePoints(el) {
  return el.points.map(([px, py]) => [el.x + px, el.y + py]);
}

// Copia con ancho y alto positivos, para dibujar mientras se arrastra en cualquier dirección
function normalized(el) {
  return WB.normalizeElement({ ...el });
}
