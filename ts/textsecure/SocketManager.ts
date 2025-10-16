// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  ErrorCode,
  LibSignalErrorBase,
  type Net,
} from '@signalapp/libsignal-client';
import URL from 'node:url';
import type { RequestInit, Response } from 'node-fetch';
import { Headers } from 'node-fetch';
import type { connection as WebSocket } from 'websocket';
import qs from 'node:querystring';
import EventListener from 'node:events';
import type { IncomingMessage } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

import type { AbortableProcess } from '../util/AbortableProcess.std.js';
import { strictAssert } from '../util/assert.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import {
  BackOff,
  EXTENDED_FIBONACCI_TIMEOUTS,
  FIBONACCI_TIMEOUTS,
} from '../util/BackOff.std.js';
import * as durations from '../util/durations/index.std.js';
import { drop } from '../util/drop.std.js';
import type { ProxyAgent } from '../util/createProxyAgent.node.js';
import { createProxyAgent } from '../util/createProxyAgent.node.js';
import { type SocketInfo, SocketStatus } from '../types/SocketStatus.std.js';
import { HTTPError } from '../types/HTTPError.std.js';
import * as Errors from '../types/errors.std.js';
import * as Bytes from '../Bytes.std.js';
import { createLogger } from '../logging/log.std.js';

import type {
  IncomingWebSocketRequest,
  IWebSocketResource,
  WebSocketResourceOptions,
} from './WebsocketResources.preload.js';
import WebSocketResource, {
  connectAuthenticatedLibsignal,
  connectUnauthenticatedLibsignal,
  ServerRequestType,
} from './WebsocketResources.preload.js';
import { ConnectTimeoutError } from './Errors.std.js';
import type { IRequestHandler, WebAPICredentials } from './Types.d.ts';
import { connect as connectWebSocket } from './WebSocket.preload.js';
import type { ServerAlert } from '../types/ServerAlert.std.js';
import { getUserLanguages } from '../util/userLanguages.std.js';

const log = createLogger('SocketManager');

const FIVE_MINUTES = 5 * durations.MINUTE;

const JITTER = 5 * durations.SECOND;

const OFFLINE_KEEPALIVE_TIMEOUT_MS = 5 * durations.SECOND;
export const UNAUTHENTICATED_CHANNEL_NAME = 'unauthenticated';

export const AUTHENTICATED_CHANNEL_NAME = 'authenticated';

export const NORMAL_DISCONNECT_CODE = 3000;

export type SocketManagerOptions = Readonly<{
  url: string;
  certificateAuthority: string;
  version: string;
  proxyUrl?: string;
}>;

type SocketStatusUpdate = { status: SocketStatus };

export type SocketStatuses = Record<
  'authenticated' | 'unauthenticated',
  SocketInfo
>;

export type SocketExpirationReason = 'remote' | 'build';

