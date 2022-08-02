// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-empty-function */

import { assert } from 'chai';
import { v4 as getGuid } from 'uuid';
import Long from 'long';

import MessageReceiver from '../textsecure/MessageReceiver';
import { IncomingWebSocketRequest } from '../textsecure/WebsocketResources';
import type { WebAPIType } from '../textsecure/WebAPI';
import type { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents';
import { SignalService as Proto } from '../protobuf';
import * as Crypto from '../Crypto';

describe('MessageReceiver', () => {
  const uuid = 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee';
  const deviceId = 1;

  let oldUuid: string | undefined;
  let oldDeviceId: number | undefined;

  beforeEach(async () => {
    oldUuid = window.storage.user.getUuid()?.toString();
    oldDeviceId = window.storage.user.getDeviceId();
    await window.storage.user.setUuidAndDeviceId(getGuid(), 2);
    await window.storage.protocol.hydrateCaches();
  });

  afterEach(async () => {
    if (oldUuid !== undefined && oldDeviceId !== undefined) {
      await window.storage.user.setUuidAndDeviceId(oldUuid, oldDeviceId);
    }
    await window.storage.protocol.removeAllUnprocessed();
  });

  describe('connecting', () => {
    it('generates decryption-error event when it cannot decrypt', async () => {
      const messageReceiver = new MessageReceiver({
        server: {} as WebAPIType,
        storage: window.storage,
        serverTrustRoot: 'AAAAAAAA',
      });

      const body = Proto.Envelope.encode({
        type: Proto.Envelope.Type.CIPHERTEXT,
        sourceUuid: uuid,
        sourceDevice: deviceId,
        timestamp: Long.fromNumber(Date.now()),
        content: Crypto.getRandomBytes(200),
      }).finish();

      messageReceiver.handleRequest(
        new IncomingWebSocketRequest(
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
            assert.strictEqual(error.decryptionError.senderUuid, uuid);
            assert.strictEqual(error.decryptionError.senderDevice, deviceId);
            resolve();
          }
        );
      });

      await messageReceiver.drain();
    });
  });
});
