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

import type { connection as WebSocket, IMessage } from 'websocket';
import Long from 'long';
import pTimeout from 'p-timeout';

import type { EventHandler } from './EventTarget';
import EventTarget from './EventTarget';

import * as durations from '../util/durations';
import { dropNull } from '../util/dropNull';
import { isOlderThan } from '../util/timestamp';
import { strictAssert } from '../util/assert';
import * as Errors from '../types/errors';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import * as Timers from '../Timers';

const THIRTY_SECONDS = 30 * durations.SECOND;

const MAX_MESSAGE_SIZE = 256 * 1024;

export class IncomingWebSocketRequest {
  private readonly id: Long;

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
  name: string;
  handleRequest?: (request: IncomingWebSocketRequest) => void;
  keepalive?: KeepAliveOptionsType;
};

export class CloseEvent extends Event {
  constructor(public readonly code: number, public readonly reason: string) {
    super('close');
  }
}

export default class WebSocketResource extends EventTarget {
  private outgoingId = Long.fromNumber(1, true);

  private closed = false;

  private readonly outgoingMap = new Map<
    string,
    (result: SendRequestResult) => void
  >();

  private readonly boundOnMessage: (message: IMessage) => void;

  private activeRequests = new Set<IncomingWebSocketRequest | string>();

  private shuttingDown = false;

  private shutdownTimer?: Timers.Timeout;

  private readonly logId: string;

  public readonly localPort: number | undefined;

  // Public for tests
  public readonly keepalive?: KeepAlive;

  constructor(
    private readonly socket: WebSocket,
    private readonly options: WebSocketResourceOptions
  ) {
    super();

    this.logId = `WebSocketResource(${options.name})`;
    this.localPort = socket.socket.localPort;

    this.boundOnMessage = this.onMessage.bind(this);

    socket.on('message', this.boundOnMessage);

    if (options.keepalive) {
      const keepalive = new KeepAlive(
        this,
        options.name,
        options.keepalive ?? {}
      );
      this.keepalive = keepalive;

      keepalive.reset();
      socket.on('close', () => this.keepalive?.stop());
      socket.on('error', (error: Error) => {
        log.warn(`${this.logId}: WebSocket error`, Errors.toLogFormat(error));
      });
    }

    socket.on('close', (code, reason) => {
      this.closed = true;

      log.warn(`${this.logId}: Socket closed`);
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    });

    this.addEventListener('close', () => this.onClose());
  }

