// Text editor: a textarea placed over the canvas while the user types.
// Editing finishes when the textarea loses focus (clicking anywhere else).
window.WB = window.WB || {};

WB.LINE_HEIGHT = 1.25; // relative to the font size

// options: { x, y, fontSize, color, text, onCommit(text) }
WB.openTextEditor = function (options) {
  const textarea = document.createElement("textarea");
  textarea.className = "text-editor";
  textarea.value = options.text || "";
  textarea.spellcheck = false;
  Object.assign(textarea.style, {
    left: `${options.x}px`,
    top: `${options.y}px`,
    fontSize: `${options.fontSize}px`,
    lineHeight: String(WB.LINE_HEIGHT),
    color: options.color,
  });
  document.body.appendChild(textarea);

  // Grows with the content, so the text never wraps or scrolls
  function autosize() {
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.width = `${textarea.scrollWidth + options.fontSize}px`;
    textarea.style.height = `${textarea.scrollHeight}px`;
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

  return { commit };
};