// This class manages two websocket resources:
//
// - Authenticated IWebSocketResource which uses supplied WebAPICredentials and
//   automatically reconnects on closed socket (using back off)
// - Unauthenticated IWebSocketResource that is created on the first outgoing
//   unauthenticated request and is periodically rotated (5 minutes since first
//   activity on the socket).
//
// Incoming requests on authenticated resource are funneled into the registered
// request handlers (`registerRequestHandler`) or queued internally until at
// least one such request handler becomes available.
//
// Incoming requests on unauthenticated resource are not currently supported.
// IWebSocketResource is responsible for their immediate termination.
export class SocketManager extends EventListener {
  #backOff = new BackOff(FIBONACCI_TIMEOUTS, {
    jitter: JITTER,
  });

  #authenticated?: AbortableProcess<IWebSocketResource>;
  #unauthenticated?: AbortableProcess<IWebSocketResource>;
  #unauthenticatedExpirationTimer?: NodeJS.Timeout;
  #credentials?: WebAPICredentials;
  #lazyProxyAgent?: Promise<ProxyAgent>;
  #authenticatedStatus: SocketInfo = {
    status: SocketStatus.CLOSED,
  };
  #unathenticatedStatus: SocketInfo = {
    status: SocketStatus.CLOSED,
  };
  #requestHandlers = new Set<IRequestHandler>();
  #incomingRequestQueue = new Array<IncomingWebSocketRequest>();
  #isNavigatorOffline = false;
  #privIsOnline: boolean | undefined;
  #expirationReason: SocketExpirationReason | undefined;
  #hasStoriesDisabled: boolean | undefined;
  #reconnectController: AbortController | undefined;
  #envelopeCount = 0;

  constructor(
    private readonly libsignalNet: Net.Net,
    private readonly options: SocketManagerOptions
  ) {
    super();
  }

  public getStatus(): SocketStatuses {
    return {
      authenticated: this.#authenticatedStatus,
      unauthenticated: this.#unathenticatedStatus,
    };
  }

  #markOffline() {
    // Note: `#privIsOnline` starts as `undefined` so that we emit the first
    // `offline` event.
    if (this.#privIsOnline === false) {
      return;
    }

    this.#privIsOnline = false;
    this.emit('offline');
  }

  #markOnline() {
    if (this.#privIsOnline === true) {
      return;
    }
    this.#privIsOnline = true;
    this.emit('online');
  }

  // Update WebAPICredentials and reconnect authenticated resource if
  // credentials changed
  public async authenticate(credentials: WebAPICredentials): Promise<void> {
    if (this.#expirationReason != null) {
      throw new HTTPError(`SocketManager ${this.#expirationReason} expired`, {
        code: 0,
        headers: {},
        stack: new Error().stack,
      });
    }

    const { username, password } = credentials;
    if (!username && !password) {
      log.warn('authenticate was called without credentials');
      return;
    }

    if (
      this.#credentials &&
      this.#credentials.username === username &&
      this.#credentials.password === password &&
      this.#authenticated
    ) {
      try {
        await this.#authenticated.getResult();
      } catch (error) {
        log.warn(
          'failed to wait for existing authenticated socket ' +
            ` due to error: ${Errors.toLogFormat(error)}`
        );
      }
      return;
    }

    this.#credentials = credentials;

    log.info(
      'connecting authenticated socket ' +
        `(hasStoriesDisabled=${this.#hasStoriesDisabled})`
    );

    this.#setAuthenticatedStatus({ status: SocketStatus.CONNECTING });

    const userLanguages = getUserLanguages(
      window.SignalContext.getPreferredSystemLocales(),
      window.SignalContext.getResolvedMessagesLocale()
    );

    const process = connectAuthenticatedLibsignal({
      libsignalNet: this.libsignalNet,
      name: AUTHENTICATED_CHANNEL_NAME,
      credentials: this.#credentials,
      handler: (req: IncomingWebSocketRequest): void => {
        this.#queueOrHandleRequest(req);
      },
      onReceivedAlerts: (alerts: Array<ServerAlert>) => {
        this.emit('serverAlerts', alerts);
      },
      receiveStories: this.#hasStoriesDisabled === false,
      userLanguages,
      keepalive: { path: '/v1/keepalive' },
    });

    // Cancel previous connect attempt or close socket
    this.#authenticated?.abort();

    this.#authenticated = process;

    const reconnect = async (): Promise<void> => {
      if (this.#expirationReason != null) {
        log.info(`${this.#expirationReason} expired, not reconnecting`);
        return;
      }

      const timeout = this.#backOff.getAndIncrement();

      log.info(`reconnecting authenticated socket after ${timeout}ms`);

      const reconnectController = new AbortController();
      this.#reconnectController = reconnectController;

      try {
        await sleep(timeout, undefined, { signal: reconnectController.signal });
      } catch {
        log.info('reconnect canceled');
        return;
      } finally {
        if (this.#reconnectController === reconnectController) {
          this.#reconnectController = undefined;
        }
      }

      if (this.#authenticated) {
        log.info('authenticated socket already connecting');
        return;
      }

      strictAssert(this.#credentials !== undefined, 'Missing credentials');

      try {
        await this.authenticate(this.#credentials);
      } catch (error) {
        log.info(
          'authenticated socket failed to reconnect ' +
            `due to error ${Errors.toLogFormat(error)}`
        );
        return reconnect();
      }
    };

    let authenticated: IWebSocketResource;
    try {
      authenticated = await process.getResult();

      this.#setAuthenticatedStatus({ status: SocketStatus.OPEN });
    } catch (error) {
      log.warn(
        'authenticated socket connection failed with ' +
          `error: ${Errors.toLogFormat(error)}`
      );

      // The socket was deliberately closed, don't follow up
      if (this.#authenticated !== process) {
        return;
      }

      this.#dropAuthenticated(process);

      if (error instanceof HTTPError) {
        const { code } = error;

        if (code === 401 || code === 403) {
          this.emit('authError');
          return;
        }

        if (!(code >= 500 && code <= 599) && code !== -1) {
          // No reconnect attempt should be made
          return;
        }

        if (code === -1) {
          this.#markOffline();
        }
      } else if (error instanceof ConnectTimeoutError) {
        this.#markOffline();
      } else if (
        error instanceof LibSignalErrorBase &&
        error.code === ErrorCode.DeviceDelinked
      ) {
        this.emit('authError');
        return;
      } else if (
        error instanceof LibSignalErrorBase &&
        error.code === ErrorCode.IoError
      ) {
        this.#markOffline();
      } else if (
        error instanceof LibSignalErrorBase &&
        error.code === ErrorCode.AppExpired
      ) {
        window.Whisper.events.emit('httpResponse499');
        return;
      } else if (
        error instanceof LibSignalErrorBase &&
        error.code === ErrorCode.RateLimitedError
      ) {
        throw new HTTPError('Rate limited', {
          code: 429,
          headers: {},
          stack: new Error().stack,
          cause: error,
        });
      }

      drop(reconnect());
      return;
    }

    log.info(
      `connected authenticated socket (localPort: ${authenticated.localPort()})`
    );

    window.logAuthenticatedConnect?.();
    this.#envelopeCount = 0;
    this.#backOff.reset();

    authenticated.addEventListener('close', ({ code, reason }): void => {
      if (this.#authenticated !== process) {
        return;
      }

      log.warn(
        'authenticated socket closed ' +
          `with code=${code} and reason=${reason}`
      );
      this.#dropAuthenticated(process);

      if (code === NORMAL_DISCONNECT_CODE) {
        // Intentional disconnect
        return;
      }

      if (code === 4409) {
        log.error('got 4409, connected on another device');
        return;
      }

      drop(reconnect());
    });
  }

  // Either returns currently connecting/active authenticated
  // IWebSocketResource or connects a fresh one.
  public async getAuthenticatedResource(): Promise<IWebSocketResource> {
    if (!this.#authenticated) {
      strictAssert(this.#credentials !== undefined, 'Missing credentials');
      await this.authenticate(this.#credentials);
    }

    strictAssert(this.#authenticated !== undefined, 'Authentication failed');
    return this.#authenticated.getResult();
  }

  // Creates new IWebSocketResource for AccountManager's provisioning
  public async getProvisioningResource(
    handler: IRequestHandler,
    timeout?: number
  ): Promise<IWebSocketResource> {
    if (this.#expirationReason != null) {
      throw new Error(
        `${this.#expirationReason} expired, ` +
          'not connecting provisioning socket'
      );
    }

    return this.#connectResource({
      name: 'provisioning',
      path: '/v1/websocket/provisioning/',
      proxyAgent: await this.#getProxyAgent(),
      resourceOptions: {
        name: 'provisioning',
        handleRequest: (req: IncomingWebSocketRequest): void => {
          handler.handleRequest(req);
        },
        keepalive: { path: '/v1/keepalive/provisioning' },
      },
      extraHeaders: {
        'x-signal-websocket-timeout': 'true',
      },
      timeout,
    }).getResult();
  }

  // Creates new WebSocket for Art Creator provisioning
  public async connectExternalSocket({
    url,
    extraHeaders,
  }: {
    url: string;
    extraHeaders?: Record<string, string>;
  }): Promise<WebSocket> {
    const proxyAgent = await this.#getProxyAgent();

    return connectWebSocket({
      name: 'art-creator-provisioning',
      url,
      version: this.options.version,
      proxyAgent,
      extraHeaders,

      createResource(socket: WebSocket): WebSocket {
        return socket;
      },
    }).getResult();
  }

  // Fetch-compatible wrapper around underlying unauthenticated/authenticated
  // websocket resources. This wrapper supports only limited number of features
  // of node-fetch despite being API compatible.
  public async fetch(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);

    let resource: IWebSocketResource;
    if (this.#isAuthenticated(headers)) {
      resource = await this.getAuthenticatedResource();
    } else {
      resource = await this.#getUnauthenticatedResource();
      await this.#startUnauthenticatedExpirationTimer(resource);
    }

    const { path } = URL.parse(url);
    strictAssert(path, "Fetch can't have empty path");

    const { method = 'GET', body, timeout, signal } = init;

    let bodyBytes: Uint8Array | undefined;
    if (body === undefined) {
      bodyBytes = undefined;
    } else if (body instanceof Uint8Array) {
      bodyBytes = body;
    } else if (body instanceof ArrayBuffer) {
      throw new Error('Unsupported body type: ArrayBuffer');
    } else if (typeof body === 'string') {
      bodyBytes = Bytes.fromString(body);
    } else {
      throw new Error(`Unsupported body type: ${typeof body}`);
    }

    const { promise: abortPromise, reject } = explodePromise<Response>();

    const onAbort = () => reject(new Error('Aborted'));
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    signal?.addEventListener('abort', onAbort, { once: true });

    const responsePromise = resource.sendRequest({
      verb: method,
      path,
      body: bodyBytes,
      headers: Array.from(headers.entries()),
      timeout,
    });

    try {
      return await Promise.race([responsePromise, abortPromise]);
    } finally {
      cleanup();
    }
  }

  public registerRequestHandler(handler: IRequestHandler): void {
    this.#requestHandlers.add(handler);

    const queue = this.#incomingRequestQueue;
    if (queue.length === 0) {
      return;
    }

    log.info(`processing ${queue.length} queued incoming requests`);
    this.#incomingRequestQueue = [];
    for (const req of queue) {
      this.#queueOrHandleRequest(req);
    }
  }

  public unregisterRequestHandler(handler: IRequestHandler): void {
    this.#requestHandlers.delete(handler);
  }

  public async onHasStoriesDisabledChange(newValue: boolean): Promise<void> {
    if (this.#hasStoriesDisabled === newValue) {
      return;
    }

    this.#hasStoriesDisabled = newValue;
    log.info(`reconnecting after setting hasStoriesDisabled=${newValue}`);
    await this.reconnect();
  }

  public async reconnect(): Promise<void> {
    log.info('reconnect: starting...');

    const unauthenticated = this.#unauthenticated;
    const authenticated = this.#authenticated;
    if (authenticated) {
      authenticated.abort();
      this.#dropAuthenticated(authenticated);
    }
    if (unauthenticated) {
      unauthenticated.abort();
      this.#dropUnauthenticated(unauthenticated);
    }

    if (this.#credentials) {
      this.#backOff.reset();

      // Cancel old reconnect attempt
      this.#reconnectController?.abort();

      // Start the new attempt
      await this.authenticate(this.#credentials);
    }

    log.info('reconnect: complete.');
  }

  // Force keep-alive checks on WebSocketResources
  public async check(): Promise<void> {
    log.info('check');
    await Promise.all([
      this.#checkResource(this.#authenticated),
      this.#checkResource(this.#unauthenticated),
    ]);
  }

  public async onNavigatorOnline(): Promise<void> {
    log.info('onNavigatorOnline');
    this.#isNavigatorOffline = false;
    this.#backOff.reset(FIBONACCI_TIMEOUTS);
    this.libsignalNet.onNetworkChange();

    // Reconnect earlier if waiting
    if (this.#credentials !== undefined) {
      this.#reconnectController?.abort();
      await this.authenticate(this.#credentials);
    }
  }

  public async onNavigatorOffline(): Promise<void> {
    log.info('onNavigatorOffline');
    this.#isNavigatorOffline = true;
    this.#backOff.reset(EXTENDED_FIBONACCI_TIMEOUTS);
    await this.check();
  }

  public async onExpiration(reason: SocketExpirationReason): Promise<void> {
    log.info('onRemoteExpiration', reason);
    this.#expirationReason = reason;

    // Cancel reconnect attempt if any
    this.#reconnectController?.abort();

    // Logout
    await this.logout();
  }

  public async logout(): Promise<void> {
    const authenticated = this.#authenticated;
    if (authenticated) {
      authenticated.abort();
      this.#dropAuthenticated(authenticated);
    }
    this.#markOffline();
    this.#credentials = undefined;
  }

  public get isOnline(): boolean | undefined {
    return this.#privIsOnline;
  }

  //
  // Private
  //

  #setAuthenticatedStatus(newStatus: SocketStatusUpdate): void {
    if (this.#authenticatedStatus.status === newStatus.status) {
      return;
    }

    this.#authenticatedStatus.status = newStatus.status;
    this.emit('statusChange');

    if (newStatus.status === SocketStatus.OPEN) {
      this.#authenticatedStatus.lastConnectionTimestamp = Date.now();

      this.#markOnline();
    }
  }

  #setUnauthenticatedStatus(newStatus: SocketStatusUpdate): void {
    this.#unathenticatedStatus.status = newStatus.status;

    if (newStatus.status === SocketStatus.OPEN) {
      this.#unathenticatedStatus.lastConnectionTimestamp = Date.now();
    }
  }

  async #getUnauthenticatedResource(): Promise<IWebSocketResource> {
    if (this.#expirationReason) {
      throw new HTTPError(`SocketManager ${this.#expirationReason} expired`, {
        code: 0,
        headers: {},
        stack: new Error().stack,
      });
    }

    if (this.#unauthenticated) {
      return this.#unauthenticated.getResult();
    }

    log.info('connecting unauthenticated socket');

    this.#setUnauthenticatedStatus({
      status: SocketStatus.CONNECTING,
    });

    const userLanguages = getUserLanguages(
      window.SignalContext.getPreferredSystemLocales(),
      window.SignalContext.getResolvedMessagesLocale()
    );

    const process: AbortableProcess<IWebSocketResource> =
      connectUnauthenticatedLibsignal({
        libsignalNet: this.libsignalNet,
        name: UNAUTHENTICATED_CHANNEL_NAME,
        userLanguages,
        keepalive: { path: '/v1/keepalive' },
      });

    this.#unauthenticated = process;

    let unauthenticated: IWebSocketResource;
    try {
      unauthenticated = await this.#unauthenticated.getResult();
      this.#setUnauthenticatedStatus({
        status: SocketStatus.OPEN,
      });
    } catch (error) {
      log.info(
        'failed to connect unauthenticated socket ' +
          ` due to error: ${Errors.toLogFormat(error)}`
      );
      this.#dropUnauthenticated(process);

      if (error instanceof LibSignalErrorBase) {
        switch (error.code) {
          case ErrorCode.DeviceDelinked:
            throw new HTTPError('Device delinked', {
              code: 403,
              headers: {},
              stack: new Error().stack,
              cause: error,
            });
          case ErrorCode.AppExpired:
            throw new HTTPError('App expired', {
              code: 499,
              headers: {},
              stack: new Error().stack,
              cause: error,
            });
          case ErrorCode.RateLimitedError:
            throw new HTTPError('Rate limited', {
              code: 429,
              headers: {},
              stack: new Error().stack,
              cause: error,
            });
          case ErrorCode.IoError:
            throw new ConnectTimeoutError();
          default:
            // Fall through to re-throw the error
            break;
        }
      }

      throw error;
    }

    log.info(
      `connected unauthenticated socket (localPort: ${unauthenticated.localPort()})`
    );

    unauthenticated.addEventListener('close', ({ code, reason }): void => {
      if (this.#unauthenticated !== process) {
        return;
      }

      log.warn(
        'unauthenticated socket closed ' +
          `with code=${code} and reason=${reason}`
      );

      this.#dropUnauthenticated(process);
    });

    return this.#unauthenticated.getResult();
  }

  #connectResource({
    name,
    path,
    proxyAgent,
    resourceOptions,
    query = {},
    extraHeaders = {},
    onUpgradeResponse,
    timeout,
  }: {
    name: string;
    path: string;
    proxyAgent: ProxyAgent | undefined;
    resourceOptions: WebSocketResourceOptions;
    query?: Record<string, string>;
    extraHeaders?: Record<string, string>;
    onUpgradeResponse?: (response: IncomingMessage) => void;
    timeout?: number;
  }): AbortableProcess<IWebSocketResource> {
    const queryWithDefaults = {
      agent: 'OWD',
      version: this.options.version,
      ...query,
    };

    const url = `${this.options.url}${path}?${qs.encode(queryWithDefaults)}`;
    const { version } = this.options;

    const start = performance.now();
    const webSocketResourceConnection = connectWebSocket({
      name,
      url,
      version,
      certificateAuthority: this.options.certificateAuthority,
      proxyAgent,
      timeout,

      extraHeaders,
      onUpgradeResponse,

      createResource(socket: WebSocket): WebSocketResource {
        const duration = (performance.now() - start).toFixed(1);
        log.info(
          `WebSocketResource(${resourceOptions.name}) connected in ${duration}ms`
        );
        return new WebSocketResource(socket, resourceOptions);
      },
    });

    return webSocketResourceConnection;
  }

  async #checkResource(
    process?: AbortableProcess<IWebSocketResource>
  ): Promise<void> {
    if (!process) {
      return;
    }

    const resource = await process.getResult();

    // Force shorter timeout if we think we might be offline
    resource.forceKeepAlive(
      this.#isNavigatorOffline ? OFFLINE_KEEPALIVE_TIMEOUT_MS : undefined
    );
  }

  #dropAuthenticated(process: AbortableProcess<IWebSocketResource>): void {
    if (this.#authenticated !== process) {
      return;
    }

    this.#incomingRequestQueue = [];
    this.#authenticated = undefined;
    this.#setAuthenticatedStatus({ status: SocketStatus.CLOSED });

    for (const handlers of this.#requestHandlers) {
      try {
        handlers.handleDisconnect();
      } catch (error) {
        log.warn(
          'got exception while handling disconnect, ' +
            `error: ${Errors.toLogFormat(error)}`
        );
      }
    }
  }

  #dropUnauthenticated(process: AbortableProcess<IWebSocketResource>): void {
    if (this.#unauthenticated !== process) {
      return;
    }

    this.#unauthenticated = undefined;
    this.#setUnauthenticatedStatus({ status: SocketStatus.CLOSED });
    if (!this.#unauthenticatedExpirationTimer) {
      return;
    }
    clearTimeout(this.#unauthenticatedExpirationTimer);
    this.#unauthenticatedExpirationTimer = undefined;
  }

  async #startUnauthenticatedExpirationTimer(
    expected: IWebSocketResource
  ): Promise<void> {
    const process = this.#unauthenticated;
    strictAssert(
      process !== undefined,
      'Unauthenticated socket must be connected'
    );

    const unauthenticated = await process.getResult();
    strictAssert(
      unauthenticated === expected,
      'Unauthenticated resource should be the same'
    );

    if (this.#unauthenticatedExpirationTimer) {
      return;
    }

    log.info('starting expiration timer for unauthenticated socket');
    this.#unauthenticatedExpirationTimer = setTimeout(async () => {
      log.info('shutting down unauthenticated socket after timeout');
      unauthenticated.shutdown();

      // The socket is either deliberately closed or reconnected already
      if (this.#unauthenticated !== process) {
        return;
      }

      this.#dropUnauthenticated(process);

      try {
        await this.#getUnauthenticatedResource();
      } catch (error) {
        log.warn(
          'failed to reconnect unauthenticated socket ' +
            `due to error: ${Errors.toLogFormat(error)}`
        );
      }
    }, FIVE_MINUTES);
  }

  #queueOrHandleRequest(req: IncomingWebSocketRequest): void {
    if (req.requestType === ServerRequestType.ApiMessage) {
      this.#envelopeCount += 1;
      if (this.#envelopeCount === 1) {
        this.emit('firstEnvelope', req);
      }
    }
    if (this.#requestHandlers.size === 0) {
      this.#incomingRequestQueue.push(req);
      log.info(
        'request handler unavailable, ' +
          `queued request. Queue size: ${this.#incomingRequestQueue.length}`
      );
      return;
    }
    for (const handlers of this.#requestHandlers) {
      try {
        handlers.handleRequest(req);
      } catch (error) {
        log.warn(
          'got exception while handling incoming request, ' +
            `error: ${Errors.toLogFormat(error)}`
        );
      }
    }
  }

  #isAuthenticated(headers: Headers): boolean {
    if (!this.#credentials) {
      return false;
    }

    const authorization = headers.get('Authorization');
    if (!authorization) {
      return false;
    }

    const [basic, base64] = authorization.split(/\s+/, 2);

    if (basic.toLowerCase() !== 'basic' || !base64) {
      return false;
    }

    const [username, password] = Bytes.toString(Bytes.fromBase64(base64)).split(
      ':',
      2
    );

    return (
      username === this.#credentials.username &&
      password === this.#credentials.password
    );
  }

  async #getProxyAgent(): Promise<ProxyAgent | undefined> {
    if (this.options.proxyUrl && !this.#lazyProxyAgent) {
      // Cache the promise so that we don't import concurrently.
      this.#lazyProxyAgent = createProxyAgent(this.options.proxyUrl);
    }
    return this.#lazyProxyAgent;
  }

  // EventEmitter types

  public override on(type: 'authError', callback: () => void): this;
  public override on(type: 'statusChange', callback: () => void): this;
  public override on(type: 'online', callback: () => void): this;
  public override on(type: 'offline', callback: () => void): this;
  public override on(
    type: 'firstEnvelope',
    callback: (incoming: IncomingWebSocketRequest) => void
  ): this;
  public override on(
    type: 'serverAlerts',
    callback: (alerts: Array<ServerAlert>) => void
  ): this;

  public override on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public override emit(type: 'authError'): boolean;
  public override emit(type: 'statusChange'): boolean;
  public override emit(type: 'online'): boolean;
  public override emit(type: 'offline'): boolean;
  public override emit(
    type: 'firstEnvelope',
    incoming: IncomingWebSocketRequest
  ): boolean;
  public override emit(
    type: 'serverAlerts',
    alerts: Array<ServerAlert>
  ): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }
}
