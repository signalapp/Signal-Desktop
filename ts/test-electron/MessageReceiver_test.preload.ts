// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';

import MessageReceiver from '../textsecure/MessageReceiver.preload.js';
import {
  IncomingWebSocketRequest,
  ServerRequestType,
} from '../textsecure/WebsocketResources.preload.js';
import type { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import type { AciString } from '../types/ServiceId.std.js';
import { toAciObject } from '../util/ServiceId.node.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import * as Crypto from '../Crypto.node.js';
import { toBase64 } from '../Bytes.std.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

describe('MessageReceiver', () => {
  const someAci = generateAci();
  const deviceId = 1;

  let oldAci: AciString | undefined;
  let oldDeviceId: number | undefined;

  beforeEach(async () => {
    oldAci = itemStorage.user.getAci();
    oldDeviceId = itemStorage.user.getDeviceId();
    await itemStorage.user.setAciAndDeviceId(generateAci(), 2);
    await signalProtocolStore.hydrateCaches();
  });

  afterEach(async () => {
    if (oldAci !== undefined && oldDeviceId !== undefined) {
      await itemStorage.user.setAciAndDeviceId(oldAci, oldDeviceId);
    }
    await signalProtocolStore.removeAllUnprocessed();
  });

  describe('connecting', () => {
    it('generates decryption-error event when it cannot decrypt', async () => {
      const fakeTrustRootPublicKey = Crypto.getRandomBytes(33);
      fakeTrustRootPublicKey.set([5], 0); // first byte is the key type (5)

      const messageReceiver = new MessageReceiver({
        storage: itemStorage,
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
        new IncomingWebSocketRequest(
          ServerRequestType.ApiMessage,
          body,
          Date.now(),
          {
            async send() {
              // no-op
            },
          }
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
