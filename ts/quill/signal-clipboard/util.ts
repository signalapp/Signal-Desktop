// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function handleCopyEvent(event: ClipboardEvent): void {
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

  // Note: we can't leave text/plain alone and just add text/signal; if we update
  //   clipboardData at all, all other data is reset.
  const plaintext = getStringFromNode(container);
  event.clipboardData?.setData('text/plain', plaintext);

  event.clipboardData?.setData('text/signal', container.innerHTML);

  event.preventDefault();
  event.stopPropagation();
}

function getStringFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  if (element.nodeName === 'IMG' && element.classList.contains('emoji')) {
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
