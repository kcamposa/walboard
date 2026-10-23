// Entry point: sets up the canvas, the toolbar and pointer drawing.
window.WB = window.WB || {};

(function () {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  // Tools drawn by dragging a box
  const BOX_TOOLS = ["rectangle", "ellipse", ...Object.keys(WB.POLYGON_SHAPES), ...Object.keys(WB.EXTRA_SHAPES)];
  const DRAW_TOOLS = [...BOX_TOOLS, ...WB.LINEAR_TYPES];
  // Below this size it counts as a click without dragging and is discarded
  const MIN_SIZE = 3;
  // The pencil only adds a point if the pointer moved at least this far
  const PENCIL_MIN_STEP = 2;
  // With Shift, lines snap to multiples of this angle
  const SNAP_ANGLE = Math.PI / 12;

  const state = {
    tool: "select",
    elements: [],
    drawing: null, // element currently being drawn
  };

  WB.createToolbar(document.getElementById("toolbar"), (tool) => {
    state.tool = tool;
    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
  });

  // For now screen and canvas coordinates match; this will change with zoom (step 7)
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
      // With Shift the aspect ratio is kept: square or circle
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

  // A click without dragging must not leave invisible elements
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

  // Batches several changes into a single render per frame
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

  // Matches the canvas pixel size to the screen (sharp on retina displays)
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  window.addEventListener("resize", resize);
  resize();

  // The canvas does not wait for fonts: it re-renders once they finish loading
  document.fonts.load(`20px ${WB.getFontFamily()}`).then(requestRender);
})();
