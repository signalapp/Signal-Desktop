// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import type { Duplex } from 'node:stream';

import type { LoggerType } from '../types/Logging.std.ts';
import * as Errors from '../types/errors.std.ts';
import { drop } from '../util/drop.std.ts';
import { safeParseUnknown } from '../util/schemas.std.ts';
import {
  clientTranscript,
  decodeBase64Url,
  encodeBase64Url,
  getKeyFingerprint,
  serverTranscript,
  signWithServerKey,
  verifySignature,
} from './auth.node.ts';
import { FrameError } from './errors.std.ts';
import { FrameDecoder, FrameKind, encodeJsonFrame } from './framing.std.ts';
import type {
  ExternalClientAuthorityType,
  ExternalClientHostType,
  GrantType,
} from './hostTypes.std.ts';
import type {
  AuthorizationResultType,
  BroadcastEventNameType,
  CapabilityType,
  ErrorCodeType,
  EventFrameType,
  EventsResultType,
  EventTopicType,
  HelloResultType,
  LimitsType,
  RequestEnvelopeType,
  ResponseType,
} from './protocol.std.ts';
import {
  ALL_EVENT_TOPICS,
  Capability,
  ERROR_MESSAGES,
  ErrorCode,
  EVENT_TOPIC_CAPABILITIES,
  EVENT_TOPICS,
  EventName,
  EventTopic,
  IMPLEMENTED_CAPABILITIES,
  Method,
  PROTOCOL_NAME,
  SERVICE_METHOD_CAPABILITIES,
  SERVICE_PARAM_SCHEMAS,
  authenticateParamsSchema,
  eventsSubscribeParamsSchema,
  eventsUnsubscribeParamsSchema,
  helloParamsSchema,
  isServiceMethod,
  notificationsSetHandledParamsSchema,
  makeError,
  negotiateVersion,
  requestAuthorizationParamsSchema,
  requestEnvelopeSchema,
} from './protocol.std.ts';

// One connected external client and its state machine:
//
//   AwaitingHello -> Greeted -> Authorized -> Closed
//
// Nothing beyond the handshake is served until the client proves possession
// of a key that the user approved in Signal, and every service method is
// checked against the capabilities granted to that key.

export type ExternalClientLoggerType = Pick<
  LoggerType,
  'info' | 'warn' | 'error'
>;

export type ExternalClientSessionOptionsType = Readonly<{
  socket: Duplex;
  limits: LimitsType;
  log: ExternalClientLoggerType;
  getSignalVersion: () => string;
  authority: ExternalClientAuthorityType;
  host: ExternalClientHostType;
  onClosed: (session: ExternalClientSession) => void;
  onTopicsChanged: () => void;
  onNotificationsHandledChanged: () => void;
}>;

const SessionState = {
  AwaitingHello: 'AwaitingHello',
  Greeted: 'Greeted',
  Authorized: 'Authorized',
  Closed: 'Closed',
} as const;
type SessionStateType = (typeof SessionState)[keyof typeof SessionState];

const CLOSE_GRACE_MS = 1000;

const utf8 = new TextDecoder('utf-8', { fatal: true });

export class ExternalClientSession {
  readonly id = randomBytes(16).toString('hex');
  readonly socket: Duplex;
  readonly #limits: LimitsType;
  readonly #log: ExternalClientLoggerType;
  readonly #getSignalVersion: () => string;
  readonly #authority: ExternalClientAuthorityType;
  readonly #host: ExternalClientHostType;
  readonly #onClosed: (session: ExternalClientSession) => void;
  readonly #onTopicsChanged: () => void;
  readonly #onNotificationsHandledChanged: () => void;
  readonly #decoder: FrameDecoder;
  readonly #challenge = randomBytes(32);
  #handshakeTimer: NodeJS.Timeout | undefined;
  #state: SessionStateType = SessionState.AwaitingHello;
  #outstanding = 0;
  #authInFlight = false;
  #publicKey: string | undefined;
  #capabilities: ReadonlySet<CapabilityType> = new Set();
  #topics = new Set<EventTopicType>();
  #eventSeq = 0;
  #handlesNotifications = false;

