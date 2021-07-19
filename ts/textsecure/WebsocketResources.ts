// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */
/*
 * WebSocket-Resources
 *
 * Create a request-response interface over websockets using the
 * WebSocket-Resources sub-protocol[1].
 *
 * var client = new WebSocketResource(socket, function(request) {
 *    request.respond(200, 'OK');
 * });
 *
 * client.sendRequest({
 *    verb: 'PUT',
 *    path: '/v1/messages',
 *    body: '{ some: "json" }',
 *    success: function(message, status, request) {...},
 *    error: function(message, status, request) {...}
 * });
 *
 * 1. https://github.com/signalapp/WebSocket-Resources
 *
 */

import { connection as WebSocket, IMessage } from 'websocket';

import EventTarget, { EventHandler } from './EventTarget';

import { dropNull } from '../util/dropNull';
import { isOlderThan } from '../util/timestamp';
import { strictAssert } from '../util/assert';
import { normalizeNumber } from '../util/normalizeNumber';
import { SignalService as Proto } from '../protobuf';

type Callback = (
  message: string,
  status: number,
  request: OutgoingWebSocketRequest
) => void;

export class IncomingWebSocketRequest {
  private readonly id: Long | number;

  public readonly verb: string;

  public readonly path: string;

  public readonly body: Uint8Array | undefined;

  public readonly headers: ReadonlyArray<string>;

  constructor(
    request: Proto.IWebSocketRequestMessage,
    private readonly socket: WebSocket
  ) {
    strictAssert(request.id, 'request without id');
    strictAssert(request.verb, 'request without verb');
    strictAssert(request.path, 'request without path');

    this.id = request.id;
    this.verb = request.verb;
    this.path = request.path;
    this.body = dropNull(request.body);
    this.headers = request.headers || [];
    this.socket = socket;
  }

  public respond(status: number, message: string): void {
    const bytes = Proto.WebSocketMessage.encode({
      type: Proto.WebSocketMessage.Type.RESPONSE,
      response: { id: this.id, message, status },
    }).finish();

    this.socket.sendBytes(Buffer.from(bytes));
  }
}

export type OutgoingWebSocketRequestOptions = Readonly<{
  verb: string;
  path: string;
  body?: Uint8Array;
  headers?: ReadonlyArray<string>;
  error?: Callback;
  success?: Callback;
}>;

export class OutgoingWebSocketRequest {
  public readonly error: Callback | undefined;

  public readonly success: Callback | undefined;

  public response: Proto.IWebSocketResponseMessage | undefined;

  constructor(
    id: number,
    options: OutgoingWebSocketRequestOptions,
    socket: WebSocket
  ) {
    this.error = options.error;
    this.success = options.success;

    const bytes = Proto.WebSocketMessage.encode({
      type: Proto.WebSocketMessage.Type.REQUEST,
      request: {
        verb: options.verb,
        path: options.path,
        body: options.body,
        headers: options.headers ? options.headers.slice() : undefined,
        id,
      },
    }).finish();
    socket.sendBytes(Buffer.from(bytes));
  }
}

export type WebSocketResourceOptions = {
  handleRequest?: (request: IncomingWebSocketRequest) => void;
  keepalive?: KeepAliveOptionsType | true;
};

export class CloseEvent extends Event {
  constructor(public readonly code: number, public readonly reason: string) {
    super('close');
  }
}

export default class WebSocketResource extends EventTarget {
  private outgoingId = 1;

  private closed?: boolean;

  private readonly outgoingMap = new Map<number, OutgoingWebSocketRequest>();

  private readonly boundOnMessage: (message: IMessage) => void;

  // Public for tests
  public readonly keepalive?: KeepAlive;

  constructor(
    private readonly socket: WebSocket,
    private readonly options: WebSocketResourceOptions = {}
  ) {
    super();

    this.boundOnMessage = this.onMessage.bind(this);

    socket.on('message', this.boundOnMessage);

    if (options.keepalive) {
      const keepalive = new KeepAlive(
        this,
        options.keepalive === true ? {} : options.keepalive
      );
      this.keepalive = keepalive;

      keepalive.reset();
      socket.on('message', () => keepalive.reset());
      socket.on('close', () => keepalive.stop());
    }

    socket.on('close', () => {
      this.closed = true;
    });
  }