  public override addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public override addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public async sendRequest(
    options: SendRequestOptions
  ): Promise<SendRequestResult> {
    const id = this.outgoingId;
    const idString = id.toString();
    strictAssert(!this.outgoingMap.has(idString), 'Duplicate outgoing request');

    // Note that this automatically wraps
    this.outgoingId = this.outgoingId.add(1);

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
    this.addActive(idString);
    const promise = new Promise<SendRequestResult>((resolve, reject) => {
      const sentAt = Date.now();
      let timedOut = false;

      let timer = options.timeout
        ? Timers.setTimeout(() => {
            timedOut = true;
            this.removeActive(idString);
            reject(new Error(`Request timed out; id: [${idString}]`));
          }, options.timeout)
        : undefined;

      this.outgoingMap.set(idString, result => {
        if (timer !== undefined) {
          Timers.clearTimeout(timer);
          timer = undefined;
        }
        if (timedOut) {
          log.warn(
            `${this.logId}: Response received after timeout; ` +
              `id: [${idString}], path: [${options.path}], ` +
              `response time: ${Date.now() - sentAt}ms`
          );
        } else {
          // Reset keepalive when an on-time response arrives
          this.keepalive?.reset();
        }
        this.removeActive(idString);
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
    void this.keepalive.send();
  }

  public close(code = 3000, reason?: string): void {
    if (this.closed) {
      log.info(`${this.logId}.close: Already closed! ${code}/${reason}`);
      return;
    }

    log.info(`${this.logId}.close(${code})`);
    if (this.keepalive) {
      this.keepalive.stop();
    }

    this.socket.close(code, reason);

    this.socket.removeListener('message', this.boundOnMessage);

    // On linux the socket can wait a long time to emit its close event if we've
    //   lost the internet connection. On the order of minutes. This speeds that
    //   process up.
    Timers.setTimeout(() => {
      if (this.closed) {
        return;
      }

      log.warn(`${this.logId}.close: Dispatching our own socket close event`);
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    }, 5 * durations.SECOND);
  }

  public shutdown(): void {
    if (this.closed) {
      return;
    }

    if (this.activeRequests.size === 0) {
      log.info(`${this.logId}.shutdown: no active requests, closing`);
      this.close(3000, 'Shutdown');
      return;
    }

    this.shuttingDown = true;

    log.info(`${this.logId}.shutdown: shutting down`);
    this.shutdownTimer = Timers.setTimeout(() => {
      if (this.closed) {
        return;
      }

      log.warn(`${this.logId}.shutdown: Failed to shutdown gracefully`);
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

      const responseIdString = response.id.toString();
      const resolve = this.outgoingMap.get(responseIdString);
      this.outgoingMap.delete(responseIdString);

      if (!resolve) {
        throw new Error(`Received response for unknown request ${response.id}`);
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

  private addActive(request: IncomingWebSocketRequest | string): void {
    this.activeRequests.add(request);
  }

  private removeActive(request: IncomingWebSocketRequest | string): void {
    if (!this.activeRequests.has(request)) {
      log.warn(`${this.logId}.removeActive: removing unknown request`);
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
      Timers.clearTimeout(this.shutdownTimer);
      this.shutdownTimer = undefined;
    }

    log.info(`${this.logId}.removeActive: shutdown complete`);
    this.close(3000, 'Shutdown');
  }
}

export type KeepAliveOptionsType = {
  path?: string;
};

// 30 seconds + 5 seconds for closing the socket above.
const KEEPALIVE_INTERVAL_MS = 30 * durations.SECOND;

// If the machine was in suspended mode for more than 5 minutes - trigger
// immediate disconnect.
const STALE_THRESHOLD_MS = 5 * durations.MINUTE;

// If we don't receive a response to keepalive request within 10 seconds -
// close the socket.
const KEEPALIVE_TIMEOUT_MS = 10 * durations.SECOND;

const LOG_KEEPALIVE_AFTER_MS = 500;

class KeepAlive {
  private keepAliveTimer: Timers.Timeout | undefined;

  private path: string;

  private wsr: WebSocketResource;

  private lastAliveAt: number = Date.now();

  private logId: string;

  constructor(
    websocketResource: WebSocketResource,
    name: string,
    opts: KeepAliveOptionsType = {}
  ) {
    this.logId = `WebSocketResources.KeepAlive(${name})`;
    if (websocketResource instanceof WebSocketResource) {
      this.path = opts.path ?? '/';
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

    const isStale = isOlderThan(this.lastAliveAt, STALE_THRESHOLD_MS);
    if (isStale) {
      log.info(`${this.logId}.send: disconnecting due to stale state`);
      this.wsr.close(
        3001,
        `Last keepalive request was too far in the past: ${this.lastAliveAt}`
      );
      return;
    }

    log.info(`${this.logId}.send: Sending a keepalive message`);
    const sentAt = Date.now();

    try {
      const { status } = await pTimeout(
        this.wsr.sendRequest({
          verb: 'GET',
          path: this.path,
        }),
        KEEPALIVE_TIMEOUT_MS
      );

      if (status < 200 || status >= 300) {
        log.warn(`${this.logId}.send: keepalive response status ${status}`);
        this.wsr.close(3001, `keepalive response with ${status} code`);
        return;
      }
    } catch (error) {
      this.wsr.close(3001, 'No response to keepalive request');
      return;
    }

    const responseTime = Date.now() - sentAt;
    if (responseTime > LOG_KEEPALIVE_AFTER_MS) {
      log.warn(
        `${this.logId}.send: delayed response to keepalive request, ` +
          `response time: ${responseTime}ms`
      );
    }

    // Successful response on time
    this.reset();
  }

  public reset(): void {
    this.lastAliveAt = Date.now();

    this.clearTimers();

    this.keepAliveTimer = Timers.setTimeout(
      () => this.send(),
      KEEPALIVE_INTERVAL_MS
    );
  }

  private clearTimers(): void {
    if (this.keepAliveTimer) {
      Timers.clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }
}
