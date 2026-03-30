// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import MessageReceiver from '../textsecure/MessageReceiver.preload.ts';
import {
  IncomingWebSocketRequest,
  ServerRequestType,
} from '../textsecure/WebsocketResources.preload.ts';
import type { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents.std.ts';
import { generateAci } from '../types/ServiceId.std.ts';
import type { AciString } from '../types/ServiceId.std.ts';
import { toAciObject } from '../util/ServiceId.node.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import * as Crypto from '../Crypto.node.ts';
import { toBase64 } from '../Bytes.std.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

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
        sourceServiceId: null,
        sourceServiceIdBinary: toAciObject(someAci).getRawUuidBytes(),
        sourceDeviceId: deviceId,
        clientTimestamp: BigInt(Date.now()),
        content: Crypto.getRandomBytes(200),
        destinationServiceId: null,
        destinationServiceIdBinary: null,
        serverGuid: null,
        serverGuidBinary: null,
        serverTimestamp: null,
        ephemeral: null,
        urgent: null,
        updatedPni: null,
        story: null,
        reportSpamToken: null,
        updatedPniBinary: null,
      });

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