  public addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public sendRequest(
    options: OutgoingWebSocketRequestOptions
  ): OutgoingWebSocketRequest {
    const id = this.outgoingId;
    strictAssert(!this.outgoingMap.has(id), 'Duplicate outgoing request');

    // eslint-disable-next-line no-bitwise
    this.outgoingId = Math.max(1, (this.outgoingId + 1) & 0x7fffffff);

    const outgoing = new OutgoingWebSocketRequest(id, options, this.socket);
    this.outgoingMap.set(id, outgoing);

    return outgoing;
  }

  public forceKeepAlive(): void {
    if (!this.keepalive) {
      return;
    }
    this.keepalive.send();
  }

  public close(code = 3000, reason?: string): void {
    if (this.closed) {
      return;
    }

    window.log.info('WebSocketResource.close()');
    if (this.keepalive) {
      this.keepalive.stop();
    }

    this.socket.close(code, reason);

    this.socket.removeListener('message', this.boundOnMessage);

    // On linux the socket can wait a long time to emit its close event if we've
    //   lost the internet connection. On the order of minutes. This speeds that
    //   process up.
    setTimeout(() => {
      if (this.closed) {
        return;
      }

      window.log.warn('Dispatching our own socket close event');
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    }, 5000);
  }

  private onMessage({ type, binaryData }: IMessage): void {
    if (type !== 'binary' || !binaryData) {
      throw new Error(`Unsupported websocket message type: ${type}`);
    }

    const message = Proto.WebSocketMessage.decode(binaryData);
    if (
      message.type === Proto.WebSocketMessage.Type.REQUEST &&
      message.request
    ) {
      const handleRequest =
        this.options.handleRequest ||
        (request => request.respond(404, 'Not found'));
      handleRequest(new IncomingWebSocketRequest(message.request, this.socket));
    } else if (
      message.type === Proto.WebSocketMessage.Type.RESPONSE &&
      message.response
    ) {
      const { response } = message;
      strictAssert(response.id, 'response without id');

      const responseId = normalizeNumber(response.id);
      const request = this.outgoingMap.get(responseId);
      this.outgoingMap.delete(responseId);

      if (!request) {
        throw new Error(`Received response for unknown request ${responseId}`);
      }

      request.response = dropNull(response);

      let callback = request.error;

      const status = response.status ?? -1;
      if (status >= 200 && status < 300) {
        callback = request.success;
      }

      if (typeof callback === 'function') {
        callback(response.message ?? '', status, request);
      }
    }
  }
}

export type KeepAliveOptionsType = {
  path?: string;
  disconnect?: boolean;
};

const KEEPALIVE_INTERVAL_MS = 55000; // 55 seconds + 5 seconds for closing the
// socket above.
const MAX_KEEPALIVE_INTERVAL_MS = 300 * 1000; // 5 minutes

class KeepAlive {
  private keepAliveTimer: NodeJS.Timeout | undefined;

  private disconnectTimer: NodeJS.Timeout | undefined;

  private path: string;

  private disconnect: boolean;

  private wsr: WebSocketResource;

  private lastAliveAt: number = Date.now();

  constructor(
    websocketResource: WebSocketResource,
    opts: KeepAliveOptionsType = {}
  ) {
    if (websocketResource instanceof WebSocketResource) {
      this.path = opts.path !== undefined ? opts.path : '/';
      this.disconnect = opts.disconnect !== undefined ? opts.disconnect : true;
      this.wsr = websocketResource;
    } else {
      throw new TypeError('KeepAlive expected a WebSocketResource');
    }
  }

  public stop(): void {
    this.clearTimers();
  }

  public send(): void {
    this.clearTimers();

    if (isOlderThan(this.lastAliveAt, MAX_KEEPALIVE_INTERVAL_MS)) {
      window.log.info('WebSocketResources: disconnecting due to stale state');
      this.wsr.close(
        3001,
        `Last keepalive request was too far in the past: ${this.lastAliveAt}`
      );
      return;
    }

    if (this.disconnect) {
      // automatically disconnect if server doesn't ack
      this.disconnectTimer = setTimeout(() => {
        window.log.info('WebSocketResources: disconnecting due to no response');
        this.clearTimers();

        this.wsr.close(3001, 'No response to keepalive request');
      }, 10000);
    } else {
      this.reset();
    }

    window.log.info('WebSocketResources: Sending a keepalive message');
    this.wsr.sendRequest({
      verb: 'GET',
      path: this.path,
      success: this.reset.bind(this),
    });
  }

  public reset(): void {
    this.lastAliveAt = Date.now();

    this.clearTimers();

    this.keepAliveTimer = setTimeout(() => this.send(), KEEPALIVE_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = undefined;
    }
  }
}
