// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-restricted-syntax */

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

import { MessageModel } from './models/messages';
import { assert } from './util/assert';
import { isNotNil } from './util/isNotNil';
import { isOlderThan } from './util/timestamp';
import { parseRetryAfter } from './util/parseRetryAfter';
import { getEnvironment, Environment } from './environment';

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

export enum RetryMode {
  Retry = 'Retry',
  NoImmediateRetry = 'NoImmediateRetry',
}

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

export type MinimalMessage = Pick<
  MessageModel,
  'id' | 'idForLogging' | 'getLastChallengeError' | 'retrySend'
> & {
  isNormalBubble(): boolean;
  get(name: 'sent_at'): number;
  on(event: 'sent', callback: () => void): void;
  off(event: 'sent', callback: () => void): void;
};

export type Options = {
  readonly storage: {
    get(key: string): ReadonlyArray<StoredEntity>;
    put(key: string, value: ReadonlyArray<StoredEntity>): Promise<void>;
  };

  requestChallenge(request: IPCRequest): void;

  getMessageById(messageId: string): Promise<MinimalMessage | undefined>;

  sendChallengeResponse(data: ChallengeData): Promise<void>;

  setChallengeStatus(challengeStatus: 'idle' | 'required' | 'pending'): void;

  onChallengeSolved(): void;
  onChallengeFailed(retryAfter?: number): void;

  expireAfter?: number;
};

export type StoredEntity = {
  readonly messageId: string;
  readonly createdAt: number;
};

type TrackedEntry = {
  readonly message: MinimalMessage;
  readonly createdAt: number;
};

const DEFAULT_EXPIRE_AFTER = 24 * 3600 * 1000; // one day
const MAX_RETRIES = 5;
const CAPTCHA_URL = 'https://signalcaptchas.org/challenge/generate.html';
const CAPTCHA_STAGING_URL =
  'https://signalcaptchas.org/staging/challenge/generate.html';

