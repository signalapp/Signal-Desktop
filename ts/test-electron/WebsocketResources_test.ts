// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable
     class-methods-use-this,
     no-new,
     @typescript-eslint/no-empty-function,
     @typescript-eslint/no-explicit-any
     */

import { assert } from 'chai';
import * as sinon from 'sinon';
import EventEmitter from 'events';
import { connection as WebSocket } from 'websocket';

import { typedArrayToArrayBuffer as toArrayBuffer } from '../Crypto';

import WebSocketResource from '../textsecure/WebsocketResources';

describe('WebSocket-Resource', () => {
  class FakeSocket extends EventEmitter {
    public sendBytes(_: Uint8Array) {}

    public close() {}
  }

  describe('requests and responses', () => {
    it('receives requests and sends responses', done => {
      // mock socket
      const requestId = '1';
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake((data: Uint8Array) => {
        const message = window.textsecure.protobuf.WebSocketMessage.decode(
          toArrayBuffer(data)
        );
        assert.strictEqual(
          message.type,
          window.textsecure.protobuf.WebSocketMessage.Type.RESPONSE
        );
        assert.strictEqual(message.response?.message, 'OK');
        assert.strictEqual(message.response?.status, 200);
        assert.strictEqual(message.response?.id.toString(), requestId);
        done();
      });

      // actual test
      new WebSocketResource(socket as WebSocket, {
        handleRequest(request: any) {
          assert.strictEqual(request.verb, 'PUT');
          assert.strictEqual(request.path, '/some/path');
          assert.ok(
            window.Signal.Crypto.constantTimeEqual(
              request.body.toArrayBuffer(),
              window.Signal.Crypto.typedArrayToArrayBuffer(
                new Uint8Array([1, 2, 3])
              )
            )
          );
          request.respond(200, 'OK');
        },
      });

      // mock socket request
      socket.emit('message', {
        type: 'binary',
        binaryData: new Uint8Array(
          new window.textsecure.protobuf.WebSocketMessage({
            type: window.textsecure.protobuf.WebSocketMessage.Type.REQUEST,
            request: {
              id: requestId,
              verb: 'PUT',
              path: '/some/path',
              body: window.Signal.Crypto.typedArrayToArrayBuffer(
                new Uint8Array([1, 2, 3])
              ),
            },
          })
            .encode()
            .toArrayBuffer()
        ),
      });
    });

    it('sends requests and receives responses', done => {
      // mock socket and request handler
      let requestId: Long | undefined;
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake((data: Uint8Array) => {
        const message = window.textsecure.protobuf.WebSocketMessage.decode(
          toArrayBuffer(data)
        );
        assert.strictEqual(
          message.type,
          window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
        );
        assert.strictEqual(message.request?.verb, 'PUT');
        assert.strictEqual(message.request?.path, '/some/path');
        assert.ok(
          window.Signal.Crypto.constantTimeEqual(
            message.request?.body.toArrayBuffer(),
            window.Signal.Crypto.typedArrayToArrayBuffer(
              new Uint8Array([1, 2, 3])
            )
          )
        );
        requestId = message.request?.id;
      });

      // actual test
      const resource = new WebSocketResource(socket as WebSocket);
      resource.sendRequest({
        verb: 'PUT',
        path: '/some/path',
        body: window.Signal.Crypto.typedArrayToArrayBuffer(
          new Uint8Array([1, 2, 3])
        ),
        error: done,
        success(message: string, status: number) {
          assert.strictEqual(message, 'OK');
          assert.strictEqual(status, 200);
          done();
        },
      });

      // mock socket response
      socket.emit('message', {
        type: 'binary',
        binaryData: new Uint8Array(
          new window.textsecure.protobuf.WebSocketMessage({
            type: window.textsecure.protobuf.WebSocketMessage.Type.RESPONSE,
            response: { id: requestId, message: 'OK', status: 200 },
          })
            .encode()
            .toArrayBuffer()
        ),
      });
    });
  });

  describe('close', () => {
    it('closes the connection', done => {
      const socket = new FakeSocket();

      sinon.stub(socket, 'close').callsFake(() => done());

      const resource = new WebSocketResource(socket as WebSocket);
      resource.close();
    });
  });

  describe('with a keepalive config', () => {
    const NOW = Date.now();

    beforeEach(function beforeEach() {
      this.sandbox = sinon.createSandbox();
      this.clock = this.sandbox.useFakeTimers({
        now: NOW,
      });
    });

    afterEach(function afterEach() {
      this.sandbox.restore();
    });

    it('sends keepalives once a minute', function test(done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake(data => {
        const message = window.textsecure.protobuf.WebSocketMessage.decode(
          toArrayBuffer(data)
        );
        assert.strictEqual(
          message.type,
          window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
        );
        assert.strictEqual(message.request?.verb, 'GET');
        assert.strictEqual(message.request?.path, '/v1/keepalive');
        done();
      });

      new WebSocketResource(socket as WebSocket, {
        keepalive: { path: '/v1/keepalive' },
      });

      this.clock.next();
    });

    it('uses / as a default path', function test(done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake(data => {
        const message = window.textsecure.protobuf.WebSocketMessage.decode(
          toArrayBuffer(data)
        );
        assert.strictEqual(
          message.type,
          window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
        );
        assert.strictEqual(message.request?.verb, 'GET');
        assert.strictEqual(message.request?.path, '/');
        done();
      });

      new WebSocketResource(socket as WebSocket, {
        keepalive: true,
      });

      this.clock.next();
    });

    it('optionally disconnects if no response', function thisNeeded1(done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'close').callsFake(() => done());

      new WebSocketResource(socket as WebSocket, {
        keepalive: true,
      });

      // One to trigger send
      this.clock.next();

      // Another to trigger send timeout
      this.clock.next();
    });

    it('optionally disconnects if suspended', function thisNeeded1(done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'close').callsFake(() => done());

      new WebSocketResource(socket as WebSocket, {
        keepalive: true,
      });

      // Just skip one hour immediately
      this.clock.setSystemTime(NOW + 3600 * 1000);
      this.clock.next();
    });

    it('allows resetting the keepalive timer', function thisNeeded2(done) {
      const startTime = Date.now();

      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake(data => {
        const message = window.textsecure.protobuf.WebSocketMessage.decode(
          toArrayBuffer(data)
        );
        assert.strictEqual(
          message.type,
          window.textsecure.protobuf.WebSocketMessage.Type.REQUEST
        );
        assert.strictEqual(message.request?.verb, 'GET');
        assert.strictEqual(message.request?.path, '/');
        assert.strictEqual(
          Date.now(),
          startTime + 60000,
          'keepalive time should be one minute'
        );
        done();
      });

      const resource = new WebSocketResource(socket as WebSocket, {
        keepalive: true,
      });

      setTimeout(() => {
        resource.keepalive?.reset();
      }, 5000);

      // Trigger setTimeout above
      this.clock.next();

      // Trigger sendBytes
      this.clock.next();
    });
  });
});
