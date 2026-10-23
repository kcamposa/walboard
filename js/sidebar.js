// Side panel with the list of canvases: create, search, open, rename and delete.
window.WB = window.WB || {};

const ICON_RENAME = '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>';
const ICON_DELETE = '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>';

function sidebarIcon(content) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

// "just now", "5 min ago", "3 h ago", "2 d ago", or the date
function timeAgo(timestamp) {
  const seconds = (Date.now() - timestamp) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// handlers: { onCreate(), onSelect(id), onRename(id, name), onDelete(id) }
WB.createSidebar = function (container, handlers) {
  container.innerHTML = `
    <div class="sidebar-header">Walboard</div>
    <button class="new-canvas-btn" type="button">+ New canvas</button>
    <input class="canvas-search" type="search" placeholder="Search canvases" />
    <div class="canvas-list"></div>
  `;
  const search = container.querySelector(".canvas-search");
  const listEl = container.querySelector(".canvas-list");
  let canvases = [];
  let currentId = null;

  container.querySelector(".new-canvas-btn").addEventListener("click", () => handlers.onCreate());
  search.addEventListener("input", draw);

  function draw() {
    const query = search.value.trim().toLowerCase();
    const visible = canvases.filter((c) => c.name.toLowerCase().includes(query));
    listEl.innerHTML = "";
    if (!visible.length) {
      listEl.innerHTML = `<div class="canvas-empty">${query ? "No canvases match your search" : "No canvases yet"}</div>`;
      return;
    }
    visible.forEach((c) => listEl.appendChild(createItem(c)));
  }

  function createItem(c) {
    const item = document.createElement("div");
    item.className = c.id === currentId ? "canvas-item active" : "canvas-item";
    item.innerHTML = `
      <div class="canvas-info">
        <div class="canvas-name"></div>
        <div class="canvas-time">${timeAgo(c.updatedAt)}</div>
      </div>
      <button class="canvas-action" type="button" title="Rename">${sidebarIcon(ICON_RENAME)}</button>
      <button class="canvas-action danger" type="button" title="Delete">${sidebarIcon(ICON_DELETE)}</button>
    `;
    const nameEl = item.querySelector(".canvas-name");
    nameEl.textContent = c.name; // textContent: names are user text, never HTML
    const [renameBtn, deleteBtn] = item.querySelectorAll(".canvas-action");

    item.addEventListener("click", () => {
      if (c.id !== currentId) handlers.onSelect(c.id);
    });
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startRename(c, nameEl);
    });
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${c.name}"? This cannot be undone.`)) handlers.onDelete(c.id);
    });
    return item;
  }

  // Replaces the name with a text field; the new name is kept when the field loses focus
  function startRename(c, nameEl) {
    const input = document.createElement("input");
    input.className = "canvas-rename";
    input.value = c.name;
    nameEl.replaceWith(input);
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("blur", () => {
      const name = input.value.trim();
      if (name && name !== c.name) handlers.onRename(c.id, name);
      else draw();
    });
    input.focus();
    input.select();
  }

  // Keeps the "x min ago" labels fresh (but not while a name is being edited)
  setInterval(() => {
    if (!listEl.querySelector(".canvas-rename")) draw();
  }, 60 * 1000);

  return {
    update(list, activeId) {
      canvases = list;
      currentId = activeId;
      draw();
    },
  };
};
