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

import type { LibSignalError, Net } from '@signalapp/libsignal-client';
import { Buffer } from 'node:buffer';
import type {
  ChatServerMessageAck,
  ChatServiceListener,
  ConnectionEventsListener,
} from '@signalapp/libsignal-client/dist/net';
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

import { AbortableProcess } from '../util/AbortableProcess';
import type { WebAPICredentials } from './Types';
import { NORMAL_DISCONNECT_CODE } from './SocketManager';
import { parseUnknown } from '../util/schemas';

const THIRTY_SECONDS = 30 * durations.SECOND;

const MAX_MESSAGE_SIZE = 512 * 1024;

const AGGREGATED_STATS_KEY = 'websocketStats';

export enum IpVersion {
  IPv4 = 'ipv4',
  IPv6 = 'ipv6',
}

const AggregatedStatsSchema = z.object({
  connectionFailures: z.number(),
  requestsCompared: z.number(),
  ipVersionMismatches: z.number(),
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
        ? parseUnknown(AggregatedStatsSchema, JSON.parse(json) as unknown)
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
      healthcheckBadStatus: a.healthcheckBadStatus + b.healthcheckBadStatus,
      lastToastTimestamp: Math.max(a.lastToastTimestamp, b.lastToastTimestamp),
    };
  }

  export function createEmpty(): AggregatedStats {
    return {
      requestsCompared: 0,
      connectionFailures: 0,
      ipVersionMismatches: 0,
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
    const totalFailuresSinceLastToast =
      stats.healthcheckBadStatus +
      stats.healthcheckFailures +
      stats.connectionFailures;
    return totalFailuresSinceLastToast > 20;
  }

  export function localStorageKey(name: string): string {
    return `${AGGREGATED_STATS_KEY}.${name}`;
  }
}

export enum ServerRequestType {
  ApiMessage = '/api/v1/message',
  ApiEmptyQueue = '/api/v1/queue/empty',
  ProvisioningMessage = '/v1/message',
  ProvisioningAddress = '/v1/address',
  Unknown = 'unknown',
}

export type IncomingWebSocketRequest = {
  readonly requestType: ServerRequestType;
  readonly body: Uint8Array | undefined;
  readonly timestamp: number | undefined;

  respond(status: number, message: string): void;
};

export class IncomingWebSocketRequestLibsignal
  implements IncomingWebSocketRequest
{
  constructor(
    readonly requestType: ServerRequestType,
    readonly body: Uint8Array | undefined,
    readonly timestamp: number | undefined,
    private readonly ack: ChatServerMessageAck | undefined
  ) {}

  respond(status: number, _message: string): void {
    this.ack?.send(status);
  }
}

