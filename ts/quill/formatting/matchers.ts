// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import type { AttributeMap } from '@signalapp/quill-cjs';

import { QuillFormattingStyle } from './menu';
import type { Matcher } from '../util';

function applyStyleToOps(
  delta: Delta,
  style: QuillFormattingStyle,
  attributes: AttributeMap
): Delta {
  return new Delta(
    delta.map(op => ({
      ...op,
      attributes: {
        ...attributes,
        ...op.attributes,
        [style]: true,
      },
    }))
  );
}

export const matchBold: Matcher = (
  _node,
  delta,
  _scroll,
  attributes: AttributeMap
): Delta => {
  if (delta.length() > 0) {
    return applyStyleToOps(delta, QuillFormattingStyle.bold, attributes);
  }

  return delta;
};

export const matchItalic: Matcher = (
  _node: HTMLElement,
  delta: Delta,
  _scroll,
  attributes: AttributeMap
): Delta => {
  if (delta.length() > 0) {
    return applyStyleToOps(delta, QuillFormattingStyle.italic, attributes);
  }

  return delta;
};

export const matchStrikethrough: Matcher = (
  _node,
  delta,
  _scroll,
  attributes
): Delta => {
  if (delta.length() > 0) {
    return applyStyleToOps(delta, QuillFormattingStyle.strike, attributes);
  }

  return delta;
};

export const matchMonospace: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
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
    return applyStyleToOps(delta, QuillFormattingStyle.monospace, attributes);
  }

  return delta;
};

export const matchSpoiler: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
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
    return applyStyleToOps(delta, QuillFormattingStyle.spoiler, attributes);
  }
  return delta;
};
