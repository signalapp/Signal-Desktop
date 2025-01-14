// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// `ChallengeHandler` is responsible for:
// 1. tracking the messages that failed to send with 428 error and could be
//    retried when user solves the challenge
// 2. presenting the challenge to user and sending the challenge response back
//    to the server
//
// The tracked messages are persisted in the database, and are imported back
// to the `ChallengeHandler` on `.load()` call (from `ts/background.ts`). They
// are not immediately retried, however, until `.onOnline()` is called from
// when we are actually online.

import { assertDev } from './util/assert';
import { isOlderThan } from './util/timestamp';
import { clearTimeoutIfNecessary } from './util/clearTimeoutIfNecessary';
import { missingCaseError } from './util/missingCaseError';
import type { StorageInterface } from './types/Storage.d';
import * as Errors from './types/errors';
import { HTTPError, type SendMessageChallengeData } from './textsecure/Errors';
import * as log from './logging/log';
import { drop } from './util/drop';
import { findRetryAfterTimeFromError } from './jobs/helpers/findRetryAfterTimeFromError';
import { MINUTE } from './util/durations';

export type ChallengeResponse = Readonly<{
  captcha: string;
}>;

export type IPCRequest = Readonly<{
  seq: number;
  reason: string;
}>;

export type IPCResponse = Readonly<{
  seq: number;
  data: ChallengeResponse;
}>;

type Handler = Readonly<{
  token: string | undefined;

  resolve(response: ChallengeResponse): void;
  reject(error: Error): void;
}>;

export type ChallengeData = Readonly<{
  type: 'captcha';
  token: string;
  captcha: string;
}>;

export type Options = Readonly<{
  storage: Pick<StorageInterface, 'get' | 'put'>;

  requestChallenge(request: IPCRequest): void;

  startQueue(conversationId: string): void;

  sendChallengeResponse(data: ChallengeData): Promise<void>;

  setChallengeStatus(challengeStatus: 'idle' | 'required' | 'pending'): void;

  onChallengeSolved(): void;
  onChallengeFailed(retryAfter?: number): void;

  expireAfter?: number;
}>;

export const STORAGE_KEY = 'challenge:conversations';

export type RegisteredChallengeType = Readonly<{
  conversationId: string;
  createdAt: number;
  reason: string;
  retryAt?: number;
  token?: string;
  silent: boolean;
}>;

type SolveOptionsType = Readonly<{
  token: string;
  reason: string;
}>;

export type MaybeSolveOptionsType = Readonly<{
  conversationId: string;
  reason: string;
}>;

export type RequestCaptchaOptionsType = Readonly<{
  reason: string;
  token?: string;
}>;

const DEFAULT_EXPIRE_AFTER = 24 * 3600 * 1000; // one day

function shouldStartQueue(registered: RegisteredChallengeType): boolean {
  // No retryAt provided; waiting for user to complete captcha
  if (!registered.retryAt) {
    return false;
  }

  if (registered.retryAt <= Date.now()) {
    return true;
  }

  return false;
}

export function getChallengeURL(type: 'chat' | 'registration'): string {
  if (type === 'chat') {
    return window.SignalContext.config.challengeUrl;
  }
  if (type === 'registration') {
    return window.SignalContext.config.registrationChallengeUrl;
  }
  throw missingCaseError(type);
}

// Note that even though this is a class - only one instance of
// `ChallengeHandler` should be in memory at the same time because they could
// overwrite each others storage data.
export class ChallengeHandler {
  #solving = 0;
  #isLoaded = false;
  #challengeToken: string | undefined;
  #seq = 0;
  #isOnline = false;
  #challengeRateLimitRetryAt: undefined | number;
  readonly #responseHandlers = new Map<number, Handler>();

  readonly #registeredConversations = new Map<
    string,
    RegisteredChallengeType
  >();

  readonly #startTimers = new Map<string, NodeJS.Timeout>();
  readonly #pendingStarts = new Set<string>();

  constructor(private readonly options: Options) {}

