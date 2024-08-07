// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable
     no-new,
     @typescript-eslint/no-empty-function,
     @typescript-eslint/no-explicit-any
     */

import { assert } from 'chai';
import * as sinon from 'sinon';
import EventEmitter from 'events';
import type { connection as WebSocket } from 'websocket';
import Long from 'long';

import { dropNull } from '../util/dropNull';
import { SignalService as Proto } from '../protobuf';

import WebSocketResource, {
  ServerRequestType,
} from '../textsecure/WebsocketResources';

describe('WebSocket-Resource', () => {
  class FakeSocket extends EventEmitter {
    public sendBytes(_: Uint8Array) {}
    public socket = {
      localPort: 5678,
    };
    public close() {}
  }

  const NOW = Date.now();

  beforeEach(function (this: Mocha.Context) {
    this.sandbox = sinon.createSandbox();
    this.clock = this.sandbox.useFakeTimers({
      now: NOW,
    });
    this.sandbox
      .stub(window.SignalContext.timers, 'setTimeout')
      .callsFake(setTimeout);
    this.sandbox
      .stub(window.SignalContext.timers, 'clearTimeout')
      .callsFake(clearTimeout);
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();
  });

  describe('requests and responses', () => {
    it('receives requests and sends responses', done => {
      // mock socket
      const requestId = new Long(0xdeadbeef, 0x7fffffff);
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake((data: Uint8Array) => {
        const message = Proto.WebSocketMessage.decode(data);
        assert.strictEqual(message.type, Proto.WebSocketMessage.Type.RESPONSE);
        assert.strictEqual(message.response?.message, 'OK');
        assert.strictEqual(message.response?.status, 200);
        const id = message.response?.id;

        if (Long.isLong(id)) {
          assert(id.equals(requestId));
        } else {
          assert(false, `id should be Long, got ${id}`);
        }

        done();
      });

      // actual test
      new WebSocketResource(socket as WebSocket, {
        name: 'test',
        handleRequest(request: any) {
          assert.strictEqual(request.requestType, ServerRequestType.ApiMessage);
          assert.deepEqual(request.body, new Uint8Array([1, 2, 3]));
          request.respond(200, 'OK');
        },
      });

      // mock socket request
      socket.emit('message', {
        type: 'binary',
        binaryData: Proto.WebSocketMessage.encode({
          type: Proto.WebSocketMessage.Type.REQUEST,
          request: {
            id: requestId,
            verb: 'PUT',
            path: ServerRequestType.ApiMessage.toString(),
            body: new Uint8Array([1, 2, 3]),
          },
        }).finish(),
      });
    });

    it('sends requests and receives responses', async () => {
      // mock socket and request handler
      let requestId: Long | undefined;
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake((data: Uint8Array) => {
        const message = Proto.WebSocketMessage.decode(data);
        assert.strictEqual(message.type, Proto.WebSocketMessage.Type.REQUEST);
        assert.strictEqual(message.request?.verb, 'PUT');
        assert.strictEqual(message.request?.path, '/some/path');
        assert.deepEqual(message.request?.body, new Uint8Array([1, 2, 3]));
        requestId = dropNull(message.request?.id);
      });

      // actual test
      const resource = new WebSocketResource(socket as WebSocket, {
        name: 'test',
      });
      const promise = resource.sendRequest({
        verb: 'PUT',
        path: '/some/path',
        body: new Uint8Array([1, 2, 3]),
      });

      // mock socket response
      socket.emit('message', {
        type: 'binary',
        binaryData: Proto.WebSocketMessage.encode({
          type: Proto.WebSocketMessage.Type.RESPONSE,
          response: { id: requestId, message: 'OK', status: 200 },
        }).finish(),
      });

      const response = await promise;
      assert.strictEqual(response.statusText, 'OK');
      assert.strictEqual(response.status, 200);
    });
  });

  describe('close', () => {
    it('closes the connection', done => {
      const socket = new FakeSocket();

      sinon.stub(socket, 'close').callsFake(() => done());

      const resource = new WebSocketResource(socket as WebSocket, {
        name: 'test',
      });
      resource.close();
    });

    it('force closes the connection', function (this: Mocha.Context, done) {
      const socket = new FakeSocket();

      const resource = new WebSocketResource(socket as WebSocket, {
        name: 'test',
      });
      resource.close();

      resource.addEventListener('close', () => done());

      // Wait 5 seconds to forcefully close the connection
      this.clock.next();
    });
  });

  describe('with a keepalive config', () => {
    it('sends keepalives once a minute', function (this: Mocha.Context, done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake(data => {
        const message = Proto.WebSocketMessage.decode(data);
        assert.strictEqual(message.type, Proto.WebSocketMessage.Type.REQUEST);
        assert.strictEqual(message.request?.verb, 'GET');
        assert.strictEqual(message.request?.path, '/v1/keepalive');
        done();
      });

      new WebSocketResource(socket as WebSocket, {
        name: 'test',
        keepalive: { path: '/v1/keepalive' },
      });

      this.clock.next();
    });

    it('optionally disconnects if no response', function (this: Mocha.Context, done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'close').callsFake(() => done());

      new WebSocketResource(socket as WebSocket, {
        name: 'test',
        keepalive: { path: '/' },
      });

      // One to trigger send
      this.clock.next();

      // Another to trigger send timeout
      this.clock.next();
    });

    it('optionally disconnects if suspended', function (this: Mocha.Context, done) {
      const socket = new FakeSocket();

      sinon.stub(socket, 'close').callsFake(() => done());

      new WebSocketResource(socket as WebSocket, {
        name: 'test',
        keepalive: { path: '/' },
      });

      // Just skip one hour immediately
      this.clock.setSystemTime(NOW + 3600 * 1000);
      this.clock.next();
    });

    it('allows resetting the keepalive timer', function (this: Mocha.Context, done) {
      const startTime = Date.now();

      const socket = new FakeSocket();

      sinon.stub(socket, 'sendBytes').callsFake(data => {
        const message = Proto.WebSocketMessage.decode(data);
        assert.strictEqual(message.type, Proto.WebSocketMessage.Type.REQUEST);
        assert.strictEqual(message.request?.verb, 'GET');
        assert.strictEqual(message.request?.path, '/');
        assert.strictEqual(
          Date.now(),
          startTime + 30000 + 5000,
          'keepalive time should be 35s'
        );
        done();
      });

      const resource = new WebSocketResource(socket as WebSocket, {
        name: 'test',
        keepalive: { path: '/' },
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
