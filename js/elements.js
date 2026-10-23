// Modelo de elementos: cada figura del lienzo es un objeto plano con estas propiedades.
window.WB = window.WB || {};

WB.DEFAULT_STYLE = {
  strokeColor: "#1f1f1f",
  fillColor: "transparent",
  strokeWidth: 2,
};

// Fuente de los textos del lienzo: se toma de la variable CSS --font-hand
WB.getFontFamily = function () {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim();
};

let nextId = 1;

// Tipos que se dibujan con una lista de puntos en lugar de un recuadro
WB.LINEAR_TYPES = ["line", "arrow", "pencil"];

WB.createElement = function (type, x, y) {
  const el = {
    id: `el-${Date.now()}-${nextId++}`,
    type,
    x,
    y,
    width: 0,
    height: 0,
    seed: Math.floor(Math.random() * 2 ** 31), // fija la forma del trazo a mano
    ...WB.DEFAULT_STYLE,
  };
  const extra = WB.EXTRA_SHAPES[type];
  if (extra && extra.fillColor) el.fillColor = extra.fillColor;
  if (WB.LINEAR_TYPES.includes(type)) {
    // Puntos relativos a (x, y). Línea y flecha: inicio y fin. Lápiz: todo el recorrido.
    el.points = type === "pencil" ? [[0, 0]] : [[0, 0], [0, 0]];
  }
  return el;
};

// Convierte ancho/alto negativos (arrastre hacia arriba o la izquierda) en positivos
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
