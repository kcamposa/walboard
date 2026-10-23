// Text editor: a textarea placed over the canvas while the user types.
// Editing finishes when the textarea loses focus (clicking anywhere else).
window.WB = window.WB || {};

WB.LINE_HEIGHT = 1.25; // relative to the font size

// options: { container, x, y, fontSize, color, text, onCommit(text),
//            width, align, bold, italic, underline, strike, reposition(height) }
//   x / y are relative to the container.
//   width (optional): fixed width with automatic line breaks (text inside shapes); otherwise it grows with the text.
//   reposition (optional): called when the height changes, returns the new { x, y }
WB.openTextEditor = function (options) {
  const textarea = document.createElement("textarea");
  textarea.className = options.width ? "text-editor wrap" : "text-editor";
  textarea.value = options.text || "";
  textarea.spellcheck = false;
  Object.assign(textarea.style, { left: `${options.x}px`, top: `${options.y}px`, lineHeight: String(WB.LINE_HEIGHT) });

  function applyStyle() {
    const decorations = [options.underline && "underline", options.strike && "line-through"].filter(Boolean);
    Object.assign(textarea.style, {
      fontSize: `${options.fontSize}px`,
      color: options.color,
      textAlign: options.align || "left",
      fontWeight: options.bold ? "bold" : "normal",
      fontStyle: options.italic ? "italic" : "normal",
      textDecoration: decorations.join(" ") || "none",
    });
  }
  applyStyle();
  options.container.appendChild(textarea);

  // Grows with the content, so the text never scrolls
  function autosize() {
    textarea.style.width = options.width ? `${options.width}px` : "1px";
    textarea.style.height = "1px";
    if (!options.width) textarea.style.width = `${textarea.scrollWidth + options.fontSize}px`;
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (options.reposition) {
      const position = options.reposition(textarea.scrollHeight);
      textarea.style.left = `${position.x}px`;
      textarea.style.top = `${position.y}px`;
    }
  }
  textarea.addEventListener("input", autosize);
  autosize();

  let closed = false;
  function commit() {
    if (closed) return;
    closed = true;
    const text = textarea.value.replace(/\s+$/, "");
    textarea.remove();
    options.onCommit(text);
  }
  textarea.addEventListener("blur", commit);

  // Focus after the current click finishes, otherwise the click itself would take the focus away
  setTimeout(() => textarea.focus(), 0);

  return {
    commit,
    // Changes the look while typing (size, color, alignment, font styles)
    update(changes) {
      Object.assign(options, changes);
      applyStyle();
      autosize();
    },
  };
};
