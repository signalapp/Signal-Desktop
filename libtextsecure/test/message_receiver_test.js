/* global libsignal, textsecure, SignalProtocolStore */

describe('MessageReceiver', () => {
  textsecure.storage.impl = new SignalProtocolStore();
  const { WebSocket } = window;
  const number = '+19999999999';
  const deviceId = 1;
  const signalingKey = libsignal.crypto.getRandomBytes(32 + 20);

  before(() => {
    window.WebSocket = MockSocket;
    textsecure.storage.user.setNumberAndDeviceId(number, deviceId, 'name');
    textsecure.storage.put('password', 'password');
    textsecure.storage.put('signaling_key', signalingKey);
  });
  after(() => {
    window.WebSocket = WebSocket;
  });

  describe('connecting', () => {
    const attrs = {
      type: textsecure.protobuf.Envelope.Type.CIPHERTEXT,
      source: number,
      sourceDevice: deviceId,
      timestamp: Date.now(),
    };
    const websocketmessage = new textsecure.protobuf.WebSocketMessage({
      type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
      request: { verb: 'PUT', path: '/messages' },
    });

    before(done => {
      const signal = new textsecure.protobuf.Envelope(attrs).toArrayBuffer();

      const aesKey = signalingKey.slice(0, 32);
      const macKey = signalingKey.slice(32, 32 + 20);

      window.crypto.subtle
        .importKey('raw', aesKey, { name: 'AES-CBC' }, false, ['encrypt'])
        .then(key => {
          const iv = libsignal.crypto.getRandomBytes(16);
          window.crypto.subtle
            .encrypt({ name: 'AES-CBC', iv: new Uint8Array(iv) }, key, signal)
            .then(ciphertext => {
              window.crypto.subtle
                .importKey(
                  'raw',
                  macKey,
                  { name: 'HMAC', hash: { name: 'SHA-256' } },
                  false,
                  ['sign']
                )
                .then(innerKey => {
                  window.crypto.subtle
                    .sign({ name: 'HMAC', hash: 'SHA-256' }, innerKey, signal)
                    .then(mac => {
                      const version = new Uint8Array([1]);
                      const message = dcodeIO.ByteBuffer.concat([
                        version,
                        iv,
                        ciphertext,
                        mac,
                      ]);
                      websocketmessage.request.body = message.toArrayBuffer();
                      done();
                    });
                });
            });
        });
    });

    it('connects', done => {
      const mockServer = new MockServer(
        `ws://localhost:8080/v1/websocket/?login=${encodeURIComponent(
          number
        )}.1&password=password`
      );

      mockServer.on('connection', server => {
        server.send(new Blob([websocketmessage.toArrayBuffer()]));
      });

      window.addEventListener('textsecure:message', ev => {
        const signal = ev.proto;
        const keys = Object.keys(attrs);

        for (let i = 0, max = keys.length; i < max; i += 1) {
          const key = keys[i];
          assert.strictEqual(attrs[key], signal[key]);
        }
        assert.strictEqual(signal.message.body, 'hello');
        mockServer.close();

        done();
      });

      window.messageReceiver = new textsecure.MessageReceiver(
        'username',
        'password',
        'signalingKey'
        // 'ws://localhost:8080',
        // window,
      );
    });
  });
});
