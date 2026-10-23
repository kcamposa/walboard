// Style panel: stroke and background colors, for the next shape or for the selected ones.
window.WB = window.WB || {};

// Palettes: neutrals first, then the hues in rainbow order. 14 colors + the custom one = 3 rows of 5
WB.STROKE_COLORS = [
  "#1f1f1f", "#4b5563", "#9ca3af", "#d64545", "#db2777",
  "#e8890c", "#c99a06", "#8b5e34", "#2e9d4f", "#0f766e",
  "#0891b2", "#2563c9", "#4338ca", "#7c4dd6",
];
// Soft tones that keep dark text readable on top
WB.FILL_COLORS = [
  "transparent", "#ffffff", "#ececea", "#fde2e2", "#fce7f3",
  "#ffe8cc", "#fdf0a0", "#f3e4d3", "#d6f5dd", "#ccf0eb",
  "#cff1f8", "#d4e8fb", "#e0e1fb", "#e6dcfb",
];

// "#2563c9", "2563c9" or the short "#f0a" → "#2563c9" / "#ff00aa"; anything else → null
function normalizeHex(text) {
  const hex = text.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((c) => c + c).join("")}`;
  return null;
}

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

    // Hex code field: shows the current color and accepts a typed one (Enter or clicking outside)
    const hexField = document.createElement("label");
    hexField.className = "hex-field";
    hexField.innerHTML = `<span>#</span><input type="text" maxlength="7" spellcheck="false" placeholder="${kind === "fillColor" ? "none" : "hex"}" />`;
    const hexInput = hexField.querySelector("input");
    let shownValue = null;
    hexInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") hexInput.blur();
    });
    hexInput.addEventListener("blur", () => {
      const color = normalizeHex(hexInput.value);
      if (color && color !== shownValue) onChange(kind, color);
      else showHex(shownValue); // invalid or unchanged: back to the current color
    });
    el.appendChild(hexField);

    function showHex(value) {
      hexInput.value = value && value !== "transparent" ? value.replace(/^#/, "") : "";
    }

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
      shownValue = value;
      // Not while the user is typing in it
      if (document.activeElement !== hexInput) showHex(value);
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
