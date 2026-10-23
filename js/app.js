// Entry point: sets up the canvas, the toolbar, pointer drawing and selection.
window.WB = window.WB || {};

(function () {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const deleteButton = document.getElementById("delete-selection");

  // Tools drawn by dragging a box
  const BOX_TOOLS = [
    "rectangle",
    "ellipse",
    ...Object.keys(WB.POLYGON_SHAPES),
    ...Object.keys(WB.EXTRA_SHAPES),
    ...Object.keys(WB.INFRA_SHAPES),
  ];
  const DRAW_TOOLS = [...BOX_TOOLS, ...WB.LINEAR_TYPES];
  // Below this size it counts as a click without dragging and is discarded
  const MIN_SIZE = 3;
  // The pencil only adds a point if the pointer moved at least this far
  const PENCIL_MIN_STEP = 2;
  // With Shift, lines snap to multiples of this angle
  const SNAP_ANGLE = Math.PI / 12;
  const HANDLE_CURSORS = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize" };

  const state = {
    tool: "select",
    elements: [],
    drawing: null, // element currently being drawn
    textEditor: null, // open text editor, if any
    editingId: null, // text element hidden while its editor is open
    selectedIds: new Set(),
    drag: null, // current select-tool drag: { mode: "move" | "resize" | "marquee", ... }
    pan: null, // last pointer position while moving the canvas
  };
  let renderQueued = false; // declared before the toolbar, which triggers a render when created

  // Restore the drawing kept by the automatic save, if any
  const autosaved = WB.loadAutosave();
  if (autosaved) {
    state.elements = autosaved.elements;
    if (autosaved.view) Object.assign(WB.view, autosaved.view);
  }

  const history = WB.createHistory(state.elements);
  const undoButton = document.getElementById("undo");
  const redoButton = document.getElementById("redo");

  // Call after every finished change, so it can be undone
  function recordHistory() {
    history.record(state.elements);
    updateHistoryButtons();
    WB.autosave(state.elements, WB.view);
  }

  function updateHistoryButtons() {
    undoButton.disabled = !history.canUndo();
    redoButton.disabled = !history.canRedo();
  }

  function restore(elements) {
    state.elements = elements;
    // Keep only the selected elements that still exist
    state.selectedIds = new Set(elements.filter((el) => state.selectedIds.has(el.id)).map((el) => el.id));
    updateHistoryButtons();
    WB.autosave(state.elements, WB.view);
    requestRender();
  }

  undoButton.addEventListener("click", () => restore(history.undo()));
  redoButton.addEventListener("click", () => restore(history.redo()));

  WB.createToolbar(document.getElementById("toolbar"), (tool) => {
    state.tool = tool;
    canvas.style.cursor = toolCursor();
    if (tool !== "select") state.selectedIds.clear();
    requestRender();
  });

  function toolCursor() {
    return { select: "default", hand: "grab" }[state.tool] || "crosshair";
  }

  // Converts a pointer event position (screen) into scene coordinates
  function toScene(e) {
    return { x: e.clientX / WB.view.zoom + WB.view.x, y: e.clientY / WB.view.zoom + WB.view.y };
  }

  function toScreen(x, y) {
    return { x: (x - WB.view.x) * WB.view.zoom, y: (y - WB.view.y) * WB.view.zoom };
  }

  // ---- Camera: panning and zooming ----

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 1.2; // factor of the zoom buttons
  const zoomLabel = document.getElementById("zoom-reset");

  // A text being edited is closed before the view changes, so it does not stay in the wrong place
  function beforeViewChange() {
    if (state.textEditor) state.textEditor.commit();
  }

  function panBy(dxScreen, dyScreen) {
    beforeViewChange();
    WB.view.x += dxScreen / WB.view.zoom;
    WB.view.y += dyScreen / WB.view.zoom;
    requestRender();
  }

  // Changes the zoom keeping the scene point under (screenX, screenY) in the same place
  function zoomTo(zoom, screenX, screenY) {
    beforeViewChange();
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    const sceneX = screenX / WB.view.zoom + WB.view.x;
    const sceneY = screenY / WB.view.zoom + WB.view.y;
    WB.view.zoom = newZoom;
    WB.view.x = sceneX - screenX / newZoom;
    WB.view.y = sceneY - screenY / newZoom;
    updateZoomLabel();
    requestRender();
  }

  function updateZoomLabel() {
    zoomLabel.textContent = `${Math.round(WB.view.zoom * 100)}%`;
  }

  // Mouse wheel / two fingers on the trackpad move the canvas; pinching on the trackpad zooms
  // (browsers report the pinch as a wheel event with ctrlKey set)
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.ctrlKey) zoomTo(WB.view.zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      else panBy(e.deltaX, e.deltaY);
    },
    { passive: false },
  );

  const centerX = () => window.innerWidth / 2;
  const centerY = () => window.innerHeight / 2;
  document.getElementById("zoom-in").addEventListener("click", () => zoomTo(WB.view.zoom * ZOOM_STEP, centerX(), centerY()));
  document.getElementById("zoom-out").addEventListener("click", () => zoomTo(WB.view.zoom / ZOOM_STEP, centerX(), centerY()));
  zoomLabel.addEventListener("click", () => zoomTo(1, centerX(), centerY()));

  function selectedElements() {
    return state.elements.filter((el) => state.selectedIds.has(el.id));
  }

  // Deep copies of the elements, keyed by id, to compute moves and resizes from the starting state
  function snapshot(elements) {
    return new Map(elements.map((el) => [el.id, JSON.parse(JSON.stringify(el))]));
  }

  canvas.addEventListener("pointerdown", (e) => {
    // Hand tool, or dragging with the middle mouse button, moves the canvas
    if (e.button === 1 || (e.button === 0 && state.tool === "hand")) {
      e.preventDefault();
      state.pan = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = toScene(e);
    if (state.tool === "text") {
      startText(p);
      return;
    }
    if (state.tool === "select") {
      startSelectDrag(e, p);
    } else if (DRAW_TOOLS.includes(state.tool)) {
      state.drawing = WB.createElement(state.tool, p.x, p.y);
    } else {
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    requestRender();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (state.pan) {
      panBy(state.pan.x - e.clientX, state.pan.y - e.clientY);
      state.pan = { x: e.clientX, y: e.clientY };
      return;
    }
    const p = toScene(e);
    if (state.drawing) updateDrawing(e, p);
    else if (state.drag) updateSelectDrag(e, p);
    else if (state.tool === "select") updateCursor(p);
  });

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);

  function finishPointer() {
    if (state.pan) {
      state.pan = null;
      canvas.style.cursor = toolCursor();
    }
    if (state.drawing) finishDrawing();
    if (state.drag) {
      state.drag = null;
      recordHistory();
      requestRender();
    }
  }

  // Double click on a text edits it
  canvas.addEventListener("dblclick", (e) => {
    const hit = WB.elementAt(state.elements, toScene(e));
    if (hit && hit.type === "text") editText(hit);
  });

  // ---- Drawing ----

  function updateDrawing(e, p) {
    const el = state.drawing;
    const dx = p.x - el.x;
    const dy = p.y - el.y;

    if (el.type === "pencil") {
      const [lx, ly] = el.points[el.points.length - 1];
      if (Math.hypot(dx - lx, dy - ly) >= PENCIL_MIN_STEP) el.points.push([dx, dy]);
    } else if (WB.TWO_POINT_TYPES.includes(el.type)) {
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
  }

  function snapToAngle(dx, dy) {
    const length = Math.hypot(dx, dy);
    const angle = Math.round(Math.atan2(dy, dx) / SNAP_ANGLE) * SNAP_ANGLE;
    return [length * Math.cos(angle), length * Math.sin(angle)];
  }

  // A click without dragging must not leave invisible elements
  function isTooSmall(el) {
    if (el.type === "pencil") return el.points.length < 2;
    if (WB.TWO_POINT_TYPES.includes(el.type)) return Math.hypot(...el.points[1]) < MIN_SIZE;
    return el.width < MIN_SIZE && el.height < MIN_SIZE;
  }

  function finishDrawing() {
    const el = state.drawing;
    state.drawing = null;
    if (BOX_TOOLS.includes(el.type)) WB.normalizeElement(el);
    if (!isTooSmall(el)) {
      state.elements.push(el);
      recordHistory();
    }
    requestRender();
  }

  // ---- Selection: click, drag to move, handles to resize, empty area to select with a box ----

  function startSelectDrag(e, p) {
    const selection = selectedElements();
    const bounds = WB.getCommonBounds(selection);
    const handle = bounds && WB.handleAt(WB.selectionFrame(bounds), p);
    if (handle) {
      state.drag = { mode: "resize", handle, start: p, bounds, originals: snapshot(selection) };
      return;
    }

    const hit = WB.elementAt(state.elements, p);
    if (hit) {
      // Shift adds or removes the element from the selection
      if (e.shiftKey && state.selectedIds.has(hit.id)) {
        state.selectedIds.delete(hit.id);
        return;
      }
      if (e.shiftKey) state.selectedIds.add(hit.id);
      else if (!state.selectedIds.has(hit.id)) state.selectedIds = new Set([hit.id]);
      state.drag = { mode: "move", start: p, originals: snapshot(selectedElements()) };
      return;
    }

    if (!e.shiftKey) state.selectedIds.clear();
    state.drag = {
      mode: "marquee",
      start: p,
      marquee: { x: p.x, y: p.y, width: 0, height: 0 },
      previous: new Set(state.selectedIds),
    };
  }

  function updateSelectDrag(e, p) {
    const drag = state.drag;
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;

    if (drag.mode === "move") {
      drag.originals.forEach((original, id) => {
        const el = state.elements.find((item) => item.id === id);
        WB.moveElement(el, original, dx, dy);
      });
    } else if (drag.mode === "resize") {
      resizeSelection(drag, dx, dy, e.shiftKey);
    } else {
      drag.marquee.width = dx;
      drag.marquee.height = dy;
      const box = WB.normalizeElement({ ...drag.marquee });
      state.selectedIds = new Set(drag.previous);
      state.elements.forEach((el) => {
        if (WB.boxContains(box, WB.getBounds(el))) state.selectedIds.add(el.id);
      });
    }
    requestRender();
  }

  // Scales the selection from the corner opposite to the dragged handle
  function resizeSelection(drag, dx, dy, keepRatio) {
    const b = drag.bounds;
    const dirX = drag.handle[1] === "e" ? 1 : -1;
    const dirY = drag.handle[0] === "s" ? 1 : -1;
    const anchor = [dirX === 1 ? b.x : b.x + b.width, dirY === 1 ? b.y : b.y + b.height];

    // A side with no size (e.g. a horizontal line has no height) keeps its scale
    let sx = b.width ? (b.width + dx * dirX) / b.width : 1;
    let sy = b.height ? (b.height + dy * dirY) / b.height : 1;
    // Texts always keep their proportions, and so does everything with Shift
    const hasText = [...drag.originals.values()].some((el) => el.type === "text");
    if (keepRatio || hasText) {
      const s = b.width && b.height ? Math.max(sx, sy) : b.width ? sx : sy;
      sx = s;
      sy = s;
    }
    // Never shrink below a minimum size or flip over
    sx = Math.max(sx, MIN_SIZE / (b.width || 1));
    sy = Math.max(sy, MIN_SIZE / (b.height || 1));

    drag.originals.forEach((original, id) => {
      const el = state.elements.find((item) => item.id === id);
      WB.scaleElement(el, original, anchor, sx, sy);
    });
  }

  function updateCursor(p) {
    const bounds = WB.getCommonBounds(selectedElements());
    const handle = bounds && WB.handleAt(WB.selectionFrame(bounds), p);
    if (handle) canvas.style.cursor = HANDLE_CURSORS[handle];
    else canvas.style.cursor = WB.elementAt(state.elements, p) ? "move" : "default";
  }

  deleteButton.addEventListener("click", () => {
    state.elements = state.elements.filter((el) => !state.selectedIds.has(el.id));
    state.selectedIds.clear();
    recordHistory();
    requestRender();
  });

  // ---- Files ----

  document.getElementById("save-file").addEventListener("click", () => {
    WB.saveSceneFile(WB.serializeScene(state.elements, WB.view));
  });

  // Opening a file replaces the drawing; it can be undone like any other change
  document.getElementById("open-file").addEventListener("click", async () => {
    const text = await WB.openSceneFile();
    if (text === null) return;
    let scene;
    try {
      scene = WB.parseScene(text);
    } catch (error) {
      alert(error.message);
      return;
    }
    if (state.textEditor) state.textEditor.commit();
    state.elements = scene.elements;
    state.selectedIds.clear();
    if (scene.view) Object.assign(WB.view, scene.view);
    updateZoomLabel();
    recordHistory();
    requestRender();
  });

  // ---- Text ----

  // Clicking on an existing text edits it; anywhere else starts a new text.
  // If an editor is already open, this click only closes it
  function startText(p) {
    if (state.textEditor) {
      state.textEditor.commit();
      return;
    }
    const hit = WB.elementAt(state.elements, p);
    if (hit && hit.type === "text") {
      editText(hit);
      return;
    }
    const el = WB.createElement("text", p.x, p.y);
    openEditor(el, () => state.elements.push(el));
  }

  function editText(el) {
    if (state.textEditor) state.textEditor.commit();
    state.editingId = el.id;
    openEditor(el, () => {});
  }

  // onNew: what to do with the element if it has text and is not on the canvas yet
  function openEditor(el, onNew) {
    const position = toScreen(el.x, el.y);
    state.textEditor = WB.openTextEditor({
      x: position.x,
      y: position.y,
      fontSize: el.fontSize * WB.view.zoom,
      color: el.strokeColor,
      text: el.text,
      onCommit(text) {
        state.textEditor = null;
        state.editingId = null;
        if (text.trim()) {
          el.text = text;
          Object.assign(el, WB.measureText(text, el.fontSize));
          if (!state.elements.includes(el)) onNew();
        } else {
          // Emptying a text deletes it
          state.elements = state.elements.filter((item) => item !== el);
          state.selectedIds.delete(el.id);
        }
        recordHistory();
        requestRender();
      },
    });
    requestRender();
  }

  // ---- Rendering ----

  // Batches several changes into a single render per frame
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    const visible = state.elements.filter((el) => el.id !== state.editingId);
    if (state.drawing) visible.push(state.drawing);
    const selection = state.tool === "select" ? selectedElements() : [];
    const screen = { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 };
    WB.renderScene(ctx, screen, visible, {
      selection,
      marquee: state.drag && state.drag.mode === "marquee" ? state.drag.marquee : null,
    });
    placeDeleteButton(selection);
  }

  // The delete button floats above the selection's top-right corner (below it if there is no room)
  function placeDeleteButton(selection) {
    const show = selection.length > 0 && !state.drag;
    deleteButton.hidden = !show;
    if (!show) return;
    const frame = WB.selectionFrame(WB.getCommonBounds(selection));
    const topLeft = toScreen(frame.x, frame.y);
    const bottomRight = toScreen(frame.x + frame.width, frame.y + frame.height);
    const size = deleteButton.offsetWidth;
    let top = topLeft.y - size - 8;
    if (top < 64) top = bottomRight.y + 8;
    const left = Math.min(Math.max(8, bottomRight.x - size), window.innerWidth - size - 8);
    deleteButton.style.left = `${left}px`;
    deleteButton.style.top = `${top}px`;
  }

  // Matches the canvas pixel size to the screen (sharp on retina displays)
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    render();
  }

  window.addEventListener("resize", resize);
  updateZoomLabel();
  resize();

  // The canvas does not wait for fonts: it re-renders once they finish loading
  document.fonts.load(`20px ${WB.getFontFamily()}`).then(requestRender);
})();
