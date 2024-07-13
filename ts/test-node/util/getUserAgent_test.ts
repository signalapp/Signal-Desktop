// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { getUserAgent } from '../../util/getUserAgent';

describe('getUserAgent', () => {
  beforeEach(function (this: Mocha.Context) {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();
  });

  it('returns the right User-Agent on Windows', function (this: Mocha.Context) {
    this.sandbox.stub(process, 'platform').get(() => 'win32');
    assert.strictEqual(
      getUserAgent('1.2.3', '10.0.22000'),
      'Signal-Desktop/1.2.3 Windows 10.0.22000'
    );
  });

  it('returns the right User-Agent on macOS', function (this: Mocha.Context) {
    this.sandbox.stub(process, 'platform').get(() => 'darwin');
    assert.strictEqual(
      getUserAgent('1.2.3', '21.5.0'),
      'Signal-Desktop/1.2.3 macOS 21.5.0'
    );
  });

  it('returns the right User-Agent on Linux', function (this: Mocha.Context) {
    this.sandbox.stub(process, 'platform').get(() => 'linux');
    assert.strictEqual(
      getUserAgent('1.2.3', '20.04'),
      'Signal-Desktop/1.2.3 Linux 20.04'
    );
  });

  it('omits the platform on unsupported platforms', function (this: Mocha.Context) {
    this.sandbox.stub(process, 'platform').get(() => 'freebsd');
    assert.strictEqual(getUserAgent('1.2.3', '13.1'), 'Signal-Desktop/1.2.3');
  });
});
