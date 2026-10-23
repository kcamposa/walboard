// Shapes defined as polygons: vertices inside a box from 0 to 1.
// Adding a new shape only takes a new entry here.
window.WB = window.WB || {};

function starVertices(tips, innerRatio) {
  const vertices = [];
  for (let i = 0; i < tips * 2; i++) {
    const radius = i % 2 === 0 ? 0.5 : 0.5 * innerRatio;
    const a = -Math.PI / 2 + (i * Math.PI) / tips;
    vertices.push([0.5 + radius * Math.cos(a), 0.5 + radius * Math.sin(a)]);
  }
  return vertices;
}

WB.POLYGON_SHAPES = {
  diamond: {
    label: "Diamond",
    vertices: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  },
  parallelogram: {
    label: "Parallelogram",
    vertices: [[0.2, 0], [1, 0], [0.8, 1], [0, 1]],
  },
  triangle: {
    label: "Triangle",
    vertices: [[0.5, 0], [1, 1], [0, 1]],
  },
  hexagon: {
    label: "Hexagon",
    vertices: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  },
  star: {
    label: "Star",
    vertices: starVertices(5, 0.45),
  },
};

// Special shapes in the "More shapes" button. Their outline is built in sketch.js.
// fillColor: initial fill (optional)
WB.EXTRA_SHAPES = {
  cylinder: {
    label: "Cylinder",
    icon: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>',
  },
  cloud: {
    label: "Cloud",
    icon: '<path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z"/>',
  },
  speechBubble: {
    label: "Speech bubble",
    icon: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  },
  stickyNote: {
    label: "Sticky note",
    icon: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
    fillColor: "#fdf0a0",
  },
};

// Small open arrowhead pointing from `from` to `to`, as a path ending at `to`
function arrowHead(from, to, size = 0.09) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const wing = (side) => [to[0] - size * Math.cos(angle + side), to[1] - size * Math.sin(angle + side)];
  return { path: [wing(-0.5), to, wing(0.5)] };
}

// IT infrastructure shapes in the "Infrastructure" button.
// Each one is a list of parts inside a box from 0 to 1:
//   rect: [x, y, w, h]          ellipse: [cx, cy, rx, ry]
//   poly: [[x, y], ...] closed  path: [[x, y], ...] open
//   arc: [cx, cy, rx, ry, fromAngle, toAngle]
// The first closed part (rect, ellipse or poly) is the body and gets the fill.

