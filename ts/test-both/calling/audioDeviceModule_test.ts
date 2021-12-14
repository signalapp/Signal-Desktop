// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import {
  AudioDeviceModule,
  getAudioDeviceModule,
} from '../../calling/audioDeviceModule';

describe('audio device module', () => {
  describe('getAudioDeviceModule', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('returns ADM2 on Windows', () => {
      sandbox.stub(process, 'platform').get(() => 'win32');
      assert.strictEqual(getAudioDeviceModule(), AudioDeviceModule.WindowsAdm2);
    });

    it('returns the default module on macOS', () => {
      sandbox.stub(process, 'platform').get(() => 'darwin');
      assert.strictEqual(getAudioDeviceModule(), AudioDeviceModule.Default);
    });

    it('returns the default module on Linux', () => {
      sandbox.stub(process, 'platform').get(() => 'linux');
      assert.strictEqual(getAudioDeviceModule(), AudioDeviceModule.Default);
    });
  });
});
