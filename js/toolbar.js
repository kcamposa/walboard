// Barra de herramientas: crea los botones y avisa cuando cambia la herramienta activa.
window.WB = window.WB || {};

WB.TOOLS = [
  { id: "select", label: "Seleccionar", key: "v", icon: '<path d="M5 3l14 8-6 2-3 6z"/>' },
  { id: "rectangle", label: "Rectángulo", key: "r", icon: '<rect x="4" y="5" width="16" height="14" rx="1"/>' },
  { id: "ellipse", label: "Elipse", key: "o", icon: '<ellipse cx="12" cy="12" rx="8" ry="6"/>' },
  { id: "line", label: "Línea", key: "l", icon: '<path d="M5 19L19 5"/>' },
  { id: "arrow", label: "Flecha", key: "a", icon: '<path d="M5 19L19 5M11 5h8v8"/>' },
  { id: "text", label: "Texto", key: "t", icon: '<path d="M5 6h14M12 6v13"/>' },
  { id: "pencil", label: "Lápiz", key: "p", icon: '<path d="M4 17c3-6 5 2 8-4s5-2 8-6"/>' },
];

WB.createToolbar = function (container, onChange) {
  let active = WB.TOOLS[0].id;
  const buttons = {};

  WB.TOOLS.forEach((tool) => {
    const btn = document.createElement("button");
    btn.className = "tool-btn";
    btn.title = `${tool.label} (${tool.key.toUpperCase()})`;
    btn.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${tool.icon}</svg>` +
      `<span class="key">${tool.key.toUpperCase()}</span>`;
    btn.addEventListener("click", () => setActive(tool.id));
    container.appendChild(btn);
    buttons[tool.id] = btn;
  });

  function setActive(id) {
    active = id;
    Object.entries(buttons).forEach(([toolId, btn]) => {
      btn.classList.toggle("active", toolId === id);
    });
    onChange(id);
  }

  // Atajos de teclado (se ignoran mientras se escribe en un campo de texto)
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    const tool = WB.TOOLS.find((t) => t.key === e.key.toLowerCase());
    if (tool) setActive(tool.id);
  });

  setActive(active);
  return { getActive: () => active, setActive };
};
