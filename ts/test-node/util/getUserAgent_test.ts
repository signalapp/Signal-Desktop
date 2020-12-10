// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { getUserAgent } from '../../util/getUserAgent';

describe('getUserAgent', () => {
  beforeEach(function beforeEach() {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function afterEach() {
    this.sandbox.restore();
  });

  it('returns the right User-Agent on Windows', function test() {
    this.sandbox.stub(process, 'platform').get(() => 'win32');
    assert.strictEqual(getUserAgent('1.2.3'), 'Signal-Desktop/1.2.3 Windows');
  });

  it('returns the right User-Agent on macOS', function test() {
    this.sandbox.stub(process, 'platform').get(() => 'darwin');
    assert.strictEqual(getUserAgent('1.2.3'), 'Signal-Desktop/1.2.3 macOS');
  });

  it('returns the right User-Agent on Linux', function test() {
    this.sandbox.stub(process, 'platform').get(() => 'linux');
    assert.strictEqual(getUserAgent('1.2.3'), 'Signal-Desktop/1.2.3 Linux');
  });

  it('omits the platform on unsupported platforms', function test() {
    this.sandbox.stub(process, 'platform').get(() => 'freebsd');
    assert.strictEqual(getUserAgent('1.2.3'), 'Signal-Desktop/1.2.3');
  });
});
