/** Wires every `[data-copy]` button (or one whose `data-copy-from` points at an element) to the clipboard. */
export function initCopyButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('button[data-copy], button[data-copy-from]').forEach((button) => {
    if (button.dataset.copyBound) return;
    button.dataset.copyBound = '1';
    const label = button.textContent ?? 'Copy';
    button.addEventListener('click', async () => {
      const source = button.dataset.copyFrom ? document.getElementById(button.dataset.copyFrom) : null;
      const text = button.dataset.copy ?? source?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied!';
      } catch {
        button.textContent = 'Press Ctrl+C';
      }
      window.setTimeout(() => (button.textContent = label), 1600);
    });
  });
}
