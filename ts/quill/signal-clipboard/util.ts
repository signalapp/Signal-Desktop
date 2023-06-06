// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const QUILL_EMBED_GUARD = '\uFEFF';

export function createEventHandler({
  deleteSelection,
}: {
  deleteSelection: boolean;
}) {
  return (event: ClipboardEvent): void => {
    // If we're attempting to cut, and focus is not in one of our composer elements, we
    //   let the browser do its default behavior. We don't need formatting from them.
    if (deleteSelection) {
      const { activeElement } = document;
      if (
        !activeElement ||
        activeElement.matches('input, textarea') ||
        !activeElement.closest('[contenteditable=true]')
      ) {
        return;
      }
    }

    if (!event.clipboardData) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    // Create synthetic html with the full selection we can put into clipboard
    const container = document.createElement('div');
    for (let i = 0, max = selection.rangeCount; i < max; i += 1) {
      const range = selection.getRangeAt(i);
      container.appendChild(range.cloneContents());
    }

    // We fail over to selection.toString() because we can't pull values from the DOM if
    //   the selection is within an <input/> or <textarea/>. But the browser can!
    const plaintext = getStringFromNode(container) || selection.toString();
    // Note: we can't leave text/plain alone and just add text/signal; if we update
    //   clipboardData at all, all other data is reset.
    event.clipboardData?.setData('text/plain', plaintext);

    event.clipboardData?.setData('text/signal', container.innerHTML);

    if (deleteSelection) {
      selection.deleteFromDocument();
    }

    event.preventDefault();
    event.stopPropagation();
  };
}

function getStringFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent === QUILL_EMBED_GUARD) {
      return '';
    }
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  if (
    element.nodeName === 'IMG' &&
    (element.classList.contains('emoji') ||
      element.classList.contains('emoji-blot'))
  ) {
    return element.ariaLabel || '';
  }
  if (element.nodeName === 'BR') {
    return '\n';
  }
  if (element.childNodes.length === 0) {
    return element.textContent || '';
  }
  let result = '';
  for (const child of element.childNodes) {
    result += getStringFromNode(child);
  }
  if (
    element.nodeName === 'P' ||
    element.nodeName === 'DIV' ||
    element.nodeName === 'TIME'
  ) {
    if (result.length > 0 && !result.endsWith('\n\n')) {
      result += '\n';
    }
  }
  return result;
}
