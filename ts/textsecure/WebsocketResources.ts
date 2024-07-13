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

/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/brace-style */

import type { connection as WebSocket, IMessage } from 'websocket';
import Long from 'long';
import pTimeout from 'p-timeout';
import { Response } from 'node-fetch';
import net from 'net';
import { z } from 'zod';
import { clearInterval } from 'timers';
import { random } from 'lodash';
import type { ChatServiceDebugInfo } from '@signalapp/libsignal-client/Native';

import type { Net } from '@signalapp/libsignal-client';
import type { EventHandler } from './EventTarget';
import EventTarget from './EventTarget';

import * as durations from '../util/durations';
import { dropNull } from '../util/dropNull';
import { drop } from '../util/drop';
import { isOlderThan } from '../util/timestamp';
import { strictAssert } from '../util/assert';
import * as Errors from '../types/errors';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import * as Timers from '../Timers';
import type { IResource } from './WebSocket';
import { isProduction } from '../util/version';

import { ToastType } from '../types/Toast';
import { AbortableProcess } from '../util/AbortableProcess';

const THIRTY_SECONDS = 30 * durations.SECOND;

const STATS_UPDATE_INTERVAL = durations.MINUTE;

const MAX_MESSAGE_SIZE = 512 * 1024;

const AGGREGATED_STATS_KEY = 'websocketStats';

export enum IpVersion {
  IPv4 = 'ipv4',
  IPv6 = 'ipv6',
}

export namespace IpVersion {
  export function fromDebugInfoCode(ipType: number): IpVersion | undefined {
    switch (ipType) {
      case 1:
        return IpVersion.IPv4;
      case 2:
        return IpVersion.IPv6;
      default:
        return undefined;
    }
  }
}

const AggregatedStatsSchema = z.object({
  connectionFailures: z.number(),
  requestsCompared: z.number(),
  ipVersionMismatches: z.number(),
  unexpectedReconnects: z.number(),
  healthcheckFailures: z.number(),
  healthcheckBadStatus: z.number(),
  lastToastTimestamp: z.number(),
});

export type AggregatedStats = z.infer<typeof AggregatedStatsSchema>;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace AggregatedStats {
  export function loadOrCreateEmpty(name: string): AggregatedStats {
    const key = localStorageKey(name);
    try {
      const json = localStorage.getItem(key);
      return json != null
        ? AggregatedStatsSchema.parse(JSON.parse(json))
        : createEmpty();
    } catch (error) {
      log.warn(
        `Could not load [${key}] from local storage. Possibly, attempting to load for the first time`,
        Errors.toLogFormat(error)
      );
      return createEmpty();
    }
  }

  export function store(stats: AggregatedStats, name: string): void {
    const key = localStorageKey(name);
    try {
      const json = JSON.stringify(stats);
      localStorage.setItem(key, json);
    } catch (error) {
      log.warn(
        `Failed to store key [${key}] to the local storage`,
        Errors.toLogFormat(error)
      );
    }
  }

  export function add(a: AggregatedStats, b: AggregatedStats): AggregatedStats {
    return {
      requestsCompared: a.requestsCompared + b.requestsCompared,
      connectionFailures: a.connectionFailures + b.connectionFailures,
      healthcheckFailures: a.healthcheckFailures + b.healthcheckFailures,
      ipVersionMismatches: a.ipVersionMismatches + b.ipVersionMismatches,
      unexpectedReconnects: a.unexpectedReconnects + b.unexpectedReconnects,
      healthcheckBadStatus: a.healthcheckBadStatus + b.healthcheckBadStatus,
      lastToastTimestamp: Math.max(a.lastToastTimestamp, b.lastToastTimestamp),
    };
  }

  export function createEmpty(): AggregatedStats {
    return {
      requestsCompared: 0,
      connectionFailures: 0,
      ipVersionMismatches: 0,
      unexpectedReconnects: 0,
      healthcheckFailures: 0,
      healthcheckBadStatus: 0,
      lastToastTimestamp: 0,
    };
  }

  export function shouldReportError(stats: AggregatedStats): boolean {
    const timeSinceLastToast = Date.now() - stats.lastToastTimestamp;
    if (timeSinceLastToast < durations.DAY || stats.requestsCompared < 1000) {
      return false;
    }
    return (
      stats.healthcheckBadStatus +
        stats.healthcheckFailures +
        stats.connectionFailures >
        20 || stats.unexpectedReconnects > 50
    );
  }

  export function localStorageKey(name: string): string {
    return `${AGGREGATED_STATS_KEY}.${name}`;
  }
}

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
  headers?: ReadonlyArray<[string, string]>;
}>;

