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

import pTimeout from 'p-timeout';
import { Response } from 'node-fetch';
import { z } from 'zod';

import type { LibSignalError, Net } from '@signalapp/libsignal-client';
import { ErrorCode } from '@signalapp/libsignal-client';
import type {
  AuthenticatedChatConnection,
  ChatServerMessageAck,
  ChatServiceListener,
  ConnectionEventsListener,
  UnauthenticatedChatConnection,
} from '@signalapp/libsignal-client/dist/net/Chat.js';
import type { EventHandler } from './EventTarget.std.js';
import EventTarget from './EventTarget.std.js';

import * as durations from '../util/durations/index.std.js';
import { drop } from '../util/drop.std.js';
import { isOlderThan } from '../util/timestamp.std.js';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Timers from '../Timers.preload.js';

import { AbortableProcess } from '../util/AbortableProcess.std.js';
import type { WebAPICredentials } from './Types.d.ts';
import { NORMAL_DISCONNECT_CODE } from './SocketManager.preload.js';
import { parseUnknown } from '../util/schemas.std.js';
import { parseServerAlertsFromHeader } from '../util/handleServerAlerts.preload.js';
import type { ServerAlert } from '../types/ServerAlert.std.js';

const log = createLogger('WebsocketResources');

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

export class IncomingWebSocketRequest {
  constructor(
    readonly requestType: ServerRequestType,
    readonly body: Uint8Array | undefined,
    readonly timestamp: number | undefined,
    private readonly ack: Pick<ChatServerMessageAck, 'send'> | undefined
  ) {}

