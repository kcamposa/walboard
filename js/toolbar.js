// Toolbar: creates the buttons and reports when the active tool changes.
window.WB = window.WB || {};

// Icon for a polygon from WB.POLYGON_SHAPES, drawn inside the 24×24 area
function polygonIcon(vertices) {
  const points = vertices.map(([x, y]) => `${(4 + x * 16).toFixed(1)},${(4 + y * 16).toFixed(1)}`).join(" ");
  return `<polygon points="${points}"/>`;
}

const POLYGON_TOOLS = Object.entries(WB.POLYGON_SHAPES).map(([id, shape]) => ({
  id,
  label: shape.label,
  icon: polygonIcon(shape.vertices),
}));

// Grouped tools; a separator is drawn between groups
WB.TOOL_GROUPS = [
  [{ id: "select", label: "Select", icon: '<path d="M5 3l14 8-6 2-3 6z"/>' }],
  [
    { id: "rectangle", label: "Rectangle", icon: '<rect x="4" y="5" width="16" height="14" rx="1"/>' },
    { id: "ellipse", label: "Ellipse", icon: '<ellipse cx="12" cy="12" rx="8" ry="6"/>' },
    ...POLYGON_TOOLS,
  ],
  [
    { id: "line", label: "Line", icon: '<path d="M5 19L19 5"/>' },
    { id: "arrow", label: "Arrow", icon: '<path d="M5 19L19 5M11 5h8v8"/>' },
  ],
  [
    { id: "text", label: "Text", icon: '<path d="M5 6h14M12 6v13"/>' },
    { id: "pencil", label: "Pencil", icon: '<path d="M4 17c3-6 5 2 8-4s5-2 8-6"/>' },
  ],
];

WB.TOOLS = WB.TOOL_GROUPS.flat();

const MORE_ICON = '<rect x="4" y="4" width="6" height="6" rx="1"/><circle cx="17" cy="7" r="3"/><path d="M7 14l3 6H4zM14 14h6v6h-6z"/>';

const EXTRA_TOOLS = Object.entries(WB.EXTRA_SHAPES).map(([id, shape]) => ({
  id,
  label: shape.label,
  icon: shape.icon,
}));

function svgIcon(content) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

WB.createToolbar = function (container, onChange) {
  let active = WB.TOOLS[0].id;
  const buttons = {};

  WB.TOOL_GROUPS.forEach((group, i) => {
    if (i > 0) {
      const separator = document.createElement("div");
      separator.className = "tool-separator";
      container.appendChild(separator);
    }
    group.forEach((tool) => {
      const btn = document.createElement("button");
      btn.className = "tool-btn";
      btn.title = tool.label;
      btn.innerHTML = svgIcon(tool.icon);
      btn.addEventListener("click", () => setActive(tool.id));
      container.appendChild(btn);
      buttons[tool.id] = btn;
    });
  });

  // "More shapes" button: opens a menu with the special shapes
  const moreWrap = document.createElement("div");
  moreWrap.className = "more-wrap";
  const moreBtn = document.createElement("button");
  moreBtn.className = "tool-btn";
  moreBtn.title = "More shapes";
  const menu = document.createElement("div");
  menu.className = "shape-menu";
  menu.hidden = true;

  EXTRA_TOOLS.forEach((tool) => {
    const item = document.createElement("button");
    item.className = "shape-item";
    item.innerHTML = svgIcon(tool.icon) + `<span>${tool.label}</span>`;
    item.addEventListener("click", () => {
      menu.hidden = true;
      setActive(tool.id);
    });
    menu.appendChild(item);
    buttons[tool.id] = item;
  });

  moreBtn.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });
  // Closes when clicking outside
  document.addEventListener("pointerdown", (e) => {
    if (!moreWrap.contains(e.target)) menu.hidden = true;
  });

  const separator = document.createElement("div");
  separator.className = "tool-separator";
  moreWrap.append(moreBtn, menu);
  container.append(separator, moreWrap);

  function setActive(id) {
    active = id;
    Object.entries(buttons).forEach(([toolId, btn]) => {
      btn.classList.toggle("active", toolId === id);
    });
    // If the chosen tool is a special shape, the button shows its icon
    const extra = EXTRA_TOOLS.find((t) => t.id === id);
    moreBtn.classList.toggle("active", Boolean(extra));
    moreBtn.innerHTML = svgIcon(extra ? extra.icon : MORE_ICON);
    onChange(id);
  }

  setActive(active);
  return { getActive: () => active, setActive };
};
