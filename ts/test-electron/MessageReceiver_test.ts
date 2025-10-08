// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-empty-function */

import { assert } from 'chai';
import Long from 'long';

import MessageReceiver from '../textsecure/MessageReceiver.js';
import { IncomingWebSocketRequestLegacy } from '../textsecure/WebsocketResources.js';
import type { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents.js';
import { generateAci } from '../types/ServiceId.js';
import type { AciString } from '../types/ServiceId.js';
import { toAciObject } from '../util/ServiceId.js';
import { SignalService as Proto } from '../protobuf/index.js';
import * as Crypto from '../Crypto.js';
import { toBase64 } from '../Bytes.js';
import { signalProtocolStore } from '../SignalProtocolStore.js';

describe('MessageReceiver', () => {
  const someAci = generateAci();
  const deviceId = 1;

  let oldAci: AciString | undefined;
  let oldDeviceId: number | undefined;

  beforeEach(async () => {
    oldAci = window.storage.user.getAci();
    oldDeviceId = window.storage.user.getDeviceId();
    await window.storage.user.setAciAndDeviceId(generateAci(), 2);
    await signalProtocolStore.hydrateCaches();
  });

  afterEach(async () => {
    if (oldAci !== undefined && oldDeviceId !== undefined) {
      await window.storage.user.setAciAndDeviceId(oldAci, oldDeviceId);
    }
    await signalProtocolStore.removeAllUnprocessed();
  });

  describe('connecting', () => {
    it('generates decryption-error event when it cannot decrypt', async () => {
      const fakeTrustRootPublicKey = Crypto.getRandomBytes(33);
      fakeTrustRootPublicKey.set([5], 0); // first byte is the key type (5)

      const messageReceiver = new MessageReceiver({
        storage: window.storage,
        serverTrustRoots: [toBase64(fakeTrustRootPublicKey)],
      });

      const body = Proto.Envelope.encode({
        type: Proto.Envelope.Type.DOUBLE_RATCHET,
        sourceServiceIdBinary: toAciObject(someAci).getRawUuidBytes(),
        sourceDeviceId: deviceId,
        clientTimestamp: Long.fromNumber(Date.now()),
        content: Crypto.getRandomBytes(200),
      }).finish();

      messageReceiver.handleRequest(
        new IncomingWebSocketRequestLegacy(
          {
            id: Long.fromNumber(1),
            verb: 'PUT',
            path: '/api/v1/message',
            body,
            headers: [],
          },
          (_: Buffer): void => {}
        )
      );

      await new Promise<void>(resolve => {
        messageReceiver.addEventListener(
          'decryption-error',
          (error: DecryptionErrorEvent) => {
            assert.strictEqual(error.decryptionError.senderAci, someAci);
            assert.strictEqual(error.decryptionError.senderDevice, deviceId);
            resolve();
          }
        );
      });

      await messageReceiver.drain();
    });
  });
});
