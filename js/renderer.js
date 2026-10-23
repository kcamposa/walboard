// Dibuja el fondo y todos los elementos en el canvas.
window.WB = window.WB || {};

WB.renderScene = function (ctx, width, height, elements) {
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

  elements.forEach((el) => drawElement(ctx, el));
};

function drawElement(ctx, el) {
  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.fillStyle = el.fillColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (el.type) {
    case "rectangle": {
      const box = normalized(el);
      if (el.fillColor !== "transparent") {
        WB.traceSketchyRect(ctx, box);
        ctx.fill();
      }
      // Trazos superpuestos y algo más finos: juntos dan el grosor desparejo de una línea a mano
      ctx.lineWidth = el.strokeWidth * 0.75;
      for (let pass = 0; pass < WB.SKETCH_PASSES; pass++) {
        WB.traceSketchyRect(ctx, box, pass);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

// Copia con ancho y alto positivos, para dibujar mientras se arrastra en cualquier dirección
function normalized(el) {
  return WB.normalizeElement({ ...el });
}