export type SendRequestResult = Readonly<{
  status: number;
  message: string;
  response?: Uint8Array;
  headers: ReadonlyArray<string>;
}>;

export enum TransportOption {
  // Only original transport is used
  Original = 'original',
  // All requests are going through the original transport,
  // but for every request that completes sucessfully we're initiating
  // a healthcheck request via libsignal transport,
  // collecting comparison statistics, and if we see many inconsistencies,
  // we're showing a toast asking user to submit a debug log
  ShadowingHigh = 'shadowingHigh',
  // Similar to `shadowingHigh`, however, only 10% of requests
  // will trigger a healthcheck, and toast is never shown.
  // Statistics data is still added to the debug logs,
  // so it will be available to us with all the debug log uploads.
  ShadowingLow = 'shadowingLow',
  // Only libsignal transport is used
  Libsignal = 'libsignal',
}

export type WebSocketResourceOptions = {
  name: string;
  handleRequest?: (request: IncomingWebSocketRequest) => void;
  keepalive?: KeepAliveOptionsType;
  transportOption?: TransportOption;
};

export class CloseEvent extends Event {
  constructor(public readonly code: number, public readonly reason: string) {
    super('close');
  }
}

// eslint-disable-next-line no-restricted-syntax
export interface IWebSocketResource extends IResource {
  sendRequest(options: SendRequestOptions): Promise<Response>;

  addEventListener(name: 'close', handler: (ev: CloseEvent) => void): void;

  forceKeepAlive(timeout?: number): void;

  shutdown(): void;

  close(): void;

  localPort(): number | undefined;
}

export class LibsignalWebSocketResource
  extends EventTarget
  implements IWebSocketResource
{
  constructor(
    private readonly chatService: Net.ChatService,
    private readonly socketIpVersion: IpVersion | undefined
  ) {
    super();
  }

  public static connect(
    libsignalNet: Net.Net,
    name: string
  ): AbortableProcess<LibsignalWebSocketResource> {
    const chatService = libsignalNet.newChatService();
    const connectAsync = async () => {
      try {
        const debugInfo = await chatService.connectUnauthenticated();
        log.info(`LibsignalWebSocketResource(${name}) connected`, debugInfo);
        return new LibsignalWebSocketResource(
          chatService,
          IpVersion.fromDebugInfoCode(debugInfo.ipType)
        );
      } catch (error) {
        // Handle any errors that occur during connection
        log.error(
          `LibsignalWebSocketResource(${name}) connection failed`,
          Errors.toLogFormat(error)
        );
        throw error;
      }
    };
    return new AbortableProcess<LibsignalWebSocketResource>(
      `LibsignalWebSocketResource.connect(${name})`,
      {
        abort() {
          // if interrupted, trying to disconnect
          drop(chatService.disconnect());
        },
      },
      connectAsync()
    );
  }

  public localPort(): number | undefined {
    return undefined;
  }

  public ipVersion(): IpVersion | undefined {
    return this.socketIpVersion;
  }

  public override addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public override addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public close(_code?: number, _reason?: string): void {
    drop(this.chatService.disconnect());
  }

  public shutdown(): void {
    drop(this.chatService.disconnect());
  }

  public forceKeepAlive(): void {
    // no-op
  }

  public async sendRequest(options: SendRequestOptions): Promise<Response> {
    const [response] = await this.sendRequestGetDebugInfo(options);
    return response;
  }

  public async sendRequestGetDebugInfo(
    options: SendRequestOptions
  ): Promise<[Response, ChatServiceDebugInfo]> {
    const { response, debugInfo } =
      await this.chatService.unauthenticatedFetchAndDebug({
        verb: options.verb,
        path: options.path,
        headers: options.headers ? options.headers : [],
        body: options.body,
        timeoutMillis: options.timeout,
      });
    return [
      new Response(response.body, {
        status: response.status,
        statusText: response.message,
        headers: [...response.headers],
      }),
      debugInfo,
    ];
  }
}

