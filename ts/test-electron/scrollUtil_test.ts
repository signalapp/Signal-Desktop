// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getScrollBottom,
  scrollToBottom,
  setScrollBottom,
} from '../util/scrollUtil';

describe('scroll utilities', () => {
  let sandbox: HTMLDivElement;
  let el: HTMLDivElement;

  // These tests to be flaky on Windows CI, sometimes timing out. That doesn't really
  //   make sense because the test is synchronous, but this quick-and-dirty fix is
  //   probably better than a full investigation.
  before(function (this: Mocha.Context) {
    if (process.platform === 'win32') {
      this.skip();
    }
  });

  beforeEach(() => {
    sandbox = document.createElement('div');
    document.body.appendChild(sandbox);

    el = document.createElement('div');
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
  });

  afterEach(() => {
    sandbox.remove();
  });

  describe('getScrollBottom', () => {
    it('gets the distance from the bottom', () => {
      assert.strictEqual(
        getScrollBottom(el),
        el.scrollHeight - el.clientHeight
      );

      el.scrollTop = 999999;

      assert.strictEqual(getScrollBottom(el), 0);
    });
  });

  describe('setScrollBottom', () => {
    it('sets the distance from the bottom', () => {
      setScrollBottom(el, 12);
      assert.strictEqual(getScrollBottom(el), 12);

      setScrollBottom(el, 9999999);
      assert.strictEqual(el.scrollTop, 0);
    });
  });

  describe('scrollToBottom', () => {
    it("sets the element's scrollTop to the element's scrollHeight", () => {
      scrollToBottom(el);

      assert.isAtLeast(el.scrollTop, el.scrollHeight - 50);
    });
  });
});
