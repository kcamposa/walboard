// Style panel: stroke and background colors, for the next shape or for the selected ones.
window.WB = window.WB || {};

WB.STROKE_COLORS = ["#1f1f1f", "#6b7280", "#d64545", "#e8890c", "#2e9d4f", "#0f766e", "#2563c9", "#7c4dd6"];
WB.FILL_COLORS = ["transparent", "#fde2e2", "#fdf0a0", "#d6f5dd", "#d4e8fb", "#e6dcfb", "#ececea"];

// onChange(kind, color): kind is "strokeColor" or "fillColor"
WB.createStylePanel = function (container, onChange) {
  const rows = {
    strokeColor: createRow("Stroke", WB.STROKE_COLORS, "#1f1f1f"),
    fillColor: createRow("Background", WB.FILL_COLORS, "#fdf0a0"),
  };
  container.append(rows.strokeColor.el, rows.fillColor.el);

  // A labeled row of swatches plus a custom color picker
  function createRow(label, colors, pickerDefault) {
    const kind = label === "Stroke" ? "strokeColor" : "fillColor";
    const el = document.createElement("div");
    el.className = "style-row";
    el.innerHTML = `<div class="style-label">${label}</div><div class="swatches"></div>`;
    const swatchesEl = el.querySelector(".swatches");

    const swatches = colors.map((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = color === "transparent" ? "swatch none" : "swatch";
      swatch.style.setProperty("--swatch", color);
      swatch.title = color === "transparent" ? "No background" : color;
      swatch.dataset.color = color;
      swatch.addEventListener("click", () => onChange(kind, color));
      swatchesEl.appendChild(swatch);
      return swatch;
    });

    // Any other color, with the browser's color picker
    const custom = document.createElement("label");
    custom.className = "swatch custom";
    custom.title = "Other color";
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = pickerDefault;
    // "change" fires once the picker closes, so trying colors does not fill the undo history
    picker.addEventListener("change", () => onChange(kind, picker.value));
    custom.appendChild(picker);
    swatchesEl.appendChild(custom);

    // Marks the swatch of the current color; a color outside the palette marks the custom one
    function setValue(value) {
      let found = false;
      swatches.forEach((s) => {
        const match = value !== null && s.dataset.color.toLowerCase() === String(value).toLowerCase();
        s.classList.toggle("active", match);
        found = found || match;
      });
      const isCustom = value !== null && !found;
      custom.classList.toggle("active", isCustom);
      if (isCustom) {
        custom.style.setProperty("--swatch", value);
        picker.value = value;
      } else {
        custom.style.removeProperty("--swatch");
      }
    }

    return { el, setValue };
  }

  return {
    // state: { visible, showFill, strokeColor, fillColor }; a color is null when the selection mixes several
    update(state) {
      container.hidden = !state.visible;
      if (!state.visible) return;
      rows.fillColor.el.hidden = !state.showFill;
      rows.strokeColor.setValue(state.strokeColor);
      rows.fillColor.setValue(state.fillColor);
    },
  };
};