export class WebSocketResourceWithShadowing implements IWebSocketResource {
  private shadowing: LibsignalWebSocketResource | undefined;

  private stats: AggregatedStats;

  private statsTimer: NodeJS.Timer;

  private shadowingWithReporting: boolean;

  private logId: string;

  constructor(
    private readonly main: WebSocketResource,
    private readonly shadowingConnection: AbortableProcess<LibsignalWebSocketResource>,
    options: WebSocketResourceOptions
  ) {
    this.stats = AggregatedStats.createEmpty();
    this.logId = `WebSocketResourceWithShadowing(${options.name})`;
    this.statsTimer = setInterval(
      () => this.updateStats(options.name),
      STATS_UPDATE_INTERVAL
    );
    this.shadowingWithReporting =
      options.transportOption === TransportOption.ShadowingHigh;

    // the idea is that we want to keep the shadowing connection process
    // "in the background", so that the main connection wouldn't need to wait on it.
    // then when we're connected, `this.shadowing` socket resource is initialized
    // or an error reported in case of connection failure
    const initializeAfterConnected = async () => {
      try {
        this.shadowing = await shadowingConnection.resultPromise;
        // checking IP one time per connection
        if (this.main.ipVersion() !== this.shadowing.ipVersion()) {
          this.stats.ipVersionMismatches += 1;
          const mainIpType = this.main.ipVersion();
          const shadowIpType = this.shadowing.ipVersion();
          log.warn(
            `${this.logId}: libsignal websocket IP [${shadowIpType}], Desktop websocket IP [${mainIpType}]`
          );
        }
      } catch (error) {
        this.stats.connectionFailures += 1;
      }
    };
    drop(initializeAfterConnected());

    this.addEventListener('close', (_ev): void => {
      clearInterval(this.statsTimer);
      this.updateStats(options.name);
    });
  }

  private updateStats(name: string) {
    const storedStats = AggregatedStats.loadOrCreateEmpty(name);
    let updatedStats = AggregatedStats.add(storedStats, this.stats);
    if (
      this.shadowingWithReporting &&
      AggregatedStats.shouldReportError(updatedStats) &&
      !isProduction(window.getVersion())
    ) {
      window.reduxActions.toast.showToast({
        toastType: ToastType.TransportError,
      });
      log.warn(
        `${this.logId}: experimental transport toast displayed, flushing transport statistics before resetting`,
        updatedStats
      );
      updatedStats = AggregatedStats.createEmpty();
      updatedStats.lastToastTimestamp = Date.now();
    }
    AggregatedStats.store(updatedStats, name);
    this.stats = AggregatedStats.createEmpty();
  }

  public localPort(): number | undefined {
    return this.main.localPort();
  }

  public addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void {
    this.main.addEventListener(name, handler);
  }

  public close(): void {
    this.main.close();
    if (this.shadowing) {
      this.shadowing.close();
      this.shadowing = undefined;
    } else {
      this.shadowingConnection.abort();
    }
  }

  public shutdown(): void {
    this.main.shutdown();
    if (this.shadowing) {
      this.shadowing.shutdown();
      this.shadowing = undefined;
    } else {
      this.shadowingConnection.abort();
    }
  }

  public forceKeepAlive(timeout?: number): void {
    this.main.forceKeepAlive(timeout);
  }

  public async sendRequest(options: SendRequestOptions): Promise<Response> {
    const responsePromise = this.main.sendRequest(options);
    const response = await responsePromise;

    // if we're received a response from the main channel and the status was successful,
    // attempting to run a healthcheck on a libsignal transport.
    if (
      isSuccessfulStatusCode(response.status) &&
      this.shouldSendShadowRequest()
    ) {
      drop(this.sendShadowRequest());
    }

    return response;
  }

