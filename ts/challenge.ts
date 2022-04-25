// Copyright 2021-2022 Signal Messenger, LLC
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

import { assert } from './util/assert';
import { isOlderThan } from './util/timestamp';
import { parseRetryAfterWithDefault } from './util/parseRetryAfter';
import { clearTimeoutIfNecessary } from './util/clearTimeoutIfNecessary';
import { getEnvironment, Environment } from './environment';
import type { StorageInterface } from './types/Storage.d';
import { HTTPError } from './textsecure/Errors';
import type { SendMessageChallengeData } from './textsecure/Errors';
import * as log from './logging/log';

export type ChallengeResponse = {
  readonly captcha: string;
};

export type IPCRequest = {
  readonly seq: number;
};

export type IPCResponse = {
  readonly seq: number;
  readonly data: ChallengeResponse;
};

type Handler = {
  readonly token: string | undefined;

  resolve(response: ChallengeResponse): void;
  reject(error: Error): void;
};

export type ChallengeData = {
  readonly type: 'recaptcha';
  readonly token: string;
  readonly captcha: string;
};

export type Options = {
  readonly storage: Pick<StorageInterface, 'get' | 'put'>;

  requestChallenge(request: IPCRequest): void;

  startQueue(conversationId: string): void;

  sendChallengeResponse(data: ChallengeData): Promise<void>;

  setChallengeStatus(challengeStatus: 'idle' | 'required' | 'pending'): void;

  onChallengeSolved(): void;
  onChallengeFailed(retryAfter?: number): void;

  expireAfter?: number;
};

export const STORAGE_KEY = 'challenge:conversations';

export type RegisteredChallengeType = Readonly<{
  conversationId: string;
  createdAt: number;
  retryAt?: number;
  token?: string;
}>;

const DEFAULT_EXPIRE_AFTER = 24 * 3600 * 1000; // one day
const CAPTCHA_URL = 'https://signalcaptchas.org/challenge/generate.html';
const CAPTCHA_STAGING_URL =
  'https://signalcaptchas.org/staging/challenge/generate.html';

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

export function getChallengeURL(): string {
  if (getEnvironment() === Environment.Staging) {
    return CAPTCHA_STAGING_URL;
  }
  return CAPTCHA_URL;
}

// Note that even though this is a class - only one instance of
// `ChallengeHandler` should be in memory at the same time because they could
// overwrite each others storage data.
export class ChallengeHandler {
  private solving = 0;

  private isLoaded = false;

  private challengeToken: string | undefined;

  private seq = 0;

  private isOnline = false;

  private readonly responseHandlers = new Map<number, Handler>();

  private readonly registeredConversations = new Map<
    string,
    RegisteredChallengeType
  >();

  private readonly startTimers = new Map<string, NodeJS.Timeout>();

  private readonly pendingStarts = new Set<string>();

  constructor(private readonly options: Options) {}

  public async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    this.isLoaded = true;
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
    this.isOnline = false;

