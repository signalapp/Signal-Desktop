// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable
     class-methods-use-this,
     @typescript-eslint/no-empty-function
     */

import { assert } from 'chai';
import EventEmitter from 'events';
import { connection as WebSocket } from 'websocket';

import MessageReceiver from '../textsecure/MessageReceiver';
import { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents';
import { SignalService as Proto } from '../protobuf';
import * as Crypto from '../Crypto';

// TODO: remove once we move away from ArrayBuffers
const FIXMEU8 = Uint8Array;

describe('MessageReceiver', () => {
  class FakeSocket extends EventEmitter {
    public sendBytes(_: Uint8Array) {}

    public close() {}
  }

  const number = '+19999999999';
  const uuid = 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee';
  const deviceId = 1;

  describe('connecting', () => {
    it('generates decryption-error event when it cannot decrypt', done => {
      const socket = new FakeSocket();

      const messageReceiver = new MessageReceiver(
        'oldUsername.2',
        'username.2',
        'password',
        {
          serverTrustRoot: 'AAAAAAAA',
          socket: socket as WebSocket,
        }
      );

      const body = Proto.Envelope.encode({
        type: Proto.Envelope.Type.CIPHERTEXT,
        source: number,
        sourceUuid: uuid,
        sourceDevice: deviceId,
        timestamp: Date.now(),
        content: new FIXMEU8(Crypto.getRandomBytes(200)),
      }).finish();

      const message = Proto.WebSocketMessage.encode({
        type: Proto.WebSocketMessage.Type.REQUEST,
        request: { id: 1, verb: 'PUT', path: '/api/v1/message', body },
      }).finish();

      socket.emit('message', {
        type: 'binary',
        binaryData: message,
      });

      messageReceiver.addEventListener(
        'decryption-error',
        (error: DecryptionErrorEvent) => {
          assert.strictEqual(error.decryptionError.senderUuid, uuid);
          assert.strictEqual(error.decryptionError.senderDevice, deviceId);
          done();
        }
      );
    });
  });
});