  constructor(options: ExternalClientSessionOptionsType) {
    this.socket = options.socket;
    this.#limits = options.limits;
    this.#log = options.log;
    this.#getSignalVersion = options.getSignalVersion;
    this.#authority = options.authority;
    this.#host = options.host;
    this.#onClosed = options.onClosed;
    this.#onTopicsChanged = options.onTopicsChanged;
    this.#onNotificationsHandledChanged = options.onNotificationsHandledChanged;
    this.#decoder = new FrameDecoder({
      maxPayloadBytes: this.#limits.maxFrameBytes,
      allowedKinds: [FrameKind.Json],
    });
    this.#startHandshakeTimer();

    this.socket.on('data', chunk => this.#onData(chunk));
    this.socket.on('error', (error: NodeJS.ErrnoException) => {
      this.#log.warn(`session ${this.logId}: socket error`, error.code);
    });
    this.socket.on('close', () => this.#handleClosed());
  }

  get logId(): string {
    return this.id.slice(0, 8);
  }

  get publicKey(): string | undefined {
    return this.#publicKey;
  }

  get topics(): ReadonlySet<EventTopicType> {
    return this.#topics;
  }

  get handlesNotifications(): boolean {
    return this.#handlesNotifications && !this.#isClosed();
  }

  // Sends a broadcast event if this session subscribed to its topic.
  deliverEvent(event: BroadcastEventNameType, data: unknown): void {
    const topic = EVENT_TOPICS[event];
    if (this.#isClosed() || !this.#topics.has(topic)) {
      return;
    }
    // Capabilities were checked on subscribe; check again so a topic can
    // never outlive the grant that allowed it.
    if (!this.#capabilities.has(EVENT_TOPIC_CAPABILITIES[topic])) {
      return;
    }
    if (this.socket.writableLength > this.#limits.maxEventBacklogBytes) {
      this.#log.warn(`session ${this.logId}: client behind, dropping events`);
      this.dropEvents();
      return;
    }
    this.#sendEvent(event, data);
  }

  // Unsubscribes from everything and tells the client to resynchronize.
  dropEvents(): void {
    if (this.#isClosed() || this.#topics.size === 0) {
      return;
    }
    this.#topics = new Set();
    this.#sendEvent(EventName.EventsDropped, {});
    this.#onTopicsChanged();
    this.#releaseNotificationsIfUnsubscribed();
  }

  // A client may only hold notifications while it receives messages;
  // otherwise new messages would arrive with nobody notifying (D22).
  #releaseNotificationsIfUnsubscribed(): void {
    if (!this.#handlesNotifications || this.#topics.has(EventTopic.Messages)) {
      return;
    }
    this.#handlesNotifications = false;
    this.#log.info(
      `session ${this.logId}: released notifications (no messages subscription)`
    );
    this.#onNotificationsHandledChanged();
  }

  close(): void {
    if (this.#state === SessionState.Closed) {
      return;
    }
    this.#state = SessionState.Closed;
    this.#stopHandshakeTimer();
    this.socket.end();
    // Do not wait long on a client that is not reading.
    setTimeout(() => this.socket.destroy(), CLOSE_GRACE_MS).unref();
  }

  // Covers both the hello and the authentication step, except while the
  // user is looking at an approval prompt.
  #startHandshakeTimer(): void {
    this.#stopHandshakeTimer();
    this.#handshakeTimer = setTimeout(() => {
      this.#log.warn(`session ${this.logId}: handshake timed out`);
      this.close();
    }, this.#limits.handshakeTimeoutMs);
  }

  #stopHandshakeTimer(): void {
    clearTimeout(this.#handshakeTimer);
    this.#handshakeTimer = undefined;
  }

  #isClosed(): boolean {
    return this.#state === SessionState.Closed;
  }

  #handleClosed(): void {
    if (!this.#isClosed()) {
      this.#log.info(`session ${this.logId}: connection lost`);
    }
    this.#state = SessionState.Closed;
    this.#stopHandshakeTimer();
    this.#topics = new Set();
    this.#handlesNotifications = false;
    this.#onClosed(this);
  }

  #onData(chunk: Uint8Array<ArrayBuffer>): void {
    if (this.#isClosed()) {
      return;
    }

    let frames;
    try {
      frames = this.#decoder.push(chunk);
    } catch (error) {
      if (!(error instanceof FrameError)) {
        throw error;
      }
      this.#reject(null, ErrorCode.InvalidRequest, 'Malformed frame');
      return;
    }

    for (const frame of frames) {
      if (this.#isClosed()) {
        return;
      }
      this.#onFrame(frame.payload);
    }
  }

  #onFrame(payload: Uint8Array<ArrayBuffer>): void {
    let json: unknown;
    try {
      json = JSON.parse(utf8.decode(payload));
    } catch {
      this.#reject(null, ErrorCode.InvalidRequest, 'Malformed message');
      return;
    }

    const parsed = safeParseUnknown(requestEnvelopeSchema, json);
    if (!parsed.success) {
      this.#reject(null, ErrorCode.InvalidRequest, 'Malformed request');
      return;
    }

    const request = parsed.data;
    if (this.#outstanding >= this.#limits.maxOutstandingRequests) {
      this.#sendError(request.id, ErrorCode.RateLimited, 'Too many requests');
      return;
    }

    this.#outstanding += 1;
    drop(this.#handleRequest(request));
  }

  async #handleRequest(request: RequestEnvelopeType): Promise<void> {
    try {
      await this.#onRequest(request);
    } catch (error) {
      this.#log.error(
        `session ${this.logId}: request failed`,
        Errors.toLogFormat(error)
      );
      this.#sendError(request.id, ErrorCode.InternalError, 'Internal error');
    } finally {
      this.#outstanding -= 1;
    }
  }

  async #onRequest(request: RequestEnvelopeType): Promise<void> {
    if (this.#state === SessionState.AwaitingHello) {
      if (request.method !== Method.Hello) {
        this.#reject(request.id, ErrorCode.InvalidRequest, 'Expected hello');
        return;
      }
      await this.#onHello(request);
      return;
    }

    switch (request.method) {
      case Method.Hello:
        this.#reject(request.id, ErrorCode.InvalidRequest, 'Already greeted');
        return;
      case Method.Disconnect:
        this.#sendResult(request.id, {});
        this.#log.info(`session ${this.logId}: client disconnected`);
        this.close();
        return;
      case Method.Authenticate:
        await this.#onAuthenticate(request);
        return;
      case Method.RequestAuthorization:
        await this.#onRequestAuthorization(request);
        return;
      case Method.GetStatus:
        if (!this.#requireAuthorized(request)) {
          return;
        }
        this.#sendResult(request.id, { state: await this.#host.getStatus() });
        return;
      case Method.EventsSubscribe:
        if (!this.#requireAuthorized(request)) {
          return;
        }
        this.#onSubscribe(request);
        return;
      case Method.EventsUnsubscribe:
        if (!this.#requireAuthorized(request)) {
          return;
        }
        this.#onUnsubscribe(request);
        return;
      case Method.NotificationsSetHandled:
        if (!this.#requireAuthorized(request)) {
          return;
        }
        this.#onSetNotificationsHandled(request);
        return;
      default:
        break;
    }

    const { method } = request;
    if (!isServiceMethod(method)) {
      this.#sendError(
        request.id,
        ErrorCode.UnsupportedMethod,
        'Unsupported method'
      );
      return;
    }
    if (!this.#requireAuthorized(request)) {
      return;
    }
    if (!this.#capabilities.has(SERVICE_METHOD_CAPABILITIES[method])) {
      this.#log.warn(`session ${this.logId}: permission denied for ${method}`);
      this.#sendError(
        request.id,
        ErrorCode.PermissionDenied,
        'Client is not authorized for this method'
      );
      return;
    }

    const rawParams: unknown = request.params ?? {};
    const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
    if (!params.success) {
      this.#sendError(request.id, ErrorCode.InvalidArgument, 'Invalid params');
      return;
    }

    const result = await this.#host.callService(method, params.data);
    if (result.ok) {
      this.#sendResult(request.id, result.value);
    } else {
      this.#log.info(
        `session ${this.logId}: ${method} failed (${result.code})`
      );
      this.#send(
        makeError(
          request.id,
          result.code,
          ERROR_MESSAGES[result.code],
          result.reason
        )
      );
    }
  }

  #onSubscribe(request: RequestEnvelopeType): void {
    const parsed = safeParseUnknown(
      eventsSubscribeParamsSchema,
      request.params
    );
    if (!parsed.success) {
      this.#sendError(request.id, ErrorCode.InvalidArgument, 'Invalid params');
      return;
    }
    const { topics } = parsed.data;
    // All or nothing: one topic the client may not see refuses the request.
    if (
      !topics.every(topic =>
        this.#capabilities.has(EVENT_TOPIC_CAPABILITIES[topic])
      )
    ) {
      this.#log.warn(`session ${this.logId}: permission denied for events`);
      this.#sendError(
        request.id,
        ErrorCode.PermissionDenied,
        'Client is not authorized for this topic'
      );
      return;
    }
    const before = this.#topics.size;
    this.#topics = new Set([...this.#topics, ...topics]);
    // Respond before any event can follow, so the client knows the
    // subscription is live when the first event arrives.
    this.#sendResult(request.id, this.#topicsResult());
    if (this.#topics.size !== before) {
      this.#log.info(
        `session ${this.logId}: subscribed to ${[...this.#topics].join(',')}`
      );
      this.#onTopicsChanged();
    }
  }

  #onUnsubscribe(request: RequestEnvelopeType): void {
    const rawParams: unknown = request.params ?? {};
    const parsed = safeParseUnknown(eventsUnsubscribeParamsSchema, rawParams);
    if (!parsed.success) {
      this.#sendError(request.id, ErrorCode.InvalidArgument, 'Invalid params');
      return;
    }
    const remove = new Set(parsed.data.topics ?? ALL_EVENT_TOPICS);
    const before = this.#topics.size;
    this.#topics = new Set([...this.#topics].filter(t => !remove.has(t)));
    this.#sendResult(request.id, this.#topicsResult());
    if (this.#topics.size !== before) {
      this.#onTopicsChanged();
      this.#releaseNotificationsIfUnsubscribed();
    }
  }

  #onSetNotificationsHandled(request: RequestEnvelopeType): void {
    if (!this.#capabilities.has(Capability.NotificationsManage)) {
      this.#sendError(
        request.id,
        ErrorCode.PermissionDenied,
        'Client is not authorized for this method'
      );
      return;
    }
    const parsed = safeParseUnknown(
      notificationsSetHandledParamsSchema,
      request.params
    );
    if (!parsed.success) {
      this.#sendError(request.id, ErrorCode.InvalidArgument, 'Invalid params');
      return;
    }
    const { handled } = parsed.data;
    if (handled && !this.#topics.has(EventTopic.Messages)) {
      this.#sendError(
        request.id,
        ErrorCode.PreconditionFailed,
        'Subscribe to the messages topic first'
      );
      return;
    }
    const changed = handled !== this.#handlesNotifications;
    this.#handlesNotifications = handled;
    this.#sendResult(request.id, { handled });
    if (changed) {
      this.#log.info(
        `session ${this.logId}: ${handled ? 'handles' : 'released'} notifications`
      );
      this.#onNotificationsHandledChanged();
    }
  }

  #topicsResult(): EventsResultType {
    return { topics: ALL_EVENT_TOPICS.filter(t => this.#topics.has(t)) };
  }

  async #onHello(request: RequestEnvelopeType): Promise<void> {
    const parsed = safeParseUnknown(helloParamsSchema, request.params);
    if (!parsed.success) {
      this.#reject(request.id, ErrorCode.InvalidRequest, 'Invalid hello');
      return;
    }

    const version = negotiateVersion(parsed.data.versions);
    if (version === undefined) {
      this.#log.info(`session ${this.logId}: protocol mismatch`);
      this.#reject(
        request.id,
        ErrorCode.UnsupportedVersion,
        'No common protocol version'
      );
      return;
    }

    this.#state = SessionState.Greeted;
    const serverKey = await this.#authority.getServerKey();
    this.#log.info(
      `session ${this.logId}: hello accepted, protocol v${version}`
    );

    const result: HelloResultType = {
      protocol: PROTOCOL_NAME,
      protocolVersion: version,
      signalVersion: this.#getSignalVersion(),
      sessionId: this.id,
      capabilities: IMPLEMENTED_CAPABILITIES,
      features: {
        'authentication.required': true,
        'calling.available': false,
      },
      challenge: encodeBase64Url(this.#challenge),
      server: {
        publicKey: serverKey.publicKey,
        signature: signWithServerKey(
          serverKey,
          serverTranscript(
            this.id,
            this.#challenge,
            decodeBase64Url(parsed.data.clientNonce)
          )
        ),
      },
    };
    this.#sendResult(request.id, result);
  }

  #verifyProof(publicKey: string, signature: string): boolean {
    return verifySignature(
      publicKey,
      clientTranscript(this.id, this.#challenge),
      signature
    );
  }

  async #onAuthenticate(request: RequestEnvelopeType): Promise<void> {
    if (this.#state !== SessionState.Greeted || this.#authInFlight) {
      this.#reject(request.id, ErrorCode.InvalidRequest, 'Unexpected request');
      return;
    }
    const parsed = safeParseUnknown(authenticateParamsSchema, request.params);
    if (!parsed.success) {
      this.#reject(request.id, ErrorCode.InvalidRequest, 'Invalid params');
      return;
    }
    const { publicKey, signature } = parsed.data;

    this.#authInFlight = true;
    try {
      const grant = this.#verifyProof(publicKey, signature)
        ? await this.#authority.findGrant(publicKey)
        : undefined;
      if (!grant) {
        this.#log.warn(`session ${this.logId}: authentication failed`);
        this.#reject(request.id, ErrorCode.NotAuthorized, 'Not authorized');
        return;
      }
      await this.#becomeAuthorized(grant);
      this.#sendResult(request.id, {
        capabilities: grant.capabilities,
      } satisfies AuthorizationResultType);
    } finally {
      this.#authInFlight = false;
    }
  }

  async #onRequestAuthorization(request: RequestEnvelopeType): Promise<void> {
    if (this.#state !== SessionState.Greeted || this.#authInFlight) {
      this.#reject(request.id, ErrorCode.InvalidRequest, 'Unexpected request');
      return;
    }
    const parsed = safeParseUnknown(
      requestAuthorizationParamsSchema,
      request.params
    );
    if (!parsed.success) {
      this.#reject(request.id, ErrorCode.InvalidRequest, 'Invalid params');
      return;
    }
    const { publicKey, signature, displayName } = parsed.data;
    const capabilities = [...new Set(parsed.data.capabilities)];

    if (!this.#verifyProof(publicKey, signature)) {
      this.#log.warn(`session ${this.logId}: bad proof of possession`);
      this.#reject(request.id, ErrorCode.NotAuthorized, 'Not authorized');
      return;
    }
    if (!capabilities.every(cap => IMPLEMENTED_CAPABILITIES.includes(cap))) {
      this.#sendError(
        request.id,
        ErrorCode.UnsupportedCapability,
        'Requested capability is not available'
      );
      return;
    }

    this.#authInFlight = true;
    try {
      const existing = await this.#authority.findGrant(publicKey);
      if (
        existing &&
        capabilities.every(cap => existing.capabilities.includes(cap))
      ) {
        await this.#becomeAuthorized(existing);
        this.#sendResult(request.id, {
          capabilities: existing.capabilities,
        } satisfies AuthorizationResultType);
        return;
      }

      const fingerprint = getKeyFingerprint(publicKey);
      this.#log.info(
        `session ${this.logId}: client ${fingerprint} requested approval`
      );
      // The user may take a while to answer; don't time the client out.
      this.#stopHandshakeTimer();
      const result = await this.#authority.requestApproval({
        publicKey,
        fingerprint,
        displayName,
        capabilities,
      });
      if (this.#isClosed()) {
        return;
      }
      if (!result.approved) {
        this.#log.info(
          `session ${this.logId}: client ${fingerprint} not approved ` +
            `(${result.reason})`
        );
        this.#reject(
          request.id,
          result.reason === 'denied'
            ? ErrorCode.PermissionDenied
            : ErrorCode.RateLimited,
          result.reason === 'denied' ? 'Denied by user' : 'Try again later'
        );
        return;
      }
      await this.#becomeAuthorized(result.grant);
      this.#sendResult(request.id, {
        capabilities: result.grant.capabilities,
      } satisfies AuthorizationResultType);
    } finally {
      this.#authInFlight = false;
    }
  }

  async #becomeAuthorized(grant: GrantType): Promise<void> {
    this.#stopHandshakeTimer();
    this.#state = SessionState.Authorized;
    this.#publicKey = grant.publicKey;
    this.#capabilities = new Set(grant.capabilities);
    this.#log.info(
      `session ${this.logId}: client ${grant.fingerprint} authorized`
    );
    await this.#authority.markSeen(grant.publicKey);
  }

  #requireAuthorized(request: RequestEnvelopeType): boolean {
    if (this.#state === SessionState.Authorized) {
      return true;
    }
    this.#sendError(request.id, ErrorCode.NotAuthorized, 'Not authorized');
    return false;
  }

  // Protocol violations are answered once and then the connection is closed.
  // Nothing is ever written before the client has written to the connection,
  // so a peer that can only open the endpoint for reading learns nothing.
  #reject(id: string | null, code: ErrorCodeType, message: string): void {
    this.#log.warn(`session ${this.logId}: rejected (${code})`);
    this.#send(makeError(id, code, message));
    this.close();
  }

  #sendError(id: string, code: ErrorCodeType, message: string): void {
    this.#send(makeError(id, code, message));
  }

  #sendResult(id: string, result: unknown): void {
    this.#send({ id, result });
  }

  #sendEvent(event: EventFrameType['event'], data: unknown): void {
    this.#eventSeq += 1;
    this.#send({ event, seq: this.#eventSeq, data });
  }

  #send(response: ResponseType | EventFrameType): void {
    if (this.socket.destroyed || !this.socket.writable) {
      return;
    }
    this.socket.write(encodeJsonFrame(response));
    // A client that does not read must not grow our memory without bound.
    if (this.socket.writableLength > 2 * this.#limits.maxFrameBytes) {
      this.#log.warn(`session ${this.logId}: client not reading`);
      this.socket.destroy();
    }
  }
}
