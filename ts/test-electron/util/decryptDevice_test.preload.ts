// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { generateRegistrationId } from '../../Crypto.node.ts';
import { generateKeyPair } from '../../Curve.node.ts';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import {
  generateAci,
  generatePni,
} from '../../test-helpers/serviceIdUtils.std.ts';
import {
  _encryptDeviceCreatedAt,
  decryptDeviceCreatedAt,
  decryptDeviceName,
  encryptDeviceName,
} from '../../util/decryptDevice.preload.ts';
import { isEmpty } from '../../Bytes.std.ts';

describe('util/decryptDevice', () => {
  let sandbox: sinon.SinonSandbox;

  const ourAci = generateAci();
  const ourPni = generatePni();
  const ourRegistrationId = generateRegistrationId();
  const identityKey = generateKeyPair();

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    sandbox
      .stub(signalProtocolStore, 'getIdentityKeyPair')
      .returns(identityKey);
    sandbox
      .stub(signalProtocolStore, 'getLocalRegistrationId')
      .resolves(ourRegistrationId);
    const { user } = itemStorage;
    sandbox.stub(user, 'getAci').returns(ourAci);
    sandbox.stub(user, 'getOptionalPni').returns(ourPni);
    sandbox.stub(user, 'getServiceId').returns(ourAci);
    sandbox.stub(user, 'getCheckedAci').returns(ourAci);
    sandbox.stub(user, 'getCheckedServiceId').returns(ourAci);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('encrypted device name', () => {
    it('roundtrips', async () => {
      const deviceName = 'v2.5.0 on Ubunto 20.04';
      const encrypted = encryptDeviceName(deviceName, identityKey);
      if (!encrypted || isEmpty(encrypted)) {
        throw new Error('failed to encrypt!');
      }
      const decrypted = await decryptDeviceName(encrypted);

      assert.strictEqual(decrypted, deviceName);
    });

    it('handles falsey deviceName', () => {
      const encrypted = encryptDeviceName('', identityKey);
      assert.strictEqual(encrypted, undefined);
    });
  });

  describe('encrypted device createdAt', () => {
    it('roundtrips', async () => {
      const deviceId = 2;
      const createdAt = new Date().getTime();

      const encrypted = await _encryptDeviceCreatedAt(createdAt, deviceId);
      if (!encrypted || isEmpty(encrypted)) {
        throw new Error('failed to encrypt!');
      }

      const decrypted = await decryptDeviceCreatedAt(
        encrypted,
        ourRegistrationId,
        deviceId
      );

      assert.strictEqual(decrypted, createdAt);
    });
  });
});
