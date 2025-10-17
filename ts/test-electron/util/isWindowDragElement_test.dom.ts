// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isWindowDragElement } from '../../util/isWindowDragElement.std.js';

describe('isWindowDragElement', () => {
  const crel = (tagName: string, appRegion?: string): Element => {
    const result = document.createElement(tagName);
    if (appRegion) {
      result.style.cssText = `-webkit-app-region: ${appRegion}`;
    }
    return result;
  };

  let sandboxEl: HTMLElement;

  beforeEach(() => {
    sandboxEl = document.createElement('div');
    document.body.appendChild(sandboxEl);
  });

  afterEach(() => {
    sandboxEl.remove();
  });

  it('returns false for elements with no -webkit-app-region property in the heirarchy', () => {
    const root = crel('div');
    const outer = crel('span');
    const inner = crel('div');
    root.appendChild(outer);
    outer.appendChild(inner);
    sandboxEl.appendChild(root);

    assert.isFalse(isWindowDragElement(root));
    assert.isFalse(isWindowDragElement(outer));
    assert.isFalse(isWindowDragElement(inner));
  });

  it('returns false for elements with -webkit-app-region: drag on a sub-element', () => {
    const parent = crel('div');
    const child = crel('div', 'drag');
    parent.appendChild(child);
    sandboxEl.appendChild(parent);

    assert.isFalse(isWindowDragElement(parent));
  });

  it('returns false if any element up the chain is found to be -webkit-app-region: no-drag', () => {
    const root = crel('div', 'drag');
    const outer = crel('div', 'no-drag');
    const inner = crel('div');
    root.appendChild(outer);
    outer.appendChild(inner);
    sandboxEl.appendChild(root);

    assert.isFalse(isWindowDragElement(outer));
    assert.isFalse(isWindowDragElement(inner));
  });

  it('returns true if any element up the chain is found to be -webkit-app-region: drag', () => {
    const root = crel('div', 'drag');
    const outer = crel('div');
    const inner = crel('div');
    root.appendChild(outer);
    outer.appendChild(inner);
    sandboxEl.appendChild(root);

    assert.isTrue(isWindowDragElement(root));
    assert.isTrue(isWindowDragElement(outer));
    assert.isTrue(isWindowDragElement(inner));
  });
});
