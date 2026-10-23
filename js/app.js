// Punto de entrada: prepara el lienzo, la barra de herramientas y el dibujo con el puntero.
window.WB = window.WB || {};

(function () {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  // Herramientas que se dibujan arrastrando un recuadro
  const BOX_TOOLS = ["rectangle", "ellipse", ...Object.keys(WB.POLYGON_SHAPES), ...Object.keys(WB.EXTRA_SHAPES)];
  const DRAW_TOOLS = [...BOX_TOOLS, ...WB.LINEAR_TYPES];
  // Por debajo de este tamaño se considera un clic sin arrastre y se descarta
  const MIN_SIZE = 3;
  // El lápiz solo agrega un punto si el puntero se movió al menos esta distancia
  const PENCIL_MIN_STEP = 2;
  // Con Shift, las líneas se ajustan a múltiplos de este ángulo
  const SNAP_ANGLE = Math.PI / 12;

  const state = {
    tool: "select",
    elements: [],
    drawing: null, // elemento que se está dibujando en este momento
  };

  WB.createToolbar(document.getElementById("toolbar"), (tool) => {
    state.tool = tool;
    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
  });

  // Por ahora coinciden pantalla y lienzo; con el zoom (paso 7) esto cambiará
  function toScene(e) {
    return { x: e.clientX, y: e.clientY };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !DRAW_TOOLS.includes(state.tool)) return;
    const p = toScene(e);
    state.drawing = WB.createElement(state.tool, p.x, p.y);
    canvas.setPointerCapture(e.pointerId);
    requestRender();
  });

  canvas.addEventListener("pointermove", (e) => {
    const el = state.drawing;
    if (!el) return;
    const p = toScene(e);
    const dx = p.x - el.x;
    const dy = p.y - el.y;

    if (el.type === "pencil") {
      const [lx, ly] = el.points[el.points.length - 1];
      if (Math.hypot(dx - lx, dy - ly) >= PENCIL_MIN_STEP) el.points.push([dx, dy]);
    } else if (el.type === "line" || el.type === "arrow") {
      el.points[1] = e.shiftKey ? snapToAngle(dx, dy) : [dx, dy];
    } else {
      el.width = dx;
      el.height = dy;
      // Con Shift se mantiene la proporción: cuadrado o círculo
      if (e.shiftKey) {
        const size = Math.max(Math.abs(el.width), Math.abs(el.height));
        el.width = Math.sign(el.width || 1) * size;
        el.height = Math.sign(el.height || 1) * size;
      }
    }
    requestRender();
  });

  function snapToAngle(dx, dy) {
    const length = Math.hypot(dx, dy);
    const angle = Math.round(Math.atan2(dy, dx) / SNAP_ANGLE) * SNAP_ANGLE;
    return [length * Math.cos(angle), length * Math.sin(angle)];
  }

  // Un clic sin arrastre no debe dejar elementos invisibles
  function isTooSmall(el) {
    if (el.type === "pencil") return el.points.length < 2;
    if (el.type === "line" || el.type === "arrow") return Math.hypot(...el.points[1]) < MIN_SIZE;
    return el.width < MIN_SIZE && el.height < MIN_SIZE;
  }

  function finishDrawing() {
    const el = state.drawing;
    if (!el) return;
    state.drawing = null;
    if (BOX_TOOLS.includes(el.type)) WB.normalizeElement(el);
    if (!isTooSmall(el)) state.elements.push(el);
    requestRender();
  }

  canvas.addEventListener("pointerup", finishDrawing);
  canvas.addEventListener("pointercancel", finishDrawing);

  // Agrupa varios cambios en un solo dibujado por cuadro
  let renderQueued = false;
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    const visible = state.drawing ? [...state.elements, state.drawing] : state.elements;
    WB.renderScene(ctx, window.innerWidth, window.innerHeight, visible);
  }

  // Ajusta el tamaño real del canvas a la pantalla (nítido en pantallas retina)
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  window.addEventListener("resize", resize);
  resize();

  // El canvas no espera a las fuentes: se vuelve a dibujar cuando terminan de cargar
  document.fonts.load(`20px ${WB.getFontFamily()}`).then(requestRender);
})();
