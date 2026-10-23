// Formas definidas como polígonos: vértices dentro de un recuadro de 0 a 1.
// Para agregar una forma nueva alcanza con sumar una entrada acá.
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
    label: "Rombo",
    vertices: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  },
  parallelogram: {
    label: "Paralelogramo",
    vertices: [[0.2, 0], [1, 0], [0.8, 1], [0, 1]],
  },
  triangle: {
    label: "Triángulo",
    vertices: [[0.5, 0], [1, 1], [0, 1]],
  },
  hexagon: {
    label: "Hexágono",
    vertices: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  },
  star: {
    label: "Estrella",
    vertices: starVertices(5, 0.45),
  },
};
