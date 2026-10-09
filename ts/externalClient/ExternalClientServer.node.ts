// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createServer } from 'node:net';
import type { Duplex } from 'node:stream';
import { LocalPipeServer } from '@signalapp/windows-local-pipe';

import type { EndpointType } from './endpoint.node.ts';
import {
  cleanupEndpoint,
  prepareEndpoint,
  secureBoundEndpoint,
} from './endpoint.node.ts';
import type { ExternalClientLoggerType } from './ExternalClientSession.node.ts';
import type {
  ExternalClientAuthorityType,
  ExternalClientHostType,
} from './hostTypes.std.ts';
import { ExternalClientSession } from './ExternalClientSession.node.ts';
import type {
  BroadcastEventNameType,
  EventTopicType,
  LimitsType,
} from './protocol.std.ts';
import { ALL_EVENT_TOPICS, LIMITS } from './protocol.std.ts';

// Transport for local external clients: a Unix domain socket or a Windows
// named pipe, never a network listener. On Windows the pipe comes from
// @signalapp/windows-local-pipe rather than net.Server, because libuv's pipes
// grant Everyone read access and accept remote (SMB) clients. This file knows nothing about
// Electron or Signal internals; everything Signal-specific is injected so it
// can be tested under plain Node.

export type ExternalClientServerOptionsType = Readonly<{
  endpoint: EndpointType;
  getSignalVersion: () => string;
  log: ExternalClientLoggerType;
  authority: ExternalClientAuthorityType;
  host: ExternalClientHostType;
  limits?: Partial<LimitsType>;
  // Called with the union of all sessions' topics whenever it changes, so
  // the event source can do no work while nobody is listening.
  onTopicsChanged?: (topics: ReadonlyArray<EventTopicType>) => void;
  // Called when "some connected app shows message notifications" flips.
  onNotificationsHandledChanged?: (handled: boolean) => void;
}>;

export class ExternalClientServer {
  readonly #endpoint: EndpointType;
  readonly #getSignalVersion: () => string;
  readonly #log: ExternalClientLoggerType;
  readonly #authority: ExternalClientAuthorityType;
  readonly #host: ExternalClientHostType;
  readonly #limits: LimitsType;
  readonly #sessions = new Set<ExternalClientSession>();
  readonly #onTopicsChanged:
    | ((topics: ReadonlyArray<EventTopicType>) => void)
    | undefined;
  #topics: ReadonlyArray<EventTopicType> = [];
  readonly #onNotificationsHandledChanged:
    | ((handled: boolean) => void)
    | undefined;
  #notificationsHandled = false;
  #listener: Readonly<{ close: () => Promise<void> }> | undefined;

  constructor(options: ExternalClientServerOptionsType) {
    this.#endpoint = options.endpoint;
    this.#getSignalVersion = options.getSignalVersion;
    this.#log = options.log;
    this.#authority = options.authority;
    this.#host = options.host;
    this.#limits = { ...LIMITS, ...options.limits };
    this.#onTopicsChanged = options.onTopicsChanged;
    this.#onNotificationsHandledChanged = options.onNotificationsHandledChanged;
  }

  get isListening(): boolean {
    return this.#listener !== undefined;
  }

  get sessionCount(): number {
    return this.#sessions.size;
  }

  get topics(): ReadonlyArray<EventTopicType> {
    return this.#topics;
  }

  get notificationsHandled(): boolean {
    return this.#notificationsHandled;
  }

  #updateNotificationsHandled(): void {
    let handled = false;
    for (const session of this.#sessions) {
      if (session.handlesNotifications) {
        handled = true;
        break;
      }
    }
    if (handled === this.#notificationsHandled) {
      return;
    }
    this.#notificationsHandled = handled;
    this.#onNotificationsHandledChanged?.(handled);
  }

  broadcast(event: BroadcastEventNameType, data: unknown): void {
    for (const session of this.#sessions) {
      session.deliverEvent(event, data);
    }
  }

  // The event source lost events; every subscriber must resynchronize.
  dropEvents(): void {
    for (const session of this.#sessions) {
      session.dropEvents();
    }
  }

  #updateTopics(): void {
    const subscribed = new Set<EventTopicType>();
    for (const session of this.#sessions) {
      for (const topic of session.topics) {
        subscribed.add(topic);
      }
    }
    const topics = ALL_EVENT_TOPICS.filter(topic => subscribed.has(topic));
    if (topics.join() === this.#topics.join()) {
      return;
    }
    this.#topics = topics;
    this.#onTopicsChanged?.(topics);
  }

  async start(): Promise<void> {
    if (this.#listener) {
      return;
    }

    await prepareEndpoint(this.#endpoint);
    this.#listener =
      this.#endpoint.kind === 'pipe'
        ? await this.#listenOnPipe(this.#endpoint.path)
        : await this.#listenOnSocket(this.#endpoint.path);
    await secureBoundEndpoint(this.#endpoint);
    this.#log.info('external client bridge listening');
  }

  async stop(): Promise<void> {
    const listener = this.#listener;
    if (!listener) {
      return;
    }
    this.#listener = undefined;

    for (const session of this.#sessions) {
      session.socket.destroy();
    }
    this.#sessions.clear();
    this.#updateTopics();
    this.#updateNotificationsHandled();

    await listener.close();
    await cleanupEndpoint(this.#endpoint);
    this.#log.info('external client bridge stopped');
  }

  async #listenOnSocket(
    path: string
  ): Promise<Readonly<{ close: () => Promise<void> }>> {
    const server = createServer(socket => this.#onConnection(socket));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ path, readableAll: false, writableAll: false }, () => {
        server.off('error', reject);
        resolve();
      });
    });
    server.on('error', (error: NodeJS.ErrnoException) => {
      this.#log.error('server error', error.code);
    });
    return {
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  }

  async #listenOnPipe(
    path: string
  ): Promise<Readonly<{ close: () => Promise<void> }>> {
    const server = new LocalPipeServer();
    server.on('connection', socket => this.#onConnection(socket));
    server.on('error', (error: Error) => {
      this.#log.error('pipe server error', error.message);
    });
    await server.listen(path);
    return { close: () => server.close() };
  }

  // Closes every live session authenticated with this key. Called after the
  // grant has been deleted, so a reconnect fails authentication.
  revoke(publicKey: string): number {
    let closed = 0;
    for (const session of this.#sessions) {
      if (session.publicKey === publicKey) {
        session.close();
        closed += 1;
      }
    }
    return closed;
  }

  #onConnection(socket: Duplex): void {
    if (this.#sessions.size >= this.#limits.maxConnections) {
      this.#log.warn('connection refused: too many connections');
      socket.destroy();
      return;
    }
    const session = new ExternalClientSession({
      socket,
      limits: this.#limits,
      log: this.#log,
      getSignalVersion: this.#getSignalVersion,
      authority: this.#authority,
      host: this.#host,
      onClosed: closed => {
        this.#sessions.delete(closed);
        this.#updateTopics();
        // An app that quits or crashes hands notifications back to Signal.
        this.#updateNotificationsHandled();
      },
      onTopicsChanged: () => this.#updateTopics(),
      onNotificationsHandledChanged: () => this.#updateNotificationsHandled(),
    });
    this.#sessions.add(session);
    this.#log.info(`session ${session.logId}: client requested connection`);
  }
}