WB.INFRA_SHAPES = {
  server: {
    label: "Server",
    category: "Devices",
    parts: [
      { rect: [0.15, 0, 0.7, 1] },
      { path: [[0.15, 0.33], [0.85, 0.33]] },
      { path: [[0.15, 0.67], [0.85, 0.67]] },
      { path: [[0.27, 0.17], [0.5, 0.17]] },
      { path: [[0.27, 0.5], [0.5, 0.5]] },
      { path: [[0.27, 0.83], [0.5, 0.83]] },
      { ellipse: [0.7, 0.17, 0.035, 0.035] },
      { ellipse: [0.7, 0.5, 0.035, 0.035] },
      { ellipse: [0.7, 0.83, 0.035, 0.035] },
    ],
  },
  desktop: {
    label: "Desktop",
    category: "Devices",
    parts: [
      { rect: [0, 0, 1, 0.7] },
      { path: [[0.5, 0.7], [0.5, 0.92]] },
      { path: [[0.28, 0.95], [0.72, 0.95]] },
    ],
  },
  laptop: {
    label: "Laptop",
    category: "Devices",
    parts: [
      { rect: [0.12, 0.05, 0.76, 0.68] },
      { poly: [[0.12, 0.78], [0.88, 0.78], [1, 0.95], [0, 0.95]] },
    ],
  },
  mobile: {
    label: "Mobile",
    category: "Devices",
    parts: [
      { rect: [0.25, 0, 0.5, 1] },
      { path: [[0.43, 0.07], [0.57, 0.07]] },
      { path: [[0.42, 0.9], [0.58, 0.9]] },
    ],
  },
  router: {
    label: "Router",
    category: "Network",
    parts: [
      { rect: [0, 0.45, 1, 0.4] },
      { path: [[0.25, 0.45], [0.15, 0.08]] },
      { path: [[0.75, 0.45], [0.85, 0.08]] },
      { path: [[0.12, 0.65], [0.2, 0.65]] },
      { path: [[0.3, 0.65], [0.38, 0.65]] },
      { ellipse: [0.82, 0.65, 0.035, 0.035] },
    ],
  },
  switch: {
    label: "Switch",
    category: "Network",
    parts: [
      { rect: [0, 0.3, 1, 0.4] },
      { rect: [0.08, 0.42, 0.11, 0.16] },
      { rect: [0.25, 0.42, 0.11, 0.16] },
      { rect: [0.42, 0.42, 0.11, 0.16] },
      { rect: [0.59, 0.42, 0.11, 0.16] },
      { ellipse: [0.86, 0.5, 0.035, 0.035] },
    ],
  },
  firewall: {
    label: "Firewall",
    category: "Network",
    parts: [
      { rect: [0, 0.1, 1, 0.8] },
      { path: [[0, 0.3], [1, 0.3]] },
      { path: [[0, 0.5], [1, 0.5]] },
      { path: [[0, 0.7], [1, 0.7]] },
      { path: [[0.33, 0.1], [0.33, 0.3]] },
      { path: [[0.67, 0.1], [0.67, 0.3]] },
      { path: [[0.17, 0.3], [0.17, 0.5]] },
      { path: [[0.5, 0.3], [0.5, 0.5]] },
      { path: [[0.83, 0.3], [0.83, 0.5]] },
      { path: [[0.33, 0.5], [0.33, 0.7]] },
      { path: [[0.67, 0.5], [0.67, 0.7]] },
      { path: [[0.17, 0.7], [0.17, 0.9]] },
      { path: [[0.5, 0.7], [0.5, 0.9]] },
      { path: [[0.83, 0.7], [0.83, 0.9]] },
    ],
  },
  loadBalancer: {
    label: "Load balancer",
    category: "Network",
    parts: [
      { ellipse: [0.5, 0.5, 0.5, 0.5] },
      { path: [[0.12, 0.5], [0.42, 0.5]] },
      { path: [[0.42, 0.5], [0.78, 0.26]] },
      { path: [[0.42, 0.5], [0.84, 0.5]] },
      { path: [[0.42, 0.5], [0.78, 0.74]] },
      arrowHead([0.42, 0.5], [0.78, 0.26]),
      arrowHead([0.42, 0.5], [0.84, 0.5]),
      arrowHead([0.42, 0.5], [0.78, 0.74]),
    ],
  },
  internet: {
    label: "Internet",
    category: "Network",
    parts: [
      { ellipse: [0.5, 0.5, 0.5, 0.5] },
      { ellipse: [0.5, 0.5, 0.22, 0.5] },
      { path: [[0, 0.5], [1, 0.5]] },
      { path: [[0.07, 0.27], [0.93, 0.27]] },
      { path: [[0.07, 0.73], [0.93, 0.73]] },
    ],
  },
  database: {
    label: "Database",
    category: "Data",
    parts: [
      { ellipse: [0.5, 0.13, 0.5, 0.13] },
      { path: [[0, 0.13], [0, 0.87]] },
      { path: [[1, 0.13], [1, 0.87]] },
      { arc: [0.5, 0.87, 0.5, 0.13, 0, Math.PI] },
      { arc: [0.5, 0.5, 0.5, 0.13, 0, Math.PI] },
    ],
  },
  storage: {
    label: "Storage",
    category: "Data",
    parts: [
      { rect: [0, 0.25, 1, 0.5] },
      { path: [[0.1, 0.5], [0.55, 0.5]] },
      { ellipse: [0.82, 0.5, 0.05, 0.08] },
    ],
  },
  queue: {
    label: "Queue",
    category: "Data",
    parts: [
      { rect: [0, 0.3, 1, 0.4] },
      { path: [[0.25, 0.3], [0.25, 0.7]] },
      { path: [[0.5, 0.3], [0.5, 0.7]] },
      { path: [[0.75, 0.3], [0.75, 0.7]] },
    ],
  },
  container: {
    label: "Container",
    category: "Software",
    parts: [
      { rect: [0, 0.15, 1, 0.7] },
      { path: [[0.2, 0.27], [0.2, 0.73]] },
      { path: [[0.4, 0.27], [0.4, 0.73]] },
      { path: [[0.6, 0.27], [0.6, 0.73]] },
      { path: [[0.8, 0.27], [0.8, 0.73]] },
    ],
  },
  api: {
    label: "API",
    category: "Software",
    parts: [
      { rect: [0, 0.2, 1, 0.6] },
      { path: [[0.35, 0.36], [0.22, 0.5], [0.35, 0.64]] },
      { path: [[0.65, 0.36], [0.78, 0.5], [0.65, 0.64]] },
      { path: [[0.55, 0.33], [0.45, 0.67]] },
    ],
  },
  microservice: {
    label: "Microservice",
    category: "Software",
    parts: [
      { poly: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]] },
      { ellipse: [0.5, 0.5, 0.18, 0.18] },
    ],
  },
  user: {
    label: "User",
    category: "Other",
    parts: [
      { ellipse: [0.5, 0.25, 0.2, 0.22] },
      { arc: [0.5, 1, 0.42, 0.45, Math.PI, 2 * Math.PI] },
      { path: [[0.08, 1], [0.92, 1]] },
    ],
  },
  lock: {
    label: "Lock",
    category: "Other",
    parts: [
      { rect: [0.15, 0.45, 0.7, 0.55] },
      { arc: [0.5, 0.45, 0.25, 0.33, Math.PI, 2 * Math.PI] },
      { ellipse: [0.5, 0.66, 0.05, 0.06] },
      { path: [[0.5, 0.72], [0.5, 0.86]] },
    ],
  },
};
