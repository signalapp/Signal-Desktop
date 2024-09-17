// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-empty-function */

import { assert } from 'chai';
import Long from 'long';

import MessageReceiver from '../textsecure/MessageReceiver';
import { IncomingWebSocketRequestLegacy } from '../textsecure/WebsocketResources';
import type { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents';
import { generateAci } from '../types/ServiceId';
import type { AciString } from '../types/ServiceId';
import { SignalService as Proto } from '../protobuf';
import * as Crypto from '../Crypto';

describe('MessageReceiver', () => {
  const someAci = generateAci();
  const deviceId = 1;

  let oldAci: AciString | undefined;
  let oldDeviceId: number | undefined;

  beforeEach(async () => {
    oldAci = window.storage.user.getAci();
    oldDeviceId = window.storage.user.getDeviceId();
    await window.storage.user.setAciAndDeviceId(generateAci(), 2);
    await window.storage.protocol.hydrateCaches();
  });

  afterEach(async () => {
    if (oldAci !== undefined && oldDeviceId !== undefined) {
      await window.storage.user.setAciAndDeviceId(oldAci, oldDeviceId);
    }
    await window.storage.protocol.removeAllUnprocessed();
  });

  describe('connecting', () => {
    it('generates decryption-error event when it cannot decrypt', async () => {
      const messageReceiver = new MessageReceiver({
        storage: window.storage,
        serverTrustRoot: 'AAAAAAAA',
      });

      const body = Proto.Envelope.encode({
        type: Proto.Envelope.Type.CIPHERTEXT,
        sourceServiceId: someAci,
        sourceDevice: deviceId,
        timestamp: Long.fromNumber(Date.now()),
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
