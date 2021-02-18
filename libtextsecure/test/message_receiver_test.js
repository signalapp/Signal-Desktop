// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global libsignal, textsecure */

describe('MessageReceiver', () => {
  const { WebSocket } = window;
  const number = '+19999999999';
  const uuid = 'AAAAAAAA-BBBB-4CCC-9DDD-EEEEEEEEEEEE';
  const deviceId = 1;
  const signalingKey = libsignal.crypto.getRandomBytes(32 + 20);

  before(() => {
    localStorage.clear();
    window.WebSocket = MockSocket;
    textsecure.storage.user.setNumberAndDeviceId(number, deviceId, 'name');
    textsecure.storage.user.setUuidAndDeviceId(uuid, deviceId);
    textsecure.storage.put('password', 'password');
    textsecure.storage.put('signaling_key', signalingKey);
  });
  after(() => {
    localStorage.clear();
    window.WebSocket = WebSocket;
  });

  describe('connecting', () => {
    let attrs;
    let websocketmessage;

    before(() => {
      attrs = {
        type: textsecure.protobuf.Envelope.Type.CIPHERTEXT,
        source: number,
        sourceUuid: uuid,
        sourceDevice: deviceId,
        timestamp: Date.now(),
        content: libsignal.crypto.getRandomBytes(200),
      };
      const body = new textsecure.protobuf.Envelope(attrs).toArrayBuffer();

      websocketmessage = new textsecure.protobuf.WebSocketMessage({
        type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
        request: { verb: 'PUT', path: '/api/v1/message', body },
      });
    });

    it('generates light-session-reset event when it cannot decrypt', done => {
      const mockServer = new MockServer('ws://localhost:8081/');

      mockServer.on('connection', server => {
        setTimeout(() => {
          server.send(new Blob([websocketmessage.toArrayBuffer()]));
        }, 1);
      });

      const messageReceiver = new textsecure.MessageReceiver(
        'oldUsername',
        'username',
        'password',
        'signalingKey',
        {
          serverTrustRoot: 'AAAAAAAA',
        }
      );

      messageReceiver.addEventListener('light-session-reset', done());
    });
  });

  describe('methods', () => {
    let messageReceiver;
    let mockServer;

    beforeEach(() => {
      // Necessary to populate the server property inside of MockSocket. Without it, we
      //   crash when doing any number of things to a MockSocket instance.
      mockServer = new MockServer('ws://localhost:8081');

      messageReceiver = new textsecure.MessageReceiver(
        'oldUsername',
        'username',
        'password',
        'signalingKey',
        {
          serverTrustRoot: 'AAAAAAAA',
        }
      );
    });
    afterEach(() => {
      mockServer.close();
    });

    describe('#isOverHourIntoPast', () => {
      it('returns false for now', () => {
        assert.isFalse(messageReceiver.isOverHourIntoPast(Date.now()));
      });
      it('returns false for 5 minutes ago', () => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        assert.isFalse(messageReceiver.isOverHourIntoPast(fiveMinutesAgo));
      });
      it('returns true for 65 minutes ago', () => {
        const sixtyFiveMinutesAgo = Date.now() - 65 * 60 * 1000;
        assert.isTrue(messageReceiver.isOverHourIntoPast(sixtyFiveMinutesAgo));
      });
    });

    describe('#cleanupSessionResets', () => {
      it('leaves empty object alone', () => {
        window.storage.put('sessionResets', {});
        messageReceiver.cleanupSessionResets();
        const actual = window.storage.get('sessionResets');

        const expected = {};
        assert.deepEqual(actual, expected);
      });
      it('filters out any timestamp older than one hour', () => {
        const startValue = {
          one: Date.now() - 1,
          two: Date.now(),
          three: Date.now() - 65 * 60 * 1000,
        };
        window.storage.put('sessionResets', startValue);
        messageReceiver.cleanupSessionResets();
        const actual = window.storage.get('sessionResets');

        const expected = window._.pick(startValue, ['one', 'two']);
        assert.deepEqual(actual, expected);
      });
      it('filters out falsey items', () => {
        const startValue = {
          one: 0,
          two: false,
          three: Date.now(),
        };
        window.storage.put('sessionResets', startValue);
        messageReceiver.cleanupSessionResets();
        const actual = window.storage.get('sessionResets');

        const expected = window._.pick(startValue, ['three']);
        assert.deepEqual(actual, expected);
      });
    });
  });
});
