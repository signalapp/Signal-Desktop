// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import { QuillFormattingStyle } from './menu';

function applyStyleToOps(delta: Delta, style: QuillFormattingStyle): Delta {
  return new Delta(
    delta.map(op => ({
      ...op,
      attributes: {
        ...op.attributes,
        [style]: true,
      },
    }))
  );
}

export const matchBold = (_node: HTMLElement, delta: Delta): Delta => {
  if (delta.length() > 0) {
    return applyStyleToOps(delta, QuillFormattingStyle.bold);
  }

  return delta;
};

export const matchItalic = (_node: HTMLElement, delta: Delta): Delta => {
  if (delta.length() > 0) {
    return applyStyleToOps(delta, QuillFormattingStyle.italic);
  }

  return delta;
};

export const matchStrikethrough = (_node: HTMLElement, delta: Delta): Delta => {
  if (delta.length() > 0) {
    return applyStyleToOps(delta, QuillFormattingStyle.strike);
  }

  return delta;
};

export const matchMonospace = (node: HTMLElement, delta: Delta): Delta => {
  const classes = [
    'MessageTextRenderer__formatting--monospace',
    'quill--monospace',
  ];
  // Note: This is defined as $monospace in _variables.scss
  const fontFamily =
    'font-family: "SF Mono", SFMono-Regular, ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace;';

  if (
    delta.length() > 0 &&
    (node.classList.contains(classes[0]) ||
      node.classList.contains(classes[1]) ||
      node.attributes.getNamedItem('style')?.value?.includes(fontFamily))
  ) {
    return applyStyleToOps(delta, QuillFormattingStyle.monospace);
  }

  return delta;
};

export const matchSpoiler = (node: HTMLElement, delta: Delta): Delta => {
  const classes = [
    'quill--spoiler',
    'MessageTextRenderer__formatting--spoiler',
    'MessageTextRenderer__formatting--spoiler--revealed',
  ];

  if (
    delta.length() > 0 &&
    (node.classList.contains(classes[0]) ||
      node.classList.contains(classes[1]) ||
      node.classList.contains(classes[2]))
  ) {
    return applyStyleToOps(delta, QuillFormattingStyle.spoiler);
  }
  return delta;
};