function shouldRetrySend(message: MinimalMessage): boolean {
  const error = message.getLastChallengeError();
  if (!error || error.retryAfter <= Date.now()) {
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
  private isLoaded = false;

  private challengeToken: string | undefined;

  private seq = 0;

  private isOnline = false;

  private readonly responseHandlers = new Map<number, Handler>();

  private readonly trackedMessages = new Map<string, TrackedEntry>();

  private readonly retryTimers = new Map<string, NodeJS.Timeout>();

  private readonly pendingRetries = new Set<MinimalMessage>();

  private readonly retryCountById = new Map<string, number>();

  constructor(private readonly options: Options) {}

  public async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    this.isLoaded = true;
    const stored: ReadonlyArray<StoredEntity> =
      this.options.storage.get('challenge:retry-message-ids') || [];

    window.log.info(`challenge: loading ${stored.length} messages`);

    const entityMap = new Map<string, StoredEntity>();
    for (const entity of stored) {
      entityMap.set(entity.messageId, entity);
    }

    const retryIds = new Set<string>(stored.map(({ messageId }) => messageId));

    const maybeMessages: ReadonlyArray<
      MinimalMessage | undefined
    > = await Promise.all(
      Array.from(retryIds).map(async messageId =>
        this.options.getMessageById(messageId)
      )
    );

    const messages: Array<MinimalMessage> = maybeMessages.filter(isNotNil);

    window.log.info(`challenge: loaded ${messages.length} messages`);

    await Promise.all(
      messages.map(async message => {
        const entity = entityMap.get(message.id);
        if (!entity) {
          window.log.error(
            'challenge: unexpected missing entity ' +
              `for ${message.idForLogging()}`
          );
          return;
        }

        const expireAfter = this.options.expireAfter || DEFAULT_EXPIRE_AFTER;
        if (isOlderThan(entity.createdAt, expireAfter)) {
          window.log.info(
            `challenge: expired entity for ${message.idForLogging()}`
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
        await this.register(message, RetryMode.NoImmediateRetry, entity);
      })
    );
  }

  public async onOffline(): Promise<void> {
    this.isOnline = false;

    window.log.info('challenge: offline');
  }

  public async onOnline(): Promise<void> {
    this.isOnline = true;

    const pending = Array.from(this.pendingRetries.values());
    this.pendingRetries.clear();

    window.log.info(`challenge: online, retrying ${pending.length} messages`);

    // Retry messages that matured while we were offline
    await Promise.all(pending.map(message => this.retryOne(message)));

    await this.retrySend();
  }

  public async register(
    message: MinimalMessage,
    retry = RetryMode.Retry,
    entity?: StoredEntity
  ): Promise<void> {
    if (this.isRegistered(message)) {
      window.log.info(
        `challenge: message already registered ${message.idForLogging()}`
      );
      return;
    }

    this.trackedMessages.set(message.id, {
      message,
      createdAt: entity ? entity.createdAt : Date.now(),
    });
    await this.persist();

    // Message is already retryable - initiate new send
    if (retry === RetryMode.Retry && shouldRetrySend(message)) {
      window.log.info(
        `challenge: sending message immediately ${message.idForLogging()}`
      );
      await this.retryOne(message);
      return;
    }

    const error = message.getLastChallengeError();
    if (!error) {
      window.log.error('Unexpected message without challenge error');
      return;
    }

    const waitTime = Math.max(0, error.retryAfter - Date.now());
    const oldTimer = this.retryTimers.get(message.id);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }
    this.retryTimers.set(
      message.id,
      setTimeout(() => {
        this.retryTimers.delete(message.id);

        this.retryOne(message);
      }, waitTime)
    );

    window.log.info(
      `challenge: tracking ${message.idForLogging()} ` +
        `with waitTime=${waitTime}`
    );

    if (!error.data.options || !error.data.options.includes('recaptcha')) {
      window.log.error(
        `challenge: unexpected options ${JSON.stringify(error.data.options)}`
      );
    }

    if (!error.data.token) {
      window.log.error(
        `challenge: no token in challenge error ${JSON.stringify(error.data)}`
      );
    } else if (message.isNormalBubble()) {
      // Display challenge dialog only for core messages
      // (e.g. text, attachment, embedded contact, or sticker)
      //
      // Note: not waiting on this call intentionally since it waits for
      // challenge to be fully completed.
      this.solve(error.data.token);
    } else {
      window.log.info(
        `challenge: not a bubble message ${message.idForLogging()}`
      );
    }
  }

  public onResponse(response: IPCResponse): void {
    const handler = this.responseHandlers.get(response.seq);
    if (!handler) {
      return;
    }

    this.responseHandlers.delete(response.seq);
    handler.resolve(response.data);
  }

  public async unregister(message: MinimalMessage): Promise<void> {
    window.log.info(`challenge: unregistered ${message.idForLogging()}`);
    this.trackedMessages.delete(message.id);
    this.pendingRetries.delete(message);

    const timer = this.retryTimers.get(message.id);
    this.retryTimers.delete(message.id);
    if (timer) {
      clearTimeout(timer);
    }

    await this.persist();
  }

  private async persist(): Promise<void> {
    assert(
      this.isLoaded,
      'ChallengeHandler has to be loaded before persisting new data'
    );
    await this.options.storage.put(
      'challenge:retry-message-ids',
      Array.from(this.trackedMessages.entries()).map(
        ([messageId, { createdAt }]) => {
          return { messageId, createdAt };
        }
      )
    );
  }

  private isRegistered(message: MinimalMessage): boolean {
    return this.trackedMessages.has(message.id);
  }

  private async retrySend(force = false): Promise<void> {
    window.log.info(`challenge: retrySend force=${force}`);

    const retries = Array.from(this.trackedMessages.values())
      .map(({ message }) => message)
      // Sort messages in `sent_at` order
      .sort((a, b) => a.get('sent_at') - b.get('sent_at'))
      .filter(message => force || shouldRetrySend(message))
      .map(message => this.retryOne(message));

    await Promise.all(retries);
  }

  private async retryOne(message: MinimalMessage): Promise<void> {
    // Send is already pending
    if (!this.isRegistered(message)) {
      return;
    }

    // We are not online
    if (!this.isOnline) {
      this.pendingRetries.add(message);
      return;
    }

    const retryCount = this.retryCountById.get(message.id) || 0;
    window.log.info(
      `challenge: retrying sending ${message.idForLogging()}, ` +
        `retry count: ${retryCount}`
    );

    if (retryCount === MAX_RETRIES) {
      window.log.info(
        `challenge: dropping message ${message.idForLogging()}, ` +
          'too many failed retries'
      );

      // Keep the message registered so that we'll retry sending it on app
      // restart.
      return;
    }

    await this.unregister(message);

    let sent = false;
    const onSent = () => {
      sent = true;
    };
    message.on('sent', onSent);

    try {
      await message.retrySend();
    } catch (error) {
      window.log.error(
        `challenge: failed to send ${message.idForLogging()} due to ` +
          `error: ${error && error.stack}`
      );
    } finally {
      message.off('sent', onSent);
    }

    if (sent) {
      window.log.info(`challenge: message ${message.idForLogging()} sent`);
      this.retryCountById.delete(message.id);
      if (this.trackedMessages.size === 0) {
        this.options.setChallengeStatus('idle');
      }
    } else {
      window.log.info(`challenge: message ${message.idForLogging()} not sent`);

      this.retryCountById.set(message.id, retryCount + 1);
      await this.register(message, RetryMode.NoImmediateRetry);
    }
  }

  private async solve(token: string): Promise<void> {
    const request: IPCRequest = { seq: this.seq };
    this.seq += 1;

    this.options.setChallengeStatus('required');
    this.options.requestChallenge(request);

    this.challengeToken = token || '';
    const response = await new Promise<ChallengeResponse>((resolve, reject) => {
      this.responseHandlers.set(request.seq, { token, resolve, reject });
    });

    // Another `.solve()` has completed earlier than us
    if (this.challengeToken === undefined) {
      return;
    }

    const lastToken = this.challengeToken;
    this.challengeToken = undefined;

    this.options.setChallengeStatus('pending');

    window.log.info('challenge: sending challenge to server');

    try {
      await this.sendChallengeResponse({
        type: 'recaptcha',
        token: lastToken,
        captcha: response.captcha,
      });
    } catch (error) {
      window.log.error(
        `challenge: challenge failure, error: ${error && error.stack}`
      );
      this.options.setChallengeStatus('required');
      return;
    }

    window.log.info('challenge: challenge success. force sending');

    this.options.setChallengeStatus('idle');

    this.retrySend(true);
  }

  private async sendChallengeResponse(data: ChallengeData): Promise<void> {
    try {
      await this.options.sendChallengeResponse(data);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.name !== 'HTTPError' ||
        error.code !== 413 ||
        !error.responseHeaders
      ) {
        this.options.onChallengeFailed();
        throw error;
      }

      const retryAfter = parseRetryAfter(
        error.responseHeaders['retry-after'].toString()
      );

      window.log.info(`challenge: retry after ${retryAfter}ms`);
      this.options.onChallengeFailed(retryAfter);
      return;
    }

    this.options.onChallengeSolved();
  }
}