  public async load(): Promise<void> {
    if (this.#isLoaded) {
      return;
    }

    this.#isLoaded = true;
    const challenges: ReadonlyArray<RegisteredChallengeType> =
      this.options.storage.get(STORAGE_KEY) || [];

    log.info(`challenge: loading ${challenges.length} challenges`);

    await Promise.all(
      challenges.map(async challenge => {
        const expireAfter = this.options.expireAfter || DEFAULT_EXPIRE_AFTER;
        if (isOlderThan(challenge.createdAt, expireAfter)) {
          log.info(
            `challenge: expired challenge for conversation ${challenge.conversationId}`
          );
          return;
        }

        // The initialization order is following:
        //
        // 1. `.load()` when the `window.storage` is ready
        // 2. `.onOnline()` when we connected to the server
        //
        // Wait for `.onOnline()` to trigger the retries instead of triggering
        // them here immediately (if the message is ready to be retried).
        await this.register(challenge);
      })
    );
  }

  public async onOffline(): Promise<void> {
    this.#isOnline = false;

    log.info('challenge: offline');
  }

  public async onOnline(): Promise<void> {
    this.#isOnline = true;

    const pending = Array.from(this.#pendingStarts.values());
    this.#pendingStarts.clear();

    log.info(`challenge: online, starting ${pending.length} queues`);

    // Start queues for challenges that matured while we were offline
    await this.#startAllQueues();
  }

  public maybeSolve({ conversationId, reason }: MaybeSolveOptionsType): void {
    const challenge = this.#registeredConversations.get(conversationId);
    if (!challenge) {
      return;
    }

    if (this.#solving > 0) {
      return;
    }

    if (this.#challengeRateLimitRetryAt) {
      return;
    }

    if (challenge.token) {
      drop(this.#solve({ reason, token: challenge.token }));
    }
  }

  public scheduleRetry(
    conversationId: string,
    retryAt: number,
    reason: string
  ): void {
    const waitTime = Math.max(0, retryAt - Date.now());
    const oldTimer = this.#startTimers.get(conversationId);
    if (oldTimer) {
      clearTimeoutIfNecessary(oldTimer);
    }
    this.#startTimers.set(
      conversationId,
      setTimeout(() => {
        this.#startTimers.delete(conversationId);

        this.#challengeRateLimitRetryAt = undefined;

        drop(this.#startQueue(conversationId));
      }, waitTime)
    );
    log.info(
      `scheduleRetry(${reason}): tracking ${conversationId} with waitTime=${waitTime}`
    );
  }

  public forceWaitOnAll(retryAt: number): void {
    this.#challengeRateLimitRetryAt = retryAt;

    for (const conversationId of this.#registeredConversations.keys()) {
      const existing = this.#registeredConversations.get(conversationId);
      if (!existing) {
        continue;
      }
      this.#registeredConversations.set(conversationId, {
        ...existing,
        retryAt,
      });
      this.scheduleRetry(conversationId, retryAt, 'forceWaitOnAll');
    }
  }

