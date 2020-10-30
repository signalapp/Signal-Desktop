// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

describe('WebSocket-Resource', () => {
  describe('requests and responses', () => {
    it('receives requests and sends responses', done => {
      // mock socket
      const requestId = '1';
      const socket = {
        send(data) {
          const message = window.textsecure.protobuf.WebSocketMessage.decode(
            data
          );
          assert.strictEqual(
            message.type,
            window.textsecure.protobuf.WebSocketMessage.Type.RESPONSE
          );
          assert.strictEqual(message.response.message, 'OK');
          assert.strictEqual(message.response.status, 200);
          assert.strictEqual(message.response.id.toString(), requestId);
          done();
        },
        addEventListener() {},
      };

      // actual test
      this.resource = new window.textsecure.WebSocketResource(socket, {
        handleRequest(request) {
          assert.strictEqual(request.verb, 'PUT');
          assert.strictEqual(request.path, '/some/path');
          assertEqualArrayBuffers(
            request.body.toArrayBuffer(),
            new Uint8Array([1, 2, 3]).buffer
          );
          request.respond(200, 'OK');
        },
      });

      // mock socket request
      socket.onmessage({
        data: new Blob([
          new window.textsecure.protobuf.WebSocketMessage({
            type: window.textsecure.protobuf.WebSocketMessage.Type.REQUEST,
            request: {
              id: requestId,
              verb: 'PUT',
              path: '/some/path',
              body: new Uint8Array([1, 2, 3]).buffer,
            },
          })
            .encode()
            .toArrayBuffer(),
        ]),
      });
    });

    it('sends requests and receives responses', done => {
      // mock socket and request handler
      let requestId;
      const socket = {
        send(data) {
          const message = window.textsecure.protobuf.WebSocketMessage.decode(
            data
          );
          assert.strictEqual(
            message.type,
            window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
          );
          assert.strictEqual(message.request.verb, 'PUT');
          assert.strictEqual(message.request.path, '/some/path');
          assertEqualArrayBuffers(
            message.request.body.toArrayBuffer(),
            new Uint8Array([1, 2, 3]).buffer
          );
          requestId = message.request.id;
        },
        addEventListener() {},
      };

      // actual test
      const resource = new window.textsecure.WebSocketResource(socket);
      resource.sendRequest({
        verb: 'PUT',
        path: '/some/path',
        body: new Uint8Array([1, 2, 3]).buffer,
        error: done,
        success(message, status) {
          assert.strictEqual(message, 'OK');
          assert.strictEqual(status, 200);
          done();
        },
      });

      // mock socket response
      socket.onmessage({
        data: new Blob([
          new window.textsecure.protobuf.WebSocketMessage({
            type: window.textsecure.protobuf.WebSocketMessage.Type.RESPONSE,
            response: { id: requestId, message: 'OK', status: 200 },
          })
            .encode()
            .toArrayBuffer(),
        ]),
      });
    });
  });

  describe('close', () => {
    before(() => {
      window.WebSocket = MockSocket;
    });
    after(() => {
      window.WebSocket = WebSocket;
    });
    it('closes the connection', done => {
      const mockServer = new MockServer('ws://localhost:8081');
      mockServer.on('connection', server => {
        server.on('close', done);
      });
      const resource = new window.textsecure.WebSocketResource(
        new WebSocket('ws://localhost:8081')
      );
      resource.close();
    });
  });

  describe.skip('with a keepalive config', function thisNeeded() {
    before(() => {
      window.WebSocket = MockSocket;
    });
    after(() => {
      window.WebSocket = WebSocket;
    });
    this.timeout(60000);
    it('sends keepalives once a minute', done => {
      const mockServer = new MockServer('ws://localhost:8081');
      mockServer.on('connection', server => {
        server.on('message', data => {
          const message = window.textsecure.protobuf.WebSocketMessage.decode(
            data
          );
          assert.strictEqual(
            message.type,
            window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
          );
          assert.strictEqual(message.request.verb, 'GET');
          assert.strictEqual(message.request.path, '/v1/keepalive');
          server.close();
          done();
        });
      });
      this.resource = new window.textsecure.WebSocketResource(
        new WebSocket('ws://loc1alhost:8081'),
        {
          keepalive: { path: '/v1/keepalive' },
        }
      );
    });

    it('uses / as a default path', done => {
      const mockServer = new MockServer('ws://localhost:8081');
      mockServer.on('connection', server => {
        server.on('message', data => {
          const message = window.textsecure.protobuf.WebSocketMessage.decode(
            data
          );
          assert.strictEqual(
            message.type,
            window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
          );
          assert.strictEqual(message.request.verb, 'GET');
          assert.strictEqual(message.request.path, '/');
          server.close();
          done();
        });
      });
      this.resource = new window.textsecure.WebSocketResource(
        new WebSocket('ws://localhost:8081'),
        {
          keepalive: true,
        }
      );
    });

    it('optionally disconnects if no response', function thisNeeded1(done) {
      this.timeout(65000);
      const mockServer = new MockServer('ws://localhost:8081');
      const socket = new WebSocket('ws://localhost:8081');
      mockServer.on('connection', server => {
        server.on('close', done);
      });
      this.resource = new window.textsecure.WebSocketResource(socket, {
        keepalive: true,
      });
    });

    it('allows resetting the keepalive timer', function thisNeeded2(done) {
      this.timeout(65000);
      const mockServer = new MockServer('ws://localhost:8081');
      const socket = new WebSocket('ws://localhost:8081');
      const startTime = Date.now();
      mockServer.on('connection', server => {
        server.on('message', data => {
          const message = window.textsecure.protobuf.WebSocketMessage.decode(
            data
          );
          assert.strictEqual(
            message.type,
            window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
          );
          assert.strictEqual(message.request.verb, 'GET');
          assert.strictEqual(message.request.path, '/');
          assert(
            Date.now() > startTime + 60000,
            'keepalive time should be longer than a minute'
          );
          server.close();
          done();
        });
      });
      const resource = new window.textsecure.WebSocketResource(socket, {
        keepalive: true,
      });
      setTimeout(() => {
        resource.resetKeepAliveTimer();
      }, 5000);
    });
  });
});
