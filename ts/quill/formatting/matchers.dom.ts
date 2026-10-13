// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import type { AttributeMap } from '@signalapp/quill-cjs';

import { QuillFormattingStyle } from './menu.dom.tsx';
import type { Matcher } from '../util.dom.ts';

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

function isMonospaceElement(node: HTMLElement): boolean {
  if (node.matches('[data-monospace]')) {
    return true;
  }
  const style = window.getComputedStyle(node);
  const fonts = style.getPropertyValue('font-family');
  return fonts.includes('monospace');
}

export const matchMonospace: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
  if (delta.length() > 0 && isMonospaceElement(node)) {
    return applyStyleToOps(delta, QuillFormattingStyle.monospace, attributes);
  }

  return delta;
};

function isSpoilerElement(node: HTMLElement): boolean {
  return node.matches('[data-spoiler]');
}

export const matchSpoiler: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
  if (delta.length() > 0 && isSpoilerElement(node)) {
    return applyStyleToOps(delta, QuillFormattingStyle.spoiler, attributes);
  }
  return delta;
};