  public async register(
    challenge: RegisteredChallengeType,
    data?: SendMessageChallengeData
  ): Promise<void> {
    const { conversationId, reason } = challenge;
    const logId = `challenge(${reason})`;

    if (this.isRegistered(conversationId)) {
      log.info(`${logId}: conversation ${conversationId}  already registered`);
      return;
    }

    this.#registeredConversations.set(conversationId, challenge);
    await this.#persist();

    // Challenge is already retryable - start the queue
    if (shouldStartQueue(challenge)) {
      log.info(`${logId}: starting conversation ${conversationId} immediately`);
      await this.#startQueue(conversationId);
      return;
    }

    if (this.#challengeRateLimitRetryAt) {
      this.scheduleRetry(
        conversationId,
        this.#challengeRateLimitRetryAt,
        'register-challengeRateLimit'
      );
    } else if (challenge.retryAt) {
      this.scheduleRetry(conversationId, challenge.retryAt, 'register');
    } else {
      log.info(`${logId}: tracking ${conversationId} with no waitTime`);
    }

    if (data && !data.options?.includes('captcha')) {
      const dataString = JSON.stringify(data.options);
      log.error(
        `${logId}: unexpected options ${dataString}. ${conversationId} is waiting.`
      );
      return;
    }

    if (!challenge.token) {
      const dataString = JSON.stringify(data);
      log.error(
        `${logId}: ${conversationId} is waiting; no token in data ${dataString}`
      );
      return;
    }

    if (!challenge.silent) {
      drop(this.#solve({ token: challenge.token, reason }));
    }
  }

  public onResponse(response: IPCResponse): void {
    const handler = this.#responseHandlers.get(response.seq);
    if (!handler) {
      return;
    }

    this.#responseHandlers.delete(response.seq);
    handler.resolve(response.data);
  }

  public async unregister(
    conversationId: string,
    source: string
  ): Promise<void> {
    log.info(
      `challenge: unregistered conversation ${conversationId} via ${source}`
    );
    this.#registeredConversations.delete(conversationId);
    this.#pendingStarts.delete(conversationId);

    const timer = this.#startTimers.get(conversationId);
    this.#startTimers.delete(conversationId);
    clearTimeoutIfNecessary(timer);

    await this.#persist();
  }

  public async requestCaptcha({
    reason,
    token = '',
  }: RequestCaptchaOptionsType): Promise<string> {
    const request: IPCRequest = { seq: this.#seq, reason };
    this.#seq += 1;

    this.options.requestChallenge(request);

    const response = await new Promise<ChallengeResponse>((resolve, reject) => {
      this.#responseHandlers.set(request.seq, { token, resolve, reject });
    });

    return response.captcha;
  }

  async #persist(): Promise<void> {
    assertDev(
      this.#isLoaded,
      'ChallengeHandler has to be loaded before persisting new data'
    );
    await this.options.storage.put(
      STORAGE_KEY,
      Array.from(this.#registeredConversations.values())
    );
  }

  public areAnyRegistered(): boolean {
    return this.#registeredConversations.size > 0;
  }

  public isRegistered(conversationId: string): boolean {
    return this.#registeredConversations.has(conversationId);
  }

  #startAllQueues({
    force = false,
  }: {
    force?: boolean;
  } = {}): void {
    log.info(`challenge: startAllQueues force=${force}`);

    Array.from(this.#registeredConversations.values())
      .filter(challenge => force || shouldStartQueue(challenge))
      .forEach(challenge => this.#startQueue(challenge.conversationId));
  }

  async #startQueue(conversationId: string): Promise<void> {
    if (!this.#isOnline) {
      this.#pendingStarts.add(conversationId);
      return;
    }

    await this.unregister(conversationId, 'startQueue');

    if (this.#registeredConversations.size === 0) {
      this.options.setChallengeStatus('idle');
    }

    log.info(`startQueue: starting queue ${conversationId}`);
    this.options.startQueue(conversationId);
  }

  async #solve({ reason, token }: SolveOptionsType): Promise<void> {
    this.#solving += 1;
    this.options.setChallengeStatus('required');
    this.#challengeToken = token;

    const captcha = await this.requestCaptcha({ reason, token });

    // Another `.solve()` has completed earlier than us
    if (this.#challengeToken === undefined) {
      this.#solving -= 1;
      return;
    }

    const lastToken = this.#challengeToken;
    this.#challengeToken = undefined;

    this.options.setChallengeStatus('pending');

    log.info(`challenge(${reason}): sending challenge to server`);

    try {
      await this.options.sendChallengeResponse({
        type: 'captcha',
        token: lastToken,
        captcha,
      });
    } catch (error) {
      // If we get an error back from server after solving a captcha, it could be that we
      // are rate-limited (413, 429), that we need to solve another captcha (428), or any
      // other possible 4xx, 5xx error.

      // In general, unless we're being rate-limited, we don't want to wait to show
      // another captcha: this may be a time-critical situation (e.g. user is in a call),
      // and if the server 500s, for instance, we  want to allow the user to immediately
      // try again.
      let defaultRetryAfter = 0;

      if (error instanceof HTTPError) {
        if ([413, 429].includes(error.code)) {
          // These rate-limit codes should have a retry-after in the response, but just in
          // case, let's wait a minute
          defaultRetryAfter = MINUTE;
        }
      }

      const retryAfter = findRetryAfterTimeFromError(error, defaultRetryAfter);

      log.error(
        `challenge(${reason}): challenge solve failure; will retry after ${retryAfter}ms; error:`,
        Errors.toLogFormat(error)
      );

      const retryAt = retryAfter + Date.now();

      // Remove the challenge dialog, and trigger the conversationJobQueue to retry the
      // sends, which will likely trigger another captcha
      this.options.setChallengeStatus('idle');
      this.options.onChallengeFailed(retryAfter);
      this.forceWaitOnAll(retryAt);
      return;
    } finally {
      this.#solving -= 1;
    }

    log.info(`challenge(${reason}): challenge success. force sending`);

    this.options.setChallengeStatus('idle');
    this.options.onChallengeSolved();
    this.#startAllQueues({ force: true });
  }
}
