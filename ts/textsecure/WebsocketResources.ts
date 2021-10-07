// Copyright 2020-2021 Signal Messenger, LLC
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
 * const { response, status } = await client.sendRequest({
 *    verb: 'PUT',
 *    path: '/v1/messages',
 *    headers: ['content-type:application/json'],
 *    body: Buffer.from('{ some: "json" }'),
 * });
 *
 * 1. https://github.com/signalapp/WebSocket-Resources
 *
 */

import { connection as WebSocket, IMessage } from 'websocket';

import EventTarget, { EventHandler } from './EventTarget';

import * as durations from '../util/durations';
import { dropNull } from '../util/dropNull';
import { isOlderThan } from '../util/timestamp';
import { strictAssert } from '../util/assert';
import { normalizeNumber } from '../util/normalizeNumber';
import * as Errors from '../types/errors';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';

const THIRTY_SECONDS = 30 * durations.SECOND;

const MAX_MESSAGE_SIZE = 256 * 1024;

export class IncomingWebSocketRequest {
  private readonly id: Long | number;

  public readonly verb: string;

  public readonly path: string;

  public readonly body: Uint8Array | undefined;

  public readonly headers: ReadonlyArray<string>;

  constructor(
    request: Proto.IWebSocketRequestMessage,
    private readonly sendBytes: (bytes: Buffer) => void
  ) {
    strictAssert(request.id, 'request without id');
    strictAssert(request.verb, 'request without verb');
    strictAssert(request.path, 'request without path');

    this.id = request.id;
    this.verb = request.verb;
    this.path = request.path;
    this.body = dropNull(request.body);
    this.headers = request.headers || [];
  }

  public respond(status: number, message: string): void {
    const bytes = Proto.WebSocketMessage.encode({
      type: Proto.WebSocketMessage.Type.RESPONSE,
      response: { id: this.id, message, status },
    }).finish();

    this.sendBytes(Buffer.from(bytes));
  }
}

export type SendRequestOptions = Readonly<{
  verb: string;
  path: string;
  body?: Uint8Array;
  timeout?: number;
  headers?: ReadonlyArray<string>;
}>;

