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
