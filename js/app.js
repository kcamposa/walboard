// Entry point: sets up the canvases panel, the drawing area, the toolbar, pointer drawing and selection.
window.WB = window.WB || {};

(function () {
  const stage = document.getElementById("stage"); // drawing area, to the right of the canvases panel
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
    editingLabelId: null, // shape whose text is hidden while its editor is open
    editingElement: null, // text or shape being typed into (can be a new text not on the canvas yet)
    selectedIds: new Set(),
    drag: null, // current select-tool drag: { mode: "move" | "resize" | "marquee", ... }
    pan: null, // last pointer position while moving the canvas
    style: { strokeColor: WB.DEFAULT_STYLE.strokeColor, fillColor: "transparent" }, // colors for new elements
  };
  let renderQueued = false; // declared before the toolbar, which triggers a render when created

  const store = WB.canvasStore;
  let currentId = store.init(); // open canvas
  let history = null; // undo/redo history of the open canvas
  const undoButton = document.getElementById("undo");
  const redoButton = document.getElementById("redo");

  // Call after every finished change: it can be undone, and the canvas is saved
  function recordHistory() {
    if (history.record(state.elements)) {
      store.save(currentId, state.elements, WB.view);
      refreshSidebar();
    }
    updateHistoryButtons();
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
    store.save(currentId, state.elements, WB.view);
    refreshSidebar();
    requestRender();
  }

  undoButton.addEventListener("click", () => restore(history.undo()));
  redoButton.addEventListener("click", () => restore(history.redo()));

  const toolbar = WB.createToolbar(document.getElementById("toolbar"), (tool) => {
    state.tool = tool;
    canvas.style.cursor = toolCursor();
    if (tool !== "select") state.selectedIds.clear();
    requestRender();
  });

  // Esc goes back to the Select tool (the only keyboard shortcut, asked for explicitly).
  // A shape still being dragged is discarded. Ignored while typing in a text field
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || state.tool === "select") return;
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    state.drawing = null;
    toolbar.setActive("select");
  });

  function toolCursor() {
    return { select: "default", hand: "grab" }[state.tool] || "crosshair";
  }

  // Pointer event position relative to the drawing area
  function toStage(e) {
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Converts a pointer event position into scene coordinates
  function toScene(e) {
    const s = toStage(e);
    return { x: s.x / WB.view.zoom + WB.view.x, y: s.y / WB.view.zoom + WB.view.y };
  }

  // Scene coordinates to a position inside the drawing area

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
      const s = toStage(e);
      if (e.ctrlKey) zoomTo(WB.view.zoom * Math.exp(-e.deltaY * 0.01), s.x, s.y);
      else panBy(e.deltaX, e.deltaY);
    },
    { passive: false },
  );

  const centerX = () => stage.clientWidth / 2;
  const centerY = () => stage.clientHeight / 2;
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
      state.drawing = WB.createElement(state.tool, p.x, p.y, state.style);
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

  // Double click on a text edits it; on a shape, edits the text inside it
  canvas.addEventListener("dblclick", (e) => {
    const hit = WB.elementAt(state.elements, toScene(e));
    if (!hit) return;
    if (hit.type === "text") editText(hit);
    else if (WB.canHaveLabel(hit.type)) editLabel(hit);
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

  // ---- Colors ----

  const TEXT_FORMAT_KINDS = ["fontSize", "textAlign", "verticalAlign", ...WB.FONT_STYLES];
  const stylePanelEl = document.getElementById("style-panel");

  // A change in the panel applies to the selection and to the text being typed. With nothing to apply it to,
  // it is kept for the next element drawn (colors are always kept: "the last color used")
  const stylePanel = WB.createStylePanel(stylePanelEl, (kind, value) => {
    const isText = TEXT_FORMAT_KINDS.includes(kind);
    const canApply = (el) => {
      if (kind === "fillColor") return WB.isFillable(el.type);
      if (kind === "verticalAlign") return WB.canHaveLabel(el.type);
      return !isText || el.type === "text" || WB.canHaveLabel(el.type);
    };
    const targets = styleTargets().filter(canApply);
    if (!isText || !targets.length) state.style[kind] = value;
    targets.forEach((el) => {
      el[kind] = value;
      if (el.type === "text" && el.text) Object.assign(el, WB.measureText(el.text, el));
    });
    if (state.textEditor && state.editingElement) state.textEditor.update(editorStyle(state.editingElement));
    if (targets.some((el) => state.elements.includes(el))) recordHistory();
    requestRender();
  });

  // The panel buttons do not take the focus away, so the text being typed can be formatted
  stylePanelEl.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) e.preventDefault();
  });

  // Selected elements plus the one being typed into
  function styleTargets() {
    const targets = selectedElements();
    if (state.editingElement && !targets.includes(state.editingElement)) targets.push(state.editingElement);
    return targets;
  }

  // The panel shows the style of the selection (and the text being typed), or the one for the next element
  function updateStylePanel(selection) {
    const targets = styleTargets();
    const drawingTool = state.tool === "text" || DRAW_TOOLS.includes(state.tool);
    if (!targets.length) {
      stylePanel.update({
        visible: drawingTool,
        showFill: WB.isFillable(state.tool),
        strokeColor: state.style.strokeColor,
        fillColor: state.style.fillColor,
        // Text options for the next text
        showText: state.tool === "text",
        showPosition: false,
        fontSize: state.style.fontSize || WB.DEFAULT_FONT_SIZE,
        textAlign: state.style.textAlign || "left",
        verticalAlign: null,
        fontStyles: Object.fromEntries(WB.FONT_STYLES.map((key) => [key, Boolean(state.style[key])])),
      });
      return;
    }
    const fillable = targets.filter((el) => WB.isFillable(el.type));
    // Texts, and shapes that have text (or are getting it now)
    const texts = targets.filter((el) => el.type === "text" || el.label || el === state.editingElement);
    const format = texts.map((el) => ({
      fontSize: el.fontSize || WB.DEFAULT_FONT_SIZE,
      textAlign: el.textAlign || WB.defaultTextAlign(el),
      verticalAlign: el.type === "text" ? undefined : el.verticalAlign || WB.defaultVerticalAlign(el),
      ...Object.fromEntries(WB.FONT_STYLES.map((key) => [key, Boolean(el[key])])),
    }));
    stylePanel.update({
      visible: true,
      showFill: fillable.length > 0,
      strokeColor: commonValue(targets, "strokeColor"),
      fillColor: commonValue(fillable, "fillColor"),
      showText: texts.length > 0,
      showPosition: texts.some((el) => el.type !== "text"),
      fontSize: commonValue(format, "fontSize"),
      textAlign: commonValue(format, "textAlign"),
      verticalAlign: commonValue(format.filter((f) => f.verticalAlign), "verticalAlign"),
      fontStyles: Object.fromEntries(WB.FONT_STYLES.map((key) => [key, commonValue(format, key)])),
    });
  }

  // The value if every element has the same one, otherwise null
  function commonValue(elements, key) {
    const values = new Set(elements.map((el) => el[key]));
    return values.size === 1 ? [...values][0] : null;
  }

  // ---- Files ----

  const currentName = () => (store.get(currentId) || {}).name;

  document.getElementById("save-file").addEventListener("click", () => {
    WB.saveSceneFile(WB.serializeScene(state.elements, WB.view), currentId, currentName());
  });

  // Exports the selection, or the whole drawing when nothing is selected
  document.getElementById("export-png").addEventListener("click", () => {
    const selection = selectedElements();
    const elements = selection.length ? selection : state.elements;
    if (!elements.length) {
      alert("There is nothing to export yet.");
      return;
    }
    WB.exportPng(elements, currentName());
  });

  // Opening a file creates a new canvas named after the file
  document.getElementById("open-file").addEventListener("click", async () => {
    const file = await WB.openSceneFile();
    if (!file) return;
    let scene;
    try {
      scene = WB.parseScene(file.text);
    } catch (error) {
      alert(error.message);
      return;
    }
    leaveCanvas();
    openCanvas(store.create(file.name, scene).id);
  });

  // ---- Canvases ----

  const sidebar = WB.createSidebar(document.getElementById("sidebar"), {
    // A new canvas opens with its name field ready to type
    onCreate() {
      leaveCanvas();
      const { id } = store.create();
      openCanvas(id);
      sidebar.rename(id);
    },
    onSelect(id) {
      leaveCanvas();
      openCanvas(id);
    },
    onRename(id, name) {
      store.rename(id, name);
      refreshSidebar();
    },
    // Deleting the open canvas opens the most recent one left (or a new empty one)
    onDelete(id) {
      if (id === currentId && state.textEditor) state.textEditor.commit();
      store.remove(id);
      if (id !== currentId) {
        refreshSidebar();
        return;
      }
      const next = store.list()[0] || store.create();
      openCanvas(next.id);
    },
  });

  function refreshSidebar() {
    sidebar.update(store.list(), currentId);
  }

  // Before switching canvases: closes the text editor and keeps where the view was
  function leaveCanvas() {
    if (state.textEditor) state.textEditor.commit();
    store.save(currentId, state.elements, WB.view, false);
  }

  // Loads a canvas into the drawing area, with its own undo history
  function openCanvas(id) {
    const scene = store.load(id);
    currentId = id;
    store.setCurrentId(id);
    state.elements = scene.elements;
    state.selectedIds.clear();
    state.drawing = null;
    state.drag = null;
    Object.assign(WB.view, { x: 0, y: 0, zoom: 1 }, scene.view);
    history = WB.createHistory(state.elements);
    updateHistoryButtons();
    updateZoomLabel();
    refreshSidebar();
    requestRender();
  }

  // The panel can be hidden to have more room to draw; the choice is remembered
  const SIDEBAR_HIDDEN_KEY = "walboard:sidebar-hidden";
  function setSidebarHidden(hidden) {
    document.body.classList.toggle("sidebar-hidden", hidden);
    try {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      // not remembered, that is fine
    }
  }
  document.getElementById("toggle-sidebar").addEventListener("click", () => {
    setSidebarHidden(!document.body.classList.contains("sidebar-hidden"));
  });
  try {
    if (localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "1") setSidebarHidden(true);
  } catch {
    // storage blocked: the panel starts visible
  }

  // The view (pan / zoom) is saved when leaving the page
  window.addEventListener("pagehide", () => store.save(currentId, state.elements, WB.view, false));

  // ---- Text ----

  // Clicking on an existing text edits it, on a shape edits the text inside it; anywhere else starts a new text.
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
    if (hit && WB.canHaveLabel(hit.type)) {
      editLabel(hit);
      return;
    }
    const el = WB.createElement("text", p.x, p.y, state.style);
    openEditor(el, () => state.elements.push(el));
  }

  function editText(el) {
    if (state.textEditor) state.textEditor.commit();
    state.editingId = el.id;
    openEditor(el, () => {});
  }

  // Look of the editor for an element: size (with the zoom), color, alignment and font styles
  function editorStyle(el) {
    return {
      fontSize: el.fontSize * WB.view.zoom,
      color: el.strokeColor,
      align: el.textAlign || WB.defaultTextAlign(el),
      ...Object.fromEntries(WB.FONT_STYLES.map((key) => [key, Boolean(el[key])])),
    };
  }

  // Text inside a shape. The text area has the width of the shape and moves with the vertical alignment
  function editLabel(el) {
    if (state.textEditor) state.textEditor.commit();
    // The first time a shape gets text, it takes the size and styles chosen for the next text
    if (!el.fontSize) {
      el.fontSize = state.style.fontSize || WB.DEFAULT_FONT_SIZE;
      WB.FONT_STYLES.forEach((key) => {
        if (state.style[key]) el[key] = true;
      });
    }
    state.editingLabelId = el.id;
    state.editingElement = el;
    if (state.tool === "select") state.selectedIds = new Set([el.id]);

    const place = (heightPx) => {
      const area = WB.labelArea(el);
      return toScreen(area.x, WB.labelTop(el, area, heightPx / WB.view.zoom));
    };
    const start = place(el.fontSize * WB.LINE_HEIGHT * WB.view.zoom);
    state.textEditor = WB.openTextEditor({
      container: stage,
      x: start.x,
      y: start.y,
      width: WB.labelArea(el).width * WB.view.zoom,
      text: el.label || "",
      reposition: place,
      ...editorStyle(el),
      onCommit(text) {
        state.textEditor = null;
        state.editingLabelId = null;
        state.editingElement = null;
        if (text.trim()) el.label = text;
        else delete el.label;
        recordHistory();
        requestRender();
      },
    });
    requestRender();
  }

  // onNew: what to do with the element if it has text and is not on the canvas yet
  function openEditor(el, onNew) {
    const position = toScreen(el.x, el.y);
    state.editingElement = el;
    state.textEditor = WB.openTextEditor({
      container: stage,
      x: position.x,
      y: position.y,
      text: el.text,
      ...editorStyle(el),
      onCommit(text) {
        state.textEditor = null;
        state.editingId = null;
        state.editingElement = null;
        if (text.trim()) {
          el.text = text;
          Object.assign(el, WB.measureText(text, el));
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
    // Texts being edited are hidden (the editor shows them); a shape being edited is drawn without its text
    const visible = state.elements
      .filter((el) => el.id !== state.editingId)
      .map((el) => (el.id === state.editingLabelId ? { ...el, label: "" } : el));
    if (state.drawing) visible.push(state.drawing);
    const selection = state.tool === "select" ? selectedElements() : [];
    const screen = { width: stage.clientWidth, height: stage.clientHeight, dpr: window.devicePixelRatio || 1 };
    WB.renderScene(ctx, screen, visible, {
      selection,
      marquee: state.drag && state.drag.mode === "marquee" ? state.drag.marquee : null,
    });
    placeDeleteButton(selection);
    updateStylePanel(selection);
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
    const left = Math.min(Math.max(8, bottomRight.x - size), stage.clientWidth - size - 8);
    deleteButton.style.left = `${left}px`;
    deleteButton.style.top = `${top}px`;
  }

  // Matches the canvas pixel size to the drawing area (sharp on retina displays)
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(stage.clientWidth * dpr);
    canvas.height = Math.floor(stage.clientHeight * dpr);
    placeToolbar();
    render();
  }

  // The toolbar is centered, unless that would put it over the file buttons
  const toolbarEl = document.getElementById("toolbar");
  const fileBar = document.querySelector(".file-bar");
  function placeToolbar() {
    const minLeft = fileBar.offsetLeft + fileBar.offsetWidth + 12;
    const centeredLeft = (stage.clientWidth - toolbarEl.offsetWidth) / 2;
    toolbarEl.style.left = `${Math.max(minLeft, centeredLeft)}px`;
  }

  // Resizes with the window and when the canvases panel is shown or hidden
  new ResizeObserver(resize).observe(stage);
  openCanvas(currentId);
  resize();

  // The canvas does not wait for fonts: it re-renders once they finish loading
  document.fonts.load(`20px ${WB.getFontFamily()}`).then(requestRender);
})();
