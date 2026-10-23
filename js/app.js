// Punto de entrada: prepara el lienzo y la barra de herramientas.
window.WB = window.WB || {};

(function () {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const state = {
    tool: "select",
  };

  WB.createToolbar(document.getElementById("toolbar"), (tool) => {
    state.tool = tool;
    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
  });

  // Ajusta el tamaño real del canvas a la pantalla (nítido en pantallas retina)
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function render() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const styles = getComputedStyle(document.documentElement);

    ctx.fillStyle = styles.getPropertyValue("--bg");
    ctx.fillRect(0, 0, width, height);

    // Cuadrícula de puntos como guía visual
    const gap = 20;
    ctx.fillStyle = styles.getPropertyValue("--grid-dot");
    for (let x = gap; x < width; x += gap) {
      for (let y = gap; y < height; y += gap) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  }

  window.addEventListener("resize", resize);
  resize();
})();