  private async sendShadowRequest(): Promise<void> {
    // In the shadowing mode, it could be that we're either
    // still connecting libsignal websocket or have already closed it.
    // In those cases we're not running shadowing check.
    if (!this.shadowing) {
      log.info(
        `${this.logId}: skipping healthcheck - websocket not connected or already closed`
      );
      return;
    }
    try {
      const [healthCheckResult, debugInfo] =
        await this.shadowing.sendRequestGetDebugInfo({
          verb: 'GET',
          path: '/v1/keepalive',
          timeout: KEEPALIVE_TIMEOUT_MS,
        });
      this.stats.requestsCompared += 1;
      if (!isSuccessfulStatusCode(healthCheckResult.status)) {
        this.stats.healthcheckBadStatus += 1;
        log.warn(
          `${this.logId}: keepalive via libsignal responded with status [${healthCheckResult.status}]`
        );
      }
      this.stats.unexpectedReconnects = debugInfo.reconnectCount;
    } catch (error) {
      this.stats.healthcheckFailures += 1;
      log.warn(
        `${this.logId}: failed to send keepalive via libsignal`,
        Errors.toLogFormat(error)
      );
    }
  }

  private shouldSendShadowRequest(): boolean {
    return this.shadowingWithReporting || random(0, 100) < 10;
  }
}

function isSuccessfulStatusCode(status: number): boolean {
  return status >= 200 && status < 300;
}

export default class WebSocketResource
  extends EventTarget
  implements IWebSocketResource
{
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

  private readonly localSocketPort: number | undefined;

  private readonly socketIpVersion: IpVersion | undefined;

  // Public for tests
  public readonly keepalive?: KeepAlive;

  constructor(
    private readonly socket: WebSocket,
    private readonly options: WebSocketResourceOptions
  ) {
    super();

    this.logId = `WebSocketResource(${options.name})`;
    this.localSocketPort = socket.socket.localPort;

    if (!socket.socket.localAddress) {
      this.socketIpVersion = undefined;
    }
    if (socket.socket.localAddress == null) {
      this.socketIpVersion = undefined;
    } else if (net.isIPv4(socket.socket.localAddress)) {
      this.socketIpVersion = IpVersion.IPv4;
    } else if (net.isIPv6(socket.socket.localAddress)) {
      this.socketIpVersion = IpVersion.IPv6;
    } else {
      this.socketIpVersion = undefined;
    }

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

  public ipVersion(): IpVersion | undefined {
    return this.socketIpVersion;
  }

  public localPort(): number | undefined {
    return this.localSocketPort;
  }

  public override addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public override addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public async sendRequest(options: SendRequestOptions): Promise<Response> {
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
        headers: options.headers
          ? options.headers
              .map(([key, value]) => {
                return `${key}:${value}`;
              })
              .slice()
          : undefined,
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
      let timer = options.timeout
        ? Timers.setTimeout(() => {
            this.removeActive(idString);
            this.close(3001, 'Request timed out');
            reject(new Error(`Request timed out; id: [${idString}]`));
          }, options.timeout)
        : undefined;

      this.outgoingMap.set(idString, result => {
        if (timer !== undefined) {
          Timers.clearTimeout(timer);
          timer = undefined;
        }

        this.keepalive?.reset();
        this.removeActive(idString);
        resolve(result);
      });
    });

    this.socket.sendBytes(Buffer.from(bytes));

    const requestResult = await promise;
    return WebSocketResource.intoResponse(requestResult);
  }

  public forceKeepAlive(timeout?: number): void {
    if (!this.keepalive) {
      return;
    }
    drop(this.keepalive.send(timeout));
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

  private static intoResponse(sendRequestResult: SendRequestResult): Response {
    const {
      status,
      message: statusText,
      response,
      headers: flatResponseHeaders,
    } = sendRequestResult;

    const headers: Array<[string, string]> = flatResponseHeaders.map(header => {
      const [key, value] = header.split(':', 2);
      strictAssert(value !== undefined, 'Invalid header!');
      return [key, value];
    });

    return new Response(response, {
      status,
      statusText,
      headers,
    });
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

// If we don't receive a response to keepalive request within 30 seconds -
// close the socket.
const KEEPALIVE_TIMEOUT_MS = 30 * durations.SECOND;

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

  public async send(timeout = KEEPALIVE_TIMEOUT_MS): Promise<void> {
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
        timeout
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