export type SendRequestResult = Readonly<{
  status: number;
  message: string;
  response?: Uint8Array;
  headers: ReadonlyArray<string>;
}>;

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

  private closed = false;

  private readonly outgoingMap = new Map<
    number,
    (result: SendRequestResult) => void
  >();

  private readonly boundOnMessage: (message: IMessage) => void;

  private activeRequests = new Set<IncomingWebSocketRequest | number>();

  private shuttingDown = false;

  private shutdownTimer?: NodeJS.Timeout;

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
      socket.on('error', (error: Error) => {
        log.warn(
          'WebSocketResource: WebSocket error',
          Errors.toLogFormat(error)
        );
      });
    }

    socket.on('close', (code, reason) => {
      this.closed = true;

      log.warn('WebSocketResource: Socket closed');
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    });

    this.addEventListener('close', () => this.onClose());
  }

  public addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public async sendRequest(
    options: SendRequestOptions
  ): Promise<SendRequestResult> {
    const id = this.outgoingId;
    strictAssert(!this.outgoingMap.has(id), 'Duplicate outgoing request');

    // eslint-disable-next-line no-bitwise
    this.outgoingId = Math.max(1, (this.outgoingId + 1) & 0x7fffffff);

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
    strictAssert(
      bytes.length <= MAX_MESSAGE_SIZE,
      'WebSocket request byte size exceeded'
    );

    strictAssert(!this.shuttingDown, 'Cannot send request, shutting down');
    this.addActive(id);
    const promise = new Promise<SendRequestResult>((resolve, reject) => {
      let timer = options.timeout
        ? setTimeout(() => {
            this.removeActive(id);
            reject(new Error('Request timed out'));
          }, options.timeout)
        : undefined;

      this.outgoingMap.set(id, result => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }

        this.removeActive(id);
        resolve(result);
      });
    });

    this.socket.sendBytes(Buffer.from(bytes));

    return promise;
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

    log.info('WebSocketResource.close()');
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

      log.warn('WebSocketResource: Dispatching our own socket close event');
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    }, 5000);
  }

  public shutdown(): void {
    if (this.closed) {
      return;
    }

    if (this.activeRequests.size === 0) {
      log.info('WebSocketResource: no active requests, closing');
      this.close(3000, 'Shutdown');
      return;
    }

    this.shuttingDown = true;

    log.info('WebSocketResource: shutting down');
    this.shutdownTimer = setTimeout(() => {
      if (this.closed) {
        return;
      }

      log.warn('WebSocketResource: Failed to shutdown gracefully');
      this.close(3000, 'Shutdown');
    }, THIRTY_SECONDS);
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

      const incomingRequest = new IncomingWebSocketRequest(
        message.request,
        (bytes: Buffer): void => {
          this.removeActive(incomingRequest);

          strictAssert(
            bytes.length <= MAX_MESSAGE_SIZE,
            'WebSocket response byte size exceeded'
          );
          this.socket.sendBytes(bytes);
        }
      );

      if (this.shuttingDown) {
        incomingRequest.respond(-1, 'Shutting down');
        return;
      }

      this.addActive(incomingRequest);
      handleRequest(incomingRequest);
    } else if (
      message.type === Proto.WebSocketMessage.Type.RESPONSE &&
      message.response
    ) {
      const { response } = message;
      strictAssert(response.id, 'response without id');

      const responseId = normalizeNumber(response.id);
      const resolve = this.outgoingMap.get(responseId);
      this.outgoingMap.delete(responseId);

      if (!resolve) {
        throw new Error(`Received response for unknown request ${responseId}`);
      }

      resolve({
        status: response.status ?? -1,
        message: response.message ?? '',
        response: dropNull(response.body),
        headers: response.headers ?? [],
      });
    }
  }

  private onClose(): void {
    const outgoing = new Map(this.outgoingMap);
    this.outgoingMap.clear();

    for (const resolve of outgoing.values()) {
      resolve({
        status: -1,
        message: 'Connection closed',
        response: undefined,
        headers: [],
      });
    }
  }

  private addActive(request: IncomingWebSocketRequest | number): void {
    this.activeRequests.add(request);
  }

  private removeActive(request: IncomingWebSocketRequest | number): void {
    if (!this.activeRequests.has(request)) {
      log.warn('WebSocketResource: removing unknown request');
      return;
    }

    this.activeRequests.delete(request);
    if (this.activeRequests.size !== 0) {
      return;
    }
    if (!this.shuttingDown) {
      return;
    }

    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = undefined;
    }

    log.info('WebSocketResource: shutdown complete');
    this.close(3000, 'Shutdown');
  }
}

export type KeepAliveOptionsType = {
  path?: string;
  disconnect?: boolean;
};

const KEEPALIVE_INTERVAL_MS = 55000; // 55 seconds + 5 seconds for closing the
// socket above.
const MAX_KEEPALIVE_INTERVAL_MS = 5 * durations.MINUTE;

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

  public async send(): Promise<void> {
    this.clearTimers();

    if (isOlderThan(this.lastAliveAt, MAX_KEEPALIVE_INTERVAL_MS)) {
      log.info('WebSocketResources: disconnecting due to stale state');
      this.wsr.close(
        3001,
        `Last keepalive request was too far in the past: ${this.lastAliveAt}`
      );
      return;
    }

    if (this.disconnect) {
      // automatically disconnect if server doesn't ack
      this.disconnectTimer = setTimeout(() => {
        log.info('WebSocketResources: disconnecting due to no response');
        this.clearTimers();

        this.wsr.close(3001, 'No response to keepalive request');
      }, 10000);
    } else {
      this.reset();
    }

    log.info('WebSocketResources: Sending a keepalive message');
    const { status } = await this.wsr.sendRequest({
      verb: 'GET',
      path: this.path,
    });

    if (status >= 200 || status < 300) {
      this.reset();
    }
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