  respond(status: number, _message: string): void {
    this.ack?.send(status);
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

export type WebSocketResourceOptions = {
  name: string;
  handleRequest?: (request: IncomingWebSocketRequest) => void;
  keepalive?: KeepAliveOptionsType;
};

export class CloseEvent extends Event {
  constructor(
    public readonly code: number,
    public readonly reason: string
  ) {
    super('close');
  }
}

export type ChatKind = 'auth' | 'unauth';

type ChatConnection<Kind extends ChatKind> = Kind extends 'auth'
  ? AuthenticatedChatConnection
  : UnauthenticatedChatConnection;

// eslint-disable-next-line no-restricted-syntax
export interface IWebSocketResource {
  sendRequest(options: SendRequestOptions): Promise<Response>;

  addEventListener(name: 'close', handler: (ev: CloseEvent) => void): void;

  forceKeepAlive(timeout?: number): void;

  shutdown(): void;

  close(code?: number, reason?: string): void;

  localPort(): number | undefined;
}

export type IChatConnection<Chat extends ChatKind> = IWebSocketResource & {
  get libsignalWebsocket(): ChatConnection<Chat>;
};

type WebSocketResourceHandler<Chat extends ChatKind> = {
  resource: WebSocketResource<Chat> | undefined;
};

const UNEXPECTED_DISCONNECT_CODE = 3001;

export function connectUnauthenticated({
  libsignalNet,
  name,
  userLanguages,
  keepalive,
}: {
  libsignalNet: Net.Net;
  name: string;
  userLanguages: ReadonlyArray<string>;
  keepalive: KeepAliveOptionsType;
}): AbortableProcess<WebSocketResource<'unauth'>> {
  const logId = `WebSocketResource(${name})`;
  const listener: WebSocketResourceHandler<'unauth'> &
    ConnectionEventsListener = {
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
  return connect(
    abortSignal =>
      libsignalNet.connectUnauthenticatedChat(listener, {
        abortSignal,
        languages: [...userLanguages],
      }),
    listener,
    logId,
    keepalive
  );
}

export function connectAuthenticated({
  libsignalNet,
  name,
  credentials,
  handler,
  receiveStories,
  userLanguages,
  keepalive,
  onReceivedAlerts,
}: {
  libsignalNet: Net.Net;
  name: string;
  credentials: WebAPICredentials;
  handler: (request: IncomingWebSocketRequest) => void;
  onReceivedAlerts: (alerts: Array<ServerAlert>) => void;
  receiveStories: boolean;
  userLanguages: ReadonlyArray<string>;
  keepalive: KeepAliveOptionsType;
}): AbortableProcess<WebSocketResource<'auth'>> {
  const logId = `WebSocketResource(${name})`;
  const listener: WebSocketResourceHandler<'auth'> & ChatServiceListener = {
    resource: undefined,
    onIncomingMessage(
      envelope: Uint8Array,
      timestamp: number,
      ack: ChatServerMessageAck
    ): void {
      // Handle incoming messages even if we've disconnected.
      const request = new IncomingWebSocketRequest(
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
      const request = new IncomingWebSocketRequest(
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
    onReceivedAlerts(alerts: Array<string>): void {
      onReceivedAlerts(alerts.map(parseServerAlertsFromHeader).flat());
    },
  };
  return connect(
    (abortSignal: AbortSignal) =>
      libsignalNet.connectAuthenticatedChat(
        credentials.username,
        credentials.password,
        receiveStories,
        listener,
        { abortSignal, languages: [...userLanguages] }
      ),
    listener,
    logId,
    keepalive
  );
}

function logDisconnectedListenerWarn(logId: string, method: string): void {
  log.warn(`${logId} received ${method}, but listener already disconnected`);
}

function connect<Chat extends ChatKind>(
  makeConnection: (abortSignal: AbortSignal) => Promise<ChatConnection<Chat>>,
  resourceHolder: WebSocketResourceHandler<Chat>,
  logId: string,
  keepalive: KeepAliveOptionsType
): AbortableProcess<WebSocketResource<Chat>> {
  const abortController = new AbortController();
  const connectAsync = async () => {
    try {
      const service = await makeConnection(abortController.signal);
      log.info(`${logId} connected`);
      const connectionInfo = service.connectionInfo();
      const resource = new WebSocketResource(
        service,
        IpVersion[connectionInfo.ipVersion],
        connectionInfo.localPort,
        logId,
        keepalive
      );
      if (abortController.signal.aborted) {
        resource.close(3000, 'aborted');
        throw new Error('Aborted');
      }
      // eslint-disable-next-line no-param-reassign
      resourceHolder.resource = resource;
      return resource;
    } catch (error) {
      // Handle any errors that occur during connection
      log.error(`${logId} connection failed`, Errors.toLogFormat(error));
      throw error;
    }
  };
  return new AbortableProcess<WebSocketResource<Chat>>(
    `${logId}.connect`,
    {
      abort() {
        if (resourceHolder.resource != null) {
          log.warn(`${logId}: closing socket`);
          resourceHolder.resource.close(3000, 'aborted');
        } else {
          abortController.abort();
        }
      },
    },
    connectAsync()
  );
}

export class WebSocketResource<Chat extends ChatKind>
  extends EventTarget
  implements IChatConnection<Chat>
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
    private readonly chatService: ChatConnection<Chat>,
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

    // This is a workaround to map libsignal error codes to close codes that
    // SocketManager's existing clients expect.
    // TODO: When we can refactor the SocketManager API, we should come up
    // with a better solution that is not dependent on the raw close codes.
    let event: CloseEvent;
    if (cause == null) {
      event = new CloseEvent(NORMAL_DISCONNECT_CODE, 'normal');
    } else if (cause.code === ErrorCode.ConnectedElsewhere) {
      event = new CloseEvent(4409, cause.message);
    } else if (cause.code === ErrorCode.ConnectionInvalidated) {
      event = new CloseEvent(4401, cause.message);
    } else {
      event = new CloseEvent(UNEXPECTED_DISCONNECT_CODE, cause.message);
    }

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

  get libsignalWebsocket(): ChatConnection<Chat> {
    return this.chatService;
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
