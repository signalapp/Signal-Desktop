// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { scrollToBottom } from '../util/scrollToBottom';

describe('scrollToBottom', () => {
  let sandbox: HTMLDivElement;

  beforeEach(() => {
    sandbox = document.createElement('div');
    document.body.appendChild(sandbox);
  });

  afterEach(() => {
    sandbox.remove();
  });

  it("sets the element's scrollTop to the element's scrollHeight", () => {
    const el = document.createElement('div');
    el.innerText = 'a'.repeat(50000);
    Object.assign(el.style, {
      height: '50px',
      overflow: 'scroll',
      whiteSpace: 'wrap',
      width: '100px',
      wordBreak: 'break-word',
    });
    sandbox.appendChild(el);

    assert.strictEqual(
      el.scrollTop,
      0,
      'Test is not set up correctly. Element is already scrolled'
    );
    assert.isAtLeast(
      el.scrollHeight,
      50,
      'Test is not set up correctly. scrollHeight is too low'
    );

    scrollToBottom(el);

    assert.isAtLeast(el.scrollTop, el.scrollHeight - 50);
  });
});
