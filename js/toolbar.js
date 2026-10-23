// Toolbar: creates the buttons and reports when the active tool changes.
window.WB = window.WB || {};

// Icon for a polygon from WB.POLYGON_SHAPES, drawn inside the 24×24 area
function polygonIcon(vertices) {
  const points = vertices.map(([x, y]) => `${(4 + x * 16).toFixed(1)},${(4 + y * 16).toFixed(1)}`).join(" ");
  return `<polygon points="${points}"/>`;
}

// Icon for an infrastructure shape, built from its parts (box from 0 to 1) inside the 24×24 area
function partsIcon(parts) {
  const s = (v) => (3 + v * 18).toFixed(1);
  const d = (v) => (v * 18).toFixed(1);
  const pointList = (list) => list.map(([x, y]) => `${s(x)},${s(y)}`).join(" ");
  return parts
    .map((part) => {
      if (part.rect) {
        const [x, y, w, h] = part.rect;
        return `<rect x="${s(x)}" y="${s(y)}" width="${d(w)}" height="${d(h)}" rx="1.5"/>`;
      }
      if (part.ellipse) {
        const [cx, cy, rx, ry] = part.ellipse;
        return `<ellipse cx="${s(cx)}" cy="${s(cy)}" rx="${d(rx)}" ry="${d(ry)}"/>`;
      }
      if (part.poly) return `<polygon points="${pointList(part.poly)}"/>`;
      if (part.arc) {
        const [cx, cy, rx, ry, from, to] = part.arc;
        const steps = Array.from({ length: 13 }, (_, i) => {
          const a = from + ((to - from) * i) / 12;
          return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
        });
        return `<polyline points="${pointList(steps)}"/>`;
      }
      return `<polyline points="${pointList(part.path)}"/>`;
    })
    .join("");
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

// Menu buttons at the end of the toolbar. category: optional heading inside the menu
const MENUS = [
  {
    title: "More shapes",
    icon: '<rect x="4" y="4" width="6" height="6" rx="1"/><circle cx="17" cy="7" r="3"/><path d="M7 14l3 6H4zM14 14h6v6h-6z"/>',
    tools: Object.entries(WB.EXTRA_SHAPES).map(([id, shape]) => ({ id, label: shape.label, icon: shape.icon })),
  },
  {
    title: "Infrastructure",
    icon: partsIcon(WB.INFRA_SHAPES.server.parts),
    wide: true,
    tools: Object.entries(WB.INFRA_SHAPES).map(([id, shape]) => ({
      id,
      label: shape.label,
      category: shape.category,
      icon: partsIcon(shape.parts),
    })),
  },
];

function svgIcon(content) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

WB.createToolbar = function (container, onChange) {
  let active = WB.TOOLS[0].id;
  const buttons = {};
  const menuButtons = [];

  WB.TOOL_GROUPS.forEach((group, i) => {
    if (i > 0) container.appendChild(createSeparator());
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

  container.appendChild(createSeparator());
  MENUS.forEach((config) => container.appendChild(createMenuButton(config)));

  function createSeparator() {
    const separator = document.createElement("div");
    separator.className = "tool-separator";
    return separator;
  }

  // Button that opens a menu with more tools
  function createMenuButton(config) {
    const wrap = document.createElement("div");
    wrap.className = "more-wrap";
    const btn = document.createElement("button");
    btn.className = "tool-btn";
    btn.title = config.title;
    const menu = document.createElement("div");
    menu.className = config.wide ? "shape-menu wide" : "shape-menu";
    menu.hidden = true;

    let lastCategory = null;
    config.tools.forEach((tool) => {
      if (tool.category && tool.category !== lastCategory) {
        const heading = document.createElement("div");
        heading.className = "shape-menu-heading";
        heading.textContent = tool.category;
        menu.appendChild(heading);
        lastCategory = tool.category;
      }
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

    btn.addEventListener("click", () => {
      const wasHidden = menu.hidden;
      menuButtons.forEach((m) => (m.menu.hidden = true));
      menu.hidden = !wasHidden;
    });
    // Closes when clicking outside
    document.addEventListener("pointerdown", (e) => {
      if (!wrap.contains(e.target)) menu.hidden = true;
    });

    wrap.append(btn, menu);
    menuButtons.push({ config, btn, menu });
    return wrap;
  }

  function setActive(id) {
    active = id;
    Object.entries(buttons).forEach(([toolId, btn]) => {
      btn.classList.toggle("active", toolId === id);
    });
    // If the chosen tool belongs to a menu, its button shows the tool's icon
    menuButtons.forEach(({ config, btn }) => {
      const tool = config.tools.find((t) => t.id === id);
      btn.classList.toggle("active", Boolean(tool));
      btn.innerHTML = svgIcon(tool ? tool.icon : config.icon);
    });
    onChange(id);
  }

  setActive(active);
  return { getActive: () => active, setActive };
};
