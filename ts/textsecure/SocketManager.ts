// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import URL from 'url';
import type { RequestInit, Response } from 'node-fetch';
import { Headers } from 'node-fetch';
import type { connection as WebSocket } from 'websocket';
import qs from 'querystring';
import EventListener from 'events';

import { AbortableProcess } from '../util/AbortableProcess';
import { strictAssert } from '../util/assert';
import { BackOff, FIBONACCI_TIMEOUTS } from '../util/BackOff';
import * as durations from '../util/durations';
import { sleep } from '../util/sleep';
import { createProxyAgent } from '../util/createProxyAgent';
import { SocketStatus } from '../types/SocketStatus';
import * as Errors from '../types/errors';
import * as Bytes from '../Bytes';
import * as log from '../logging/log';

import type {
  IncomingWebSocketRequest,
  IWebSocketResource,
  WebSocketResourceOptions,
} from './WebsocketResources';
import WebSocketResource, {
  LibsignalWebSocketResource,
  TransportOption,
  WebSocketResourceWithShadowing,
} from './WebsocketResources';
import { HTTPError } from './Errors';
import type { IRequestHandler, WebAPICredentials } from './Types.d';
import { connect as connectWebSocket } from './WebSocket';
import { isAlpha, isBeta, isStaging } from '../util/version';

const FIVE_MINUTES = 5 * durations.MINUTE;

const JITTER = 5 * durations.SECOND;

export const UNAUTHENTICATED_CHANNEL_NAME = 'unauthenticated';

export const AUTHENTICATED_CHANNEL_NAME = 'authenticated';

