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
        !activeElement.closest('[contenteditable=plaintext-only]')
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
      container.appendChild(getRangeWithContainer(range));
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

function getStringFromNode(
  node: Node,
  parent?: Node,
  nextSibling?: Node
): string {
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

  // Sometimes we need to add multiple newlines to represent nested divs, and other times
  //   we only want to add a newline if we know there's another node after this.
  const shouldAddNewline =
    parent && (nextSibling || parent.childNodes.length === 1);

  if (shouldAddNewline && element.nodeName === 'BR') {
    return '\n';
  }
  const childCount = element.childNodes.length;
  if (childCount === 0) {
    return element.textContent || '';
  }
  let result = '';
  for (let i = 0; i < childCount; i += 1) {
    const child = element.childNodes[i];
    const nextChild = element.childNodes[i + 1];
    result += getStringFromNode(child, node, nextChild);
  }

  if (
    shouldAddNewline &&
    (element.nodeName === 'P' ||
      element.nodeName === 'DIV' ||
      element.nodeName === 'TIME')
  ) {
    if (result.length > 0 && result !== '\n' && !result.endsWith('\n\n')) {
      result += '\n';
    }
  }
  return result;
}

const CONTAINER_CLASSES = ['ql-editor', 'module-message__text'];
const BOLD_TAG = 'strong';
const ITALIC_TAG = 'em';
const STRIKETHROUGH_TAG = 's';
const MONOSPACE_CLASSES = [
  'quill--monospace',
  'MessageTextRenderer__formatting--monospace',
];
const SPOILER_CLASSES = [
  'quill--spoiler',
  'MessageTextRenderer__formatting--spoiler',
  'MessageTextRenderer__formatting--spoiler--revealed',
];

// When the user cuts/copies single-line text which don't cross any mentions/emojo or
// formatting boundaries, we don't get the surrounding formatting nodes in our selection.
// So, we need to walk the DOM and re-create those containing nodes.
function getRangeWithContainer(range: Range): Node {
  const fragment = range.cloneContents();

  // We're talking about HTML that might look like this, from the composer:

  // <div class="ql-editor ql-editor--loaded" contenteditable="plaintext-only" ... >
  //   <div dir="auto">
  //     <strong>
  //       <em>
  //         <s>
  //           <span class="quill--spoiler">
  //             <span class="quill--monospace">
  //               All formatting, with no formatting boundaries, mentions or emoji.
  //             </span>
  //           </span>
  //         </s>
  //       </em>
  //     </strong>
  //   </div>
  // </div>

  // Or like this, from a message bubble:

  // <div class="module-message__text module-message__text--outgoing">
  //   <span>
  //     <span class="MessageTextRenderer__formatting--spoiler--revealed">
  //       <span class="MessageTextRenderer__formatting--monospace">
  //         <s>
  //           <em>
  //             <strong>
  //               All formatting, with no formatting boundaries, mentions or emoji.
  //             </strong>
  //           </em>
  //         </s>
  //       </span>
  //     </span>
  //   </span>
  //   <span style="display: inline-block; width: 75.7656px;"></span>
  // </div>

  // If the range spans multiple elements, we don't have to worry about this
  const { startContainer, endContainer } = range;
  if (startContainer !== endContainer) {
    return fragment;
  }

  let currentNode: Element | null;
  if (startContainer.nodeType !== Node.TEXT_NODE) {
    return fragment;
  }

  if (fragment.childNodes.length > 1) {
    return fragment;
  }
  let finalNode = fragment.childNodes.item(0);
  if (!finalNode) {
    return fragment;
  }

  currentNode = startContainer.parentElement as HTMLElement;
  while (
    currentNode &&
    // eslint-disable-next-line no-loop-func
    CONTAINER_CLASSES.every(item => !currentNode?.classList.contains(item))
  ) {
    const tagName = currentNode.tagName.toLowerCase();
    if (tagName === BOLD_TAG) {
      const newNode = document.createElement(BOLD_TAG);
      newNode.appendChild(finalNode);
      finalNode = newNode;
    } else if (tagName === ITALIC_TAG) {
      const newNode = document.createElement(ITALIC_TAG);
      newNode.appendChild(finalNode);
      finalNode = newNode;
    } else if (tagName === STRIKETHROUGH_TAG) {
      const newNode = document.createElement(STRIKETHROUGH_TAG);
      newNode.appendChild(finalNode);
      finalNode = newNode;
    } else if (
      // eslint-disable-next-line no-loop-func
      MONOSPACE_CLASSES.some(item => currentNode?.classList.contains(item))
    ) {
      const newNode = document.createElement('span');
      // Matchers check for all classes, so we just add the first
      newNode.classList.add(MONOSPACE_CLASSES[0]);
      newNode.appendChild(finalNode);
      finalNode = newNode;
    } else if (
      // eslint-disable-next-line no-loop-func
      SPOILER_CLASSES.some(item => currentNode?.classList.contains(item))
    ) {
      const newNode = document.createElement('span');
      // Matchers check for all classes, so we just add the first
      newNode.classList.add(SPOILER_CLASSES[0]);
      newNode.appendChild(finalNode);
      finalNode = newNode;
    }

    currentNode = currentNode.parentElement;
  }

  fragment.replaceChildren(finalNode);
  return fragment;
}