    log.info('challenge: offline');
  }

  public async onOnline(): Promise<void> {
    this.isOnline = true;

    const pending = Array.from(this.pendingStarts.values());
    this.pendingStarts.clear();

    log.info(`challenge: online, starting ${pending.length} queues`);

    // Start queues for challenges that matured while we were offline
    await Promise.all(
      pending.map(conversationId => this.startQueue(conversationId))
    );

    await this.startAllQueues();
  }

  public maybeSolve(conversationId: string): void {
    const challenge = this.registeredConversations.get(conversationId);
    if (!challenge) {
      return;
    }

    if (this.solving > 0) {
      return;
    }

    if (challenge.token) {
      this.solve(challenge.token);
    }
  }

  public async register(
    challenge: RegisteredChallengeType,
    data?: SendMessageChallengeData
  ): Promise<void> {
    const { conversationId } = challenge;

    if (this.isRegistered(conversationId)) {
      log.info(`challenge: conversation ${conversationId}  already registered`);
      return;
    }

    this.registeredConversations.set(conversationId, challenge);
    await this.persist();

    // Challenge is already retryable - start the queue
    if (shouldStartQueue(challenge)) {
      log.info(
        `challenge: starting conversation ${conversationId} immediately`
      );
      await this.startQueue(conversationId);
      return;
    }

    if (challenge.retryAt) {
      const waitTime = Math.max(0, challenge.retryAt - Date.now());
      const oldTimer = this.startTimers.get(conversationId);
      if (oldTimer) {
        clearTimeoutIfNecessary(oldTimer);
      }
      this.startTimers.set(
        conversationId,
        setTimeout(() => {
          this.startTimers.delete(conversationId);

          this.startQueue(conversationId);
        }, waitTime)
      );
      log.info(
        `challenge: tracking ${conversationId} with waitTime=${waitTime}`
      );
    } else {
      log.info(`challenge: tracking ${conversationId} with no waitTime`);
    }

    if (data && !data.options?.includes('recaptcha')) {
      log.error(
        `challenge: unexpected options ${JSON.stringify(data.options)}`
      );
    }

    if (!challenge.token) {
      const dataString = JSON.stringify(data);
      log.error(
        `challenge: ${conversationId} is waiting; no token in data ${dataString}`
      );
      return;
    }

    this.solve(challenge.token);
  }

  public onResponse(response: IPCResponse): void {
    const handler = this.responseHandlers.get(response.seq);
    if (!handler) {
      return;
    }

    this.responseHandlers.delete(response.seq);
    handler.resolve(response.data);
  }

  public async unregister(conversationId: string): Promise<void> {
    log.info(`challenge: unregistered conversation ${conversationId}`);
    this.registeredConversations.delete(conversationId);
    this.pendingStarts.delete(conversationId);

    const timer = this.startTimers.get(conversationId);
    this.startTimers.delete(conversationId);
    clearTimeoutIfNecessary(timer);

    await this.persist();
  }

  public async requestCaptcha(token = ''): Promise<string> {
    const request: IPCRequest = { seq: this.seq };
    this.seq += 1;

    this.options.requestChallenge(request);

    const response = await new Promise<ChallengeResponse>((resolve, reject) => {
      this.responseHandlers.set(request.seq, { token, resolve, reject });
    });

    return response.captcha;
  }

  private async persist(): Promise<void> {
    assert(
      this.isLoaded,
      'ChallengeHandler has to be loaded before persisting new data'
    );
    await this.options.storage.put(
      STORAGE_KEY,
      Array.from(this.registeredConversations.values())
    );
  }

  public isRegistered(conversationId: string): boolean {
    return this.registeredConversations.has(conversationId);
  }

  private startAllQueues({
    force = false,
  }: {
    force?: boolean;
  } = {}): void {
    log.info(`challenge: startAllQueues force=${force}`);

    Array.from(this.registeredConversations.values())
      .filter(challenge => force || shouldStartQueue(challenge))
      .forEach(challenge => this.startQueue(challenge.conversationId));
  }

  private async startQueue(conversationId: string): Promise<void> {
    if (!this.isOnline) {
      this.pendingStarts.add(conversationId);
      return;
    }

    await this.unregister(conversationId);

    if (this.registeredConversations.size === 0) {
      this.options.setChallengeStatus('idle');
    }

    log.info(`startQueue: starting queue ${conversationId}`);
    this.options.startQueue(conversationId);
  }

  private async solve(token: string): Promise<void> {
    this.solving += 1;
    this.options.setChallengeStatus('required');
    this.challengeToken = token;

    const captcha = await this.requestCaptcha(token);

    // Another `.solve()` has completed earlier than us
    if (this.challengeToken === undefined) {
      this.solving -= 1;
      return;
    }

    const lastToken = this.challengeToken;
    this.challengeToken = undefined;

    this.options.setChallengeStatus('pending');

    log.info('challenge: sending challenge to server');

    try {
      await this.sendChallengeResponse({
        type: 'recaptcha',
        token: lastToken,
        captcha,
      });
    } catch (error) {
      log.error(`challenge: challenge failure, error: ${error && error.stack}`);
      this.options.setChallengeStatus('required');
      this.solving -= 1;
      return;
    }

    log.info('challenge: challenge success. force sending');

    this.options.setChallengeStatus('idle');

    this.startAllQueues({ force: true });
    this.solving -= 1;
  }

  private async sendChallengeResponse(data: ChallengeData): Promise<void> {
    try {
      await this.options.sendChallengeResponse(data);
    } catch (error) {
      if (
        !(error instanceof HTTPError) ||
        !(error.code === 413 || error.code === 429) ||
        !error.responseHeaders
      ) {
        this.options.onChallengeFailed();
        throw error;
      }

      const retryAfter = parseRetryAfterWithDefault(
        error.responseHeaders['retry-after']
      );

      log.info(`challenge: retry after ${retryAfter}ms`);
      this.options.onChallengeFailed(retryAfter);
      return;
    }

    this.options.onChallengeSolved();
  }
}