export type SocketManagerOptions = Readonly<{
  url: string;
  artCreatorUrl: string;
  certificateAuthority: string;
  version: string;
  proxyUrl?: string;
  hasStoriesDisabled: boolean;
}>;

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
  private backOff = new BackOff(FIBONACCI_TIMEOUTS, {
    jitter: JITTER,
  });

  private authenticated?: AbortableProcess<IWebSocketResource>;

  private unauthenticated?: AbortableProcess<IWebSocketResource>;

  private unauthenticatedExpirationTimer?: NodeJS.Timeout;

  private credentials?: WebAPICredentials;

  private readonly proxyAgent?: ReturnType<typeof createProxyAgent>;

  private status = SocketStatus.CLOSED;

  private requestHandlers = new Set<IRequestHandler>();

  private incomingRequestQueue = new Array<IncomingWebSocketRequest>();

  private isOffline = false;

  private hasStoriesDisabled: boolean;

  constructor(private readonly options: SocketManagerOptions) {
    super();

    if (options.proxyUrl) {
      this.proxyAgent = createProxyAgent(options.proxyUrl);
    }

    this.hasStoriesDisabled = options.hasStoriesDisabled;
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  // Update WebAPICredentials and reconnect authenticated resource if
  // credentials changed
  public async authenticate(credentials: WebAPICredentials): Promise<void> {
    if (this.isOffline) {
      throw new HTTPError('SocketManager offline', {
        code: 0,
        headers: {},
        stack: new Error().stack,
      });
    }

    const { username, password } = credentials;
    if (!username && !password) {
      log.warn('SocketManager authenticate was called without credentials');
      return;
    }

    if (
      this.credentials &&
      this.credentials.username === username &&
      this.credentials.password === password &&
      this.authenticated
    ) {
      try {
        await this.authenticated.getResult();
      } catch (error) {
        log.warn(
          'SocketManager: failed to wait for existing authenticated socket ' +
            ` due to error: ${Errors.toLogFormat(error)}`
        );
      }
      return;
    }

    this.credentials = credentials;

    log.info(
      'SocketManager: connecting authenticated socket ' +
        `(hasStoriesDisabled=${this.hasStoriesDisabled})`
    );

    this.setStatus(SocketStatus.CONNECTING);

    const process = this.connectResource({
      name: AUTHENTICATED_CHANNEL_NAME,
      path: '/v1/websocket/',
      query: { login: username, password },
      resourceOptions: {
        name: AUTHENTICATED_CHANNEL_NAME,
        keepalive: { path: '/v1/keepalive' },
        handleRequest: (req: IncomingWebSocketRequest): void => {
          this.queueOrHandleRequest(req);
        },
      },
      extraHeaders: {
        'X-Signal-Receive-Stories': String(!this.hasStoriesDisabled),
      },
    });

    // Cancel previous connect attempt or close socket
    this.authenticated?.abort();

    this.authenticated = process;

    const reconnect = async (): Promise<void> => {
      const timeout = this.backOff.getAndIncrement();

      log.info(
        'SocketManager: reconnecting authenticated socket ' +
          `after ${timeout}ms`
      );

      await sleep(timeout);
      if (this.isOffline) {
        log.info('SocketManager: cancelled reconnect because we are offline');
        return;
      }

      if (this.authenticated) {
        log.info('SocketManager: authenticated socket already reconnected');
        return;
      }

      strictAssert(this.credentials !== undefined, 'Missing credentials');

      try {
        await this.authenticate(this.credentials);
      } catch (error) {
        log.info(
          'SocketManager: authenticated socket failed to reconnect ' +
            `due to error ${Errors.toLogFormat(error)}`
        );
        return reconnect();
      }
    };

    let authenticated: IWebSocketResource;
    try {
      authenticated = await process.getResult();
      this.setStatus(SocketStatus.OPEN);
    } catch (error) {
      log.warn(
        'SocketManager: authenticated socket connection failed with ' +
          `error: ${Errors.toLogFormat(error)}`
      );

      // The socket was deliberately closed, don't follow up
      if (this.authenticated !== process) {
        return;
      }

      this.dropAuthenticated(process);

      if (error instanceof HTTPError) {
        const { code } = error;

        if (code === 401 || code === 403) {
          this.emit('authError', error);
          return;
        }

        if (!(code >= 500 && code <= 599) && code !== -1) {
          // No reconnect attempt should be made
          return;
        }

        if (code === -1) {
          this.emit('connectError');
        }
      }

      void reconnect();
      return;
    }

    log.info(
      `SocketManager: connected authenticated socket (localPort: ${authenticated.localPort()})`
    );

    window.logAuthenticatedConnect?.();
    this.backOff.reset();

    authenticated.addEventListener('close', ({ code, reason }): void => {
      if (this.authenticated !== process) {
        return;
      }

      log.warn(
        'SocketManager: authenticated socket closed ' +
          `with code=${code} and reason=${reason}`
      );
      this.dropAuthenticated(process);

      if (code === 3000) {
        // Intentional disconnect
        return;
      }

      if (code === 4409) {
        log.error('SocketManager: got 4409, connected on another device');
        return;
      }

      void reconnect();
    });
  }

  // Either returns currently connecting/active authenticated
  // IWebSocketResource or connects a fresh one.
  public async getAuthenticatedResource(): Promise<IWebSocketResource> {
    if (!this.authenticated) {
      strictAssert(this.credentials !== undefined, 'Missing credentials');
      await this.authenticate(this.credentials);
    }

    strictAssert(this.authenticated !== undefined, 'Authentication failed');
    return this.authenticated.getResult();
  }

  // Creates new IWebSocketResource for AccountManager's provisioning
  public async getProvisioningResource(
    handler: IRequestHandler
  ): Promise<IWebSocketResource> {
    return this.connectResource({
      name: 'provisioning',
      path: '/v1/websocket/provisioning/',
      resourceOptions: {
        name: 'provisioning',
        handleRequest: (req: IncomingWebSocketRequest): void => {
          handler.handleRequest(req);
        },
        keepalive: { path: '/v1/keepalive/provisioning' },
      },
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
    return connectWebSocket({
      name: 'art-creator-provisioning',
      url,
      version: this.options.version,
      proxyAgent: this.proxyAgent,
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
    if (this.isAuthenticated(headers)) {
      resource = await this.getAuthenticatedResource();
    } else {
      resource = await this.getUnauthenticatedResource();
      await this.startUnauthenticatedExpirationTimer(resource);
    }

    const { path } = URL.parse(url);
    strictAssert(path, "Fetch can't have empty path");

    const { method = 'GET', body, timeout } = init;

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

    return resource.sendRequest({
      verb: method,
      path,
      body: bodyBytes,
      headers: Array.from(headers.entries()),
      timeout,
    });
  }

  public registerRequestHandler(handler: IRequestHandler): void {
    this.requestHandlers.add(handler);

    const queue = this.incomingRequestQueue;
    if (queue.length === 0) {
      return;
    }

    log.info(
      `SocketManager: processing ${queue.length} queued incoming requests`
    );
    this.incomingRequestQueue = [];
    for (const req of queue) {
      this.queueOrHandleRequest(req);
    }
  }

  public unregisterRequestHandler(handler: IRequestHandler): void {
    this.requestHandlers.delete(handler);
  }

  public async onHasStoriesDisabledChange(newValue: boolean): Promise<void> {
    if (this.hasStoriesDisabled === newValue) {
      return;
    }

    this.hasStoriesDisabled = newValue;
    log.info(
      `SocketManager: reconnecting after setting hasStoriesDisabled=${newValue}`
    );
    await this.reconnect();
  }

  public async reconnect(): Promise<void> {
    log.info('SocketManager.reconnect: starting...');
    this.onOffline();
    await this.onOnline();
    log.info('SocketManager.reconnect: complete.');
  }

  // Force keep-alive checks on WebSocketResources
  public async check(): Promise<void> {
    if (this.isOffline) {
      return;
    }

    log.info('SocketManager.check');
    await Promise.all([
      SocketManager.checkResource(this.authenticated),
      SocketManager.checkResource(this.unauthenticated),
    ]);
  }

  // Puts SocketManager into "online" state and reconnects the authenticated
  // IWebSocketResource (if there are valid credentials)
  public async onOnline(): Promise<void> {
    log.info('SocketManager.onOnline');
    this.isOffline = false;

    if (this.credentials) {
      await this.authenticate(this.credentials);
    }
  }

  // Puts SocketManager into "offline" state and gracefully disconnects both
  // unauthenticated and authenticated resources.
  public onOffline(): void {
    log.info('SocketManager.onOffline');
    this.isOffline = true;

    const { authenticated, unauthenticated } = this;
    if (authenticated) {
      authenticated.abort();
      this.dropAuthenticated(authenticated);
    }
    if (unauthenticated) {
      unauthenticated.abort();
      this.dropUnauthenticated(unauthenticated);
    }
  }

  public async logout(): Promise<void> {
    const { authenticated } = this;
    if (authenticated) {
      authenticated.abort();
      this.dropAuthenticated(authenticated);
    }

    this.credentials = undefined;
  }

  //
  // Private
  //

  private setStatus(status: SocketStatus): void {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.emit('statusChange');
  }

  private transportOption(): TransportOption {
    const { hostname } = URL.parse(this.options.url);

    // transport experiment doesn't support proxy
    if (
      this.proxyAgent ||
      hostname == null ||
      !hostname.endsWith('signal.org')
    ) {
      return TransportOption.Original;
    }

    // in staging, switch to using libsignal transport
    if (isStaging(this.options.version)) {
      return TransportOption.Libsignal;
    }

    // in alpha, switch to using libsignal transport, unless user opts out,
    // in which case switching to shadowing
    if (isAlpha(this.options.version)) {
      const configValue = window.Signal.RemoteConfig.isEnabled(
        'desktop.experimentalTransportEnabled.alpha'
      );
      return configValue
        ? TransportOption.Libsignal
        : TransportOption.ShadowingHigh;
    }

    // in beta, switch to using 'ShadowingHigh' mode, unless user opts out,
    // in which case switching to `ShadowingLow`
    if (isBeta(this.options.version)) {
      const configValue = window.Signal.RemoteConfig.isEnabled(
        'desktop.experimentalTransportEnabled.beta'
      );
      return configValue
        ? TransportOption.ShadowingHigh
        : TransportOption.ShadowingLow;
    }

    // in prod, using original
    return TransportOption.ShadowingLow;
  }

  private connectLibsignalUnauthenticated(): AbortableProcess<IWebSocketResource> {
    return new AbortableProcess<IWebSocketResource>(
      `WebSocket.connect(libsignal.${UNAUTHENTICATED_CHANNEL_NAME})`,
      {
        abort() {
          // noop
        },
      },
      Promise.resolve(new LibsignalWebSocketResource(this.options.version))
    );
  }

  private async getUnauthenticatedResource(): Promise<IWebSocketResource> {
    if (this.isOffline) {
      throw new HTTPError('SocketManager offline', {
        code: 0,
        headers: {},
        stack: new Error().stack,
      });
    }

    if (this.unauthenticated) {
      return this.unauthenticated.getResult();
    }

    const transportOption = this.transportOption();
    log.info(
      `SocketManager: connecting unauthenticated socket, transport option [${transportOption}]`
    );

    if (transportOption === TransportOption.Libsignal) {
      this.unauthenticated = this.connectLibsignalUnauthenticated();
      return this.unauthenticated.getResult();
    }

    const process = this.connectResource({
      name: UNAUTHENTICATED_CHANNEL_NAME,
      path: '/v1/websocket/',
      resourceOptions: {
        name: UNAUTHENTICATED_CHANNEL_NAME,
        keepalive: { path: '/v1/keepalive' },
        transportOption,
      },
    });
    this.unauthenticated = process;

    let unauthenticated: IWebSocketResource;
    try {
      unauthenticated = await this.unauthenticated.getResult();
    } catch (error) {
      log.info(
        'SocketManager: failed to connect unauthenticated socket ' +
          ` due to error: ${Errors.toLogFormat(error)}`
      );
      this.dropUnauthenticated(process);
      throw error;
    }

    log.info(
      `SocketManager: connected unauthenticated socket (localPort: ${unauthenticated.localPort()})`
    );

    unauthenticated.addEventListener('close', ({ code, reason }): void => {
      if (this.unauthenticated !== process) {
        return;
      }

      log.warn(
        'SocketManager: unauthenticated socket closed ' +
          `with code=${code} and reason=${reason}`
      );

      this.dropUnauthenticated(process);
    });

    return this.unauthenticated.getResult();
  }

  private connectResource({
    name,
    path,
    resourceOptions,
    query = {},
    extraHeaders = {},
  }: {
    name: string;
    path: string;
    resourceOptions: WebSocketResourceOptions;
    query?: Record<string, string>;
    extraHeaders?: Record<string, string>;
  }): AbortableProcess<IWebSocketResource> {
    const queryWithDefaults = {
      agent: 'OWD',
      version: this.options.version,
      ...query,
    };

    const url = `${this.options.url}${path}?${qs.encode(queryWithDefaults)}`;
    const { version } = this.options;

    return connectWebSocket({
      name,
      url,
      version,
      certificateAuthority: this.options.certificateAuthority,
      proxyAgent: this.proxyAgent,

      extraHeaders,

      createResource(socket: WebSocket): IWebSocketResource {
        return !resourceOptions.transportOption ||
          resourceOptions.transportOption === TransportOption.Original
          ? new WebSocketResource(socket, resourceOptions)
          : new WebSocketResourceWithShadowing(
              socket,
              resourceOptions,
              version
            );
      },
    });
  }

  private static async checkResource(
    process?: AbortableProcess<IWebSocketResource>
  ): Promise<void> {
    if (!process) {
      return;
    }

    const resource = await process.getResult();
    resource.forceKeepAlive();
  }

  private dropAuthenticated(
    process: AbortableProcess<IWebSocketResource>
  ): void {
    if (this.authenticated !== process) {
      return;
    }

    this.incomingRequestQueue = [];
    this.authenticated = undefined;
    this.setStatus(SocketStatus.CLOSED);
  }

  private dropUnauthenticated(
    process: AbortableProcess<IWebSocketResource>
  ): void {
    if (this.unauthenticated !== process) {
      return;
    }

    this.unauthenticated = undefined;
    if (!this.unauthenticatedExpirationTimer) {
      return;
    }
    clearTimeout(this.unauthenticatedExpirationTimer);
    this.unauthenticatedExpirationTimer = undefined;
  }

  private async startUnauthenticatedExpirationTimer(
    expected: IWebSocketResource
  ): Promise<void> {
    const process = this.unauthenticated;
    strictAssert(
      process !== undefined,
      'Unauthenticated socket must be connected'
    );

    const unauthenticated = await process.getResult();
    strictAssert(
      unauthenticated === expected,
      'Unauthenticated resource should be the same'
    );

    if (this.unauthenticatedExpirationTimer) {
      return;
    }

    log.info(
      'SocketManager: starting expiration timer for unauthenticated socket'
    );
    this.unauthenticatedExpirationTimer = setTimeout(async () => {
      log.info(
        'SocketManager: shutting down unauthenticated socket after timeout'
      );
      unauthenticated.shutdown();

      // The socket is either deliberately closed or reconnected already
      if (this.unauthenticated !== process) {
        return;
      }

      this.dropUnauthenticated(process);

      try {
        await this.getUnauthenticatedResource();
      } catch (error) {
        log.warn(
          'SocketManager: failed to reconnect unauthenticated socket ' +
            `due to error: ${Errors.toLogFormat(error)}`
        );
      }
    }, FIVE_MINUTES);
  }

  private queueOrHandleRequest(req: IncomingWebSocketRequest): void {
    if (this.requestHandlers.size === 0) {
      this.incomingRequestQueue.push(req);
      log.info(
        'SocketManager: request handler unavailable, ' +
          `queued request. Queue size: ${this.incomingRequestQueue.length}`
      );
      return;
    }
    for (const handlers of this.requestHandlers) {
      try {
        handlers.handleRequest(req);
      } catch (error) {
        log.warn(
          'SocketManager: got exception while handling incoming request, ' +
            `error: ${Errors.toLogFormat(error)}`
        );
      }
    }
  }

  private isAuthenticated(headers: Headers): boolean {
    if (!this.credentials) {
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
      username === this.credentials.username &&
      password === this.credentials.password
    );
  }

  // EventEmitter types

  public override on(
    type: 'authError',
    callback: (error: HTTPError) => void
  ): this;
  public override on(type: 'statusChange', callback: () => void): this;
  public override on(type: 'connectError', callback: () => void): this;

  public override on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public override emit(type: 'authError', error: HTTPError): boolean;
  public override emit(type: 'statusChange'): boolean;
  public override emit(type: 'connectError'): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }
}
