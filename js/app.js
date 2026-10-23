// Punto de entrada: prepara el lienzo, la barra de herramientas y el dibujo con el puntero.
window.WB = window.WB || {};

(function () {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  // Herramientas que se dibujan arrastrando un recuadro
  const BOX_TOOLS = ["rectangle"];
  // Por debajo de este tamaño se considera un clic sin arrastre y se descarta
  const MIN_SIZE = 3;

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
    if (e.button !== 0 || !BOX_TOOLS.includes(state.tool)) return;
    const p = toScene(e);
    state.drawing = WB.createElement(state.tool, p.x, p.y);
    canvas.setPointerCapture(e.pointerId);
    requestRender();
  });

  canvas.addEventListener("pointermove", (e) => {
    const el = state.drawing;
    if (!el) return;
    const p = toScene(e);
    el.width = p.x - el.x;
    el.height = p.y - el.y;

    // Con Shift se mantiene la proporción cuadrada
    if (e.shiftKey) {
      const size = Math.max(Math.abs(el.width), Math.abs(el.height));
      el.width = Math.sign(el.width || 1) * size;
      el.height = Math.sign(el.height || 1) * size;
    }
    requestRender();
  });

  function finishDrawing() {
    const el = state.drawing;
    if (!el) return;
    state.drawing = null;
    WB.normalizeElement(el);
    if (el.width >= MIN_SIZE || el.height >= MIN_SIZE) {
      state.elements.push(el);
    }
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
})();
