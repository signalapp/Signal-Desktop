import Delta from 'quill-delta';

export const matchEmojiBlot = (node: HTMLElement, delta: Delta): Delta => {
  if (node.classList.contains('emoji-blot')) {
    const { emoji } = node.dataset;
    return new Delta().insert({ emoji });
  }
  if (node.classList.contains('module-emoji')) {
    const emoji = node.innerText.trim();
    return new Delta().insert({ emoji });
  }
  return delta;
};

export const matchEmojiImage = (node: Element): Delta => {
  if (node.classList.contains('emoji')) {
    const emoji = node.getAttribute('title');
    return new Delta().insert({ emoji });
  }
  return new Delta();
};