export class IncomingWebSocketRequestLegacy
  implements IncomingWebSocketRequest
{
  readonly #id: Long;

  public readonly requestType: ServerRequestType;

  public readonly body: Uint8Array | undefined;

  public readonly timestamp: number | undefined;

  constructor(
    request: Proto.IWebSocketRequestMessage,
    private readonly sendBytes: (bytes: Buffer) => void
  ) {
    strictAssert(request.id, 'request without id');
    strictAssert(request.verb, 'request without verb');
    strictAssert(request.path, 'request without path');

    this.#id = request.id;
    this.requestType = resolveType(request.path, request.verb);
    this.body = dropNull(request.body);
    this.timestamp = resolveTimestamp(request.headers || []);
  }

  public respond(status: number, message: string): void {
    const bytes = Proto.WebSocketMessage.encode({
      type: Proto.WebSocketMessage.Type.RESPONSE,
      response: { id: this.#id, message, status },
    }).finish();

    this.sendBytes(Buffer.from(bytes));
  }
}

function resolveType(path: string, verb: string): ServerRequestType {
  if (path === ServerRequestType.ApiMessage) {
    return ServerRequestType.ApiMessage;
  }
  if (path === ServerRequestType.ApiEmptyQueue && verb === 'PUT') {
    return ServerRequestType.ApiEmptyQueue;
  }
  if (path === ServerRequestType.ProvisioningAddress && verb === 'PUT') {
    return ServerRequestType.ProvisioningAddress;
  }
  if (path === ServerRequestType.ProvisioningMessage && verb === 'PUT') {
    return ServerRequestType.ProvisioningMessage;
  }
  return ServerRequestType.Unknown;
}

function resolveTimestamp(headers: ReadonlyArray<string>): number | undefined {
  // The 'X-Signal-Timestamp' is usually the last item, so start there.
  let it = headers.length;
  // eslint-disable-next-line no-plusplus
  while (--it >= 0) {
    const match = headers[it].match(/^X-Signal-Timestamp:\s*(\d+)\s*$/i);
    if (match && match.length === 2) {
      return Number(match[1]);
    }
  }
  return undefined;
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
  constructor(
    public readonly code: number,
    public readonly reason: string
  ) {
    super('close');
  }
}

// eslint-disable-next-line no-restricted-syntax
export interface IWebSocketResource extends IResource {
  sendRequest(options: SendRequestOptions): Promise<Response>;

  addEventListener(name: 'close', handler: (ev: CloseEvent) => void): void;

  forceKeepAlive(timeout?: number): void;

  shutdown(): void;

  close(code?: number, reason?: string): void;

  localPort(): number | undefined;
}

type LibsignalWebSocketResourceHolder = {
  resource: LibsignalWebSocketResource | undefined;
};

const UNEXPECTED_DISCONNECT_CODE = 3001;

export function connectUnauthenticatedLibsignal({
  libsignalNet,
  name,
  keepalive,
}: {
  libsignalNet: Net.Net;
  name: string;
  keepalive: KeepAliveOptionsType;
}): AbortableProcess<LibsignalWebSocketResource> {
  const logId = `LibsignalWebSocketResource(${name})`;
  const listener: LibsignalWebSocketResourceHolder & ConnectionEventsListener =
    {
      resource: undefined,
      onConnectionInterrupted(cause: LibSignalError | null): void {
        if (!this.resource) {
          logDisconnectedListenerWarn(logId, 'onConnectionInterrupted');
          return;
        }
        this.resource.onConnectionInterrupted(cause);
        this.resource = undefined;
      },
    };
  return connectLibsignal(
    abortSignal =>
      libsignalNet.connectUnauthenticatedChat(listener, {
        abortSignal,
      }),
    listener,
    logId,
    keepalive
  );
}

export function connectAuthenticatedLibsignal({
  libsignalNet,
  name,
  credentials,
  handler,
  receiveStories,
  keepalive,
}: {
  libsignalNet: Net.Net;
  name: string;
  credentials: WebAPICredentials;
  handler: (request: IncomingWebSocketRequest) => void;
  receiveStories: boolean;
  keepalive: KeepAliveOptionsType;
}): AbortableProcess<LibsignalWebSocketResource> {
  const logId = `LibsignalWebSocketResource(${name})`;
  const listener: LibsignalWebSocketResourceHolder & ChatServiceListener = {
    resource: undefined,
    onIncomingMessage(
      envelope: Buffer,
      timestamp: number,
      ack: ChatServerMessageAck
    ): void {
      // Handle incoming messages even if we've disconnected.
      const request = new IncomingWebSocketRequestLibsignal(
        ServerRequestType.ApiMessage,
        envelope,
        timestamp,
        ack
      );
      handler(request);
    },
    onQueueEmpty(): void {
      if (!this.resource) {
        logDisconnectedListenerWarn(logId, 'onQueueEmpty');
        return;
      }
      const request = new IncomingWebSocketRequestLibsignal(
        ServerRequestType.ApiEmptyQueue,
        undefined,
        undefined,
        undefined
      );
      handler(request);
    },
    onConnectionInterrupted(cause): void {
      if (!this.resource) {
        logDisconnectedListenerWarn(logId, 'onConnectionInterrupted');
        return;
      }
      this.resource.onConnectionInterrupted(cause);
      this.resource = undefined;
    },
  };
  return connectLibsignal(
    (abortSignal: AbortSignal) =>
      libsignalNet.connectAuthenticatedChat(
        credentials.username,
        credentials.password,
        receiveStories,
        listener,
        { abortSignal }
      ),
    listener,
    logId,
    keepalive
  );
}

function logDisconnectedListenerWarn(logId: string, method: string): void {
  log.warn(`${logId} received ${method}, but listener already disconnected`);
}

function connectLibsignal(
  makeConnection: (
    abortSignal: AbortSignal
  ) => Promise<
    Net.UnauthenticatedChatConnection | Net.AuthenticatedChatConnection
  >,
  resourceHolder: LibsignalWebSocketResourceHolder,
  logId: string,
  keepalive: KeepAliveOptionsType
): AbortableProcess<LibsignalWebSocketResource> {
  const abortController = new AbortController();
  const connectAsync = async () => {
    try {
      const service = await makeConnection(abortController.signal);
      log.info(`${logId} connected`);
      const connectionInfo = service.connectionInfo();
      const resource = new LibsignalWebSocketResource(
        service,
        IpVersion[connectionInfo.ipVersion],
        connectionInfo.localPort,
        logId,
        keepalive
      );
      // eslint-disable-next-line no-param-reassign
      resourceHolder.resource = resource;
      return resource;
    } catch (error) {
      // Handle any errors that occur during connection
      log.error(`${logId} connection failed`, Errors.toLogFormat(error));
      throw error;
    }
  };
  return new AbortableProcess<LibsignalWebSocketResource>(
    `${logId}.connect`,
    abortController,
    connectAsync()
  );
}

export class LibsignalWebSocketResource
  extends EventTarget
  implements IWebSocketResource
{
  // The reason that the connection was closed, if it was closed.
  //
  // When setting this to anything other than `undefined`, the "close" event
  // must be dispatched.
  #closedReasonCode?: number;

  // libsignal will use websocket pings to keep the connection open, but
  // - Server uses /v1/keepalive requests to do some consistency checks
  // - external events (like waking from sleep) can prompt us to do a shorter keepalive
  // So at least for now, we want to keep this mechanism around too.
  #keepalive: KeepAlive;

  constructor(
    private readonly chatService: Net.ChatConnection,
    private readonly socketIpVersion: IpVersion,
    private readonly localPortNumber: number,
    private readonly logId: string,
    keepalive: KeepAliveOptionsType
  ) {
    super();

    this.#keepalive = new KeepAlive(this, this.logId, keepalive);
    this.#keepalive.reset();
    this.addEventListener('close', () => this.#keepalive?.stop());
  }

  public localPort(): number {
    return this.localPortNumber;
  }

  public ipVersion(): IpVersion {
    return this.socketIpVersion;
  }

  public override addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public override addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public close(code = NORMAL_DISCONNECT_CODE, reason?: string): void {
    if (this.#closedReasonCode !== undefined) {
      log.info(`${this.logId}.close: Already closed! ${code}/${reason}`);
      return;
    }

    this.#closedReasonCode = code;
    drop(this.chatService.disconnect());

    // Since we set `closedReasonCode`, we must dispatch the close event.
    this.dispatchEvent(new CloseEvent(code, reason || 'no reason provided'));
  }

  public shutdown(): void {
    this.close(NORMAL_DISCONNECT_CODE, 'Shutdown');
  }

  onConnectionInterrupted(cause: LibSignalError | null): void {
    if (this.#closedReasonCode !== undefined) {
      if (cause != null) {
        // This can happen normally if there's a race between a disconnect
        // request and an error on the connection. It's likely benign but in
        // case it's not, make sure we know about it.
        log.info(
          `${this.logId}: onConnectionInterrupted called after resource is closed: ${cause.message}`
        );
      }
      return;
    }
    log.warn(`${this.logId}: connection closed`);

    const event = cause
      ? new CloseEvent(UNEXPECTED_DISCONNECT_CODE, cause.message)
      : // The cause was an intentional disconnect. Report normal closure.
        new CloseEvent(NORMAL_DISCONNECT_CODE, 'normal');
    this.#closedReasonCode = event.code;
    this.dispatchEvent(event);
  }

  public forceKeepAlive(timeout?: number): void {
    drop(this.#keepalive.send(timeout));
  }

  public async sendRequest(options: SendRequestOptions): Promise<Response> {
    const response = await this.sendRequestGetDebugInfo(options);
    return response;
  }

  public async sendRequestGetDebugInfo(
    options: SendRequestOptions
  ): Promise<Response> {
    const response = await this.chatService.fetch({
      verb: options.verb,
      path: options.path,
      headers: options.headers ? options.headers : [],
      body: options.body,
      timeoutMillis: options.timeout,
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.message,
      headers: [...response.headers],
    });
  }
}

export default class WebSocketResource
  extends EventTarget
  implements IWebSocketResource
{
  #outgoingId = Long.fromNumber(1, true);
  #closed = false;

  readonly #outgoingMap = new Map<
    string,
    (result: SendRequestResult) => void
  >();

  readonly #boundOnMessage: (message: IMessage) => void;
  #activeRequests = new Set<IncomingWebSocketRequest | string>();
  #shuttingDown = false;
  #shutdownTimer?: Timers.Timeout;
  readonly #logId: string;
  readonly #localSocketPort: number | undefined;
  readonly #socketIpVersion: IpVersion | undefined;

  // Public for tests
  public readonly keepalive?: KeepAlive;

  constructor(
    private readonly socket: WebSocket,
    private readonly options: WebSocketResourceOptions
  ) {
    super();

    this.#logId = `WebSocketResource(${options.name})`;
    this.#localSocketPort = socket.socket.localPort;

    if (!socket.socket.localAddress) {
      this.#socketIpVersion = undefined;
    }
    if (socket.socket.localAddress == null) {
      this.#socketIpVersion = undefined;
    } else if (net.isIPv4(socket.socket.localAddress)) {
      this.#socketIpVersion = IpVersion.IPv4;
    } else if (net.isIPv6(socket.socket.localAddress)) {
      this.#socketIpVersion = IpVersion.IPv6;
    } else {
      this.#socketIpVersion = undefined;
    }

    this.#boundOnMessage = this.#onMessage.bind(this);

    socket.on('message', this.#boundOnMessage);

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
        log.warn(`${this.#logId}: WebSocket error`, Errors.toLogFormat(error));
      });
    }

    socket.on('close', (code, reason) => {
      this.#closed = true;

      log.warn(`${this.#logId}: Socket closed`);
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    });

    this.addEventListener('close', () => this.#onClose());
  }

  public ipVersion(): IpVersion | undefined {
    return this.#socketIpVersion;
  }

  public localPort(): number | undefined {
    return this.#localSocketPort;
  }

  public override addEventListener(
    name: 'close',
    handler: (ev: CloseEvent) => void
  ): void;

  public override addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public async sendRequest(options: SendRequestOptions): Promise<Response> {
    const id = this.#outgoingId;
    const idString = id.toString();
    strictAssert(
      !this.#outgoingMap.has(idString),
      'Duplicate outgoing request'
    );

    // Note that this automatically wraps
    this.#outgoingId = this.#outgoingId.add(1);

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

    strictAssert(!this.#shuttingDown, 'Cannot send request, shutting down');
    this.#addActive(idString);
    const promise = new Promise<SendRequestResult>((resolve, reject) => {
      let timer = options.timeout
        ? Timers.setTimeout(() => {
            this.#removeActive(idString);
            this.close(UNEXPECTED_DISCONNECT_CODE, 'Request timed out');
            reject(new Error(`Request timed out; id: [${idString}]`));
          }, options.timeout)
        : undefined;

      this.#outgoingMap.set(idString, result => {
        if (timer !== undefined) {
          Timers.clearTimeout(timer);
          timer = undefined;
        }

        this.keepalive?.reset();
        this.#removeActive(idString);
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

  public close(code = NORMAL_DISCONNECT_CODE, reason?: string): void {
    if (this.#closed) {
      log.info(`${this.#logId}.close: Already closed! ${code}/${reason}`);
      return;
    }

    log.info(`${this.#logId}.close(${code})`);
    if (this.keepalive) {
      this.keepalive.stop();
    }

    this.socket.close(code, reason);

    this.socket.removeListener('message', this.#boundOnMessage);

    // On linux the socket can wait a long time to emit its close event if we've
    //   lost the internet connection. On the order of minutes. This speeds that
    //   process up.
    Timers.setTimeout(() => {
      if (this.#closed) {
        return;
      }

      log.warn(`${this.#logId}.close: Dispatching our own socket close event`);
      this.dispatchEvent(new CloseEvent(code, reason || 'normal'));
    }, 5 * durations.SECOND);
  }

  public shutdown(): void {
    if (this.#closed) {
      return;
    }

    if (this.#activeRequests.size === 0) {
      log.info(`${this.#logId}.shutdown: no active requests, closing`);
      this.close(NORMAL_DISCONNECT_CODE, 'Shutdown');
      return;
    }

    this.#shuttingDown = true;

    log.info(`${this.#logId}.shutdown: shutting down`);
    this.#shutdownTimer = Timers.setTimeout(() => {
      if (this.#closed) {
        return;
      }

      log.warn(`${this.#logId}.shutdown: Failed to shutdown gracefully`);
      this.close(NORMAL_DISCONNECT_CODE, 'Shutdown');
    }, THIRTY_SECONDS);
  }

  #onMessage({ type, binaryData }: IMessage): void {
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

      const incomingRequest = new IncomingWebSocketRequestLegacy(
        message.request,
        (bytes: Buffer): void => {
          this.#removeActive(incomingRequest);

          strictAssert(
            bytes.length <= MAX_MESSAGE_SIZE,
            'WebSocket response byte size exceeded'
          );
          this.socket.sendBytes(bytes);
        }
      );

      if (this.#shuttingDown) {
        incomingRequest.respond(-1, 'Shutting down');
        return;
      }

      this.#addActive(incomingRequest);
      handleRequest(incomingRequest);
    } else if (
      message.type === Proto.WebSocketMessage.Type.RESPONSE &&
      message.response
    ) {
      const { response } = message;
      strictAssert(response.id, 'response without id');

      const responseIdString = response.id.toString();
      const resolve = this.#outgoingMap.get(responseIdString);
      this.#outgoingMap.delete(responseIdString);

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

  #onClose(): void {
    const outgoing = new Map(this.#outgoingMap);
    this.#outgoingMap.clear();

    for (const resolve of outgoing.values()) {
      resolve({
        status: -1,
        message: 'Connection closed',
        response: undefined,
        headers: [],
      });
    }
  }

  #addActive(request: IncomingWebSocketRequest | string): void {
    this.#activeRequests.add(request);
  }

  #removeActive(request: IncomingWebSocketRequest | string): void {
    if (!this.#activeRequests.has(request)) {
      log.warn(`${this.#logId}.removeActive: removing unknown request`);
      return;
    }

    this.#activeRequests.delete(request);
    if (this.#activeRequests.size !== 0) {
      return;
    }
    if (!this.#shuttingDown) {
      return;
    }

    if (this.#shutdownTimer) {
      Timers.clearTimeout(this.#shutdownTimer);
      this.#shutdownTimer = undefined;
    }

    log.info(`${this.#logId}.removeActive: shutdown complete`);
    this.close(NORMAL_DISCONNECT_CODE, 'Shutdown');
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

/**
 * References an {@link IWebSocketResource} and a request path that should
 * return promptly to determine whether the connection is still alive.
 *
 * The response to the request must have a 2xx status code but is otherwise
 * ignored. A failing response or a timeout results in the socket being closed
 * with {@link UNEXPECTED_DISCONNECT_CODE}.
 *
 * Use the subclass {@link KeepAlive} if you want to send the request at regular
 * intervals.
 */
class KeepAliveSender {
  #path: string;

  protected wsr: IWebSocketResource;

  protected logId: string;

  constructor(
    websocketResource: IWebSocketResource,
    name: string,
    opts: KeepAliveOptionsType = {}
  ) {
    this.logId = `WebSocketResources.KeepAlive(${name})`;
    this.#path = opts.path ?? '/';
    this.wsr = websocketResource;
  }

  public async send(timeout = KEEPALIVE_TIMEOUT_MS): Promise<boolean> {
    log.info(`${this.logId}.send: Sending a keepalive message`);
    const sentAt = Date.now();

    try {
      const { status } = await pTimeout(
        this.wsr.sendRequest({
          verb: 'GET',
          path: this.#path,
        }),
        timeout
      );

      if (status < 200 || status >= 300) {
        log.warn(`${this.logId}.send: keepalive response status ${status}`);
        this.wsr.close(
          UNEXPECTED_DISCONNECT_CODE,
          `keepalive response with ${status} code`
        );
        return false;
      }
    } catch (error) {
      this.wsr.close(
        UNEXPECTED_DISCONNECT_CODE,
        `No response to keepalive request after ${timeout}ms`
      );
      return false;
    }

    const responseTime = Date.now() - sentAt;
    if (responseTime > LOG_KEEPALIVE_AFTER_MS) {
      log.warn(
        `${this.logId}.send: delayed response to keepalive request, ` +
          `response time: ${responseTime}ms`
      );
    }

    return true;
  }
}

/**
 * Manages a timer that checks if a particular {@link IWebSocketResource} is
 * still alive.
 *
 * Some kinds of resource are expected to manage their own liveness checks. If you want to
 * manually send keepalive requests to such resources, use the base class
 * {@link KeepAliveSender}.
 */
class KeepAlive extends KeepAliveSender {
  #keepAliveTimer: Timers.Timeout | undefined;
  #lastAliveAt: number = Date.now();

  constructor(
    websocketResource: IWebSocketResource,
    name: string,
    opts: KeepAliveOptionsType = {}
  ) {
    super(websocketResource, name, opts);
  }

  public stop(): void {
    this.#clearTimers();
  }

  public override async send(timeout = KEEPALIVE_TIMEOUT_MS): Promise<boolean> {
    this.#clearTimers();

    const isStale = isOlderThan(this.#lastAliveAt, STALE_THRESHOLD_MS);
    if (isStale) {
      log.info(`${this.logId}.send: disconnecting due to stale state`);
      this.wsr.close(
        UNEXPECTED_DISCONNECT_CODE,
        `Last keepalive request was too far in the past: ${this.#lastAliveAt}`
      );
      return false;
    }

    const isAlive = await super.send(timeout);
    if (!isAlive) {
      return false;
    }

    // Successful response on time
    this.reset();
    return true;
  }

  public reset(): void {
    this.#lastAliveAt = Date.now();

    this.#clearTimers();

    this.#keepAliveTimer = Timers.setTimeout(
      () => this.send(),
      KEEPALIVE_INTERVAL_MS
    );
  }

  #clearTimers(): void {
    if (this.#keepAliveTimer) {
      Timers.clearTimeout(this.#keepAliveTimer);
      this.#keepAliveTimer = undefined;
    }
  }
}
