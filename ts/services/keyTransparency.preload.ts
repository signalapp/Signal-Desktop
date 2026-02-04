// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  ErrorCode,
  LibSignalErrorBase,
  PublicKey,
  usernames,
} from '@signalapp/libsignal-client';
import type {
  Request,
  E164Info,
} from '@signalapp/libsignal-client/dist/net/KeyTransparency.js';
import { MonitorMode } from '@signalapp/libsignal-client/dist/net/KeyTransparency.js';
import pTimeout from 'p-timeout';

import {
  keyTransparencySearch,
  keyTransparencyMonitor,
} from '../textsecure/WebAPI.preload.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { fromAciObject } from '../types/ServiceId.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { toAciObject } from '../util/ServiceId.node.js';
import { TaskDeduplicator } from '../util/TaskDeduplicator.std.js';
import { BackOff, FIBONACCI_TIMEOUTS } from '../util/BackOff.std.js';
import { sleep } from '../util/sleep.std.js';
import { SECOND, MINUTE, DAY, WEEK } from '../util/durations/constants.std.js';
import { CheckScheduler } from '../util/CheckScheduler.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { isFeaturedEnabledNoRedux } from '../util/isFeatureEnabled.dom.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability.std.js';
import * as Bytes from '../Bytes.std.js';
import { createLogger } from '../logging/log.std.js';
import { isEnabled } from '../RemoteConfig.dom.js';
import { DataWriter } from '../sql/Client.preload.js';
import { runStorageServiceSyncJob } from './storage.preload.js';

const log = createLogger('KeyTransparency');

// Longer timeouts because request size is large (5 second minimum)
const KEY_TRANSPARENCY_TIMEOUTS = FIBONACCI_TIMEOUTS.slice(3);

const KNOWN_IDENTIFIER_CHANGE_DELAY = 5 * MINUTE;

const INTERMITTENT_ERROR_RETRY_DELAY = 1 * DAY;

const STORAGE_SERVICE_TIMEOUT = 1 * MINUTE;

export function isKeyTransparencyAvailable(): boolean {
  if (itemStorage.get('hasKeyTransparencyDisabled')) {
    return false;
  }
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.keyTransparency.beta',
    prodKey: 'desktop.keyTransparency.prod',
  });
}

export class KeyTransparency {
  #isRunning = false;
  #scheduler = new CheckScheduler({
    name: 'KeyTransparency',
    interval: WEEK,
    storageKey: 'lastKeyTransparencySelfCheck',
    backOffTimeouts: KEY_TRANSPARENCY_TIMEOUTS,

    callback: async () => {
      try {
        await this.selfCheck();
      } catch {
        // Ignore exceptions
      }
    },
  });

  #selfCheckDedup = new TaskDeduplicator(
    'KeyTransparency.selfCheck',
    abortSignal => this.#selfCheck(abortSignal)
  );

  public async disable(): Promise<void> {
    await Promise.all([
      DataWriter.removeAllKTAccountData(),
      itemStorage.remove('lastDistinguishedTreeHead'),
      itemStorage.remove('keyTransparencySelfHealth'),
      itemStorage.remove('lastKeyTransparencySelfCheck'),
    ]);
  }

  public start(): void {
    strictAssert(!this.#isRunning, 'Already running');

    this.#isRunning = true;
    this.#scheduler.start();
  }

  public async onKnownIdentifierChange(): Promise<void> {
    await this.#scheduler.delayBy(KNOWN_IDENTIFIER_CHANGE_DELAY);
  }

  public async onRegistrationDone(): Promise<void> {
    await this.#scheduler.runAt(Date.now() + KNOWN_IDENTIFIER_CHANGE_DELAY);
  }

  public async check(
    conversationId: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    if (!isKeyTransparencyAvailable()) {
      log.warn('not running, feature disabled');
      throw new Error('Not available');
    }

    const convo = window.ConversationController.get(conversationId);
    strictAssert(convo != null, `Conversation ${conversationId} not found`);

    const aci = convo.getAci();
    strictAssert(aci != null, `Conversation ${conversationId} has no ACI`);

    const identityKey = await signalProtocolStore.loadIdentityKey(aci);
    strictAssert(
      identityKey != null,
      `Conversation ${conversationId} has no identity key`
    );

    if (abortSignal?.aborted) {
      throw new Error('Aborted');
    }

    let e164Info: E164Info | undefined;

    convo.deriveAccessKeyIfNeeded();
    const e164 = convo.get('e164');
    const accessKey = convo.get('accessKey');
    if (e164 != null && accessKey != null) {
      e164Info = {
        e164,
        unidentifiedAccessKey: Bytes.fromBase64(accessKey),
      };
    }

    await this.#verify(
      {
        aciInfo: {
          aci: toAciObject(aci),
          identityKey: PublicKey.deserialize(identityKey),
        },
        e164Info,
      },
      abortSignal
    );

    if (abortSignal?.aborted) {
      throw new Error('Aborted');
    }

    const selfHealth = itemStorage.get('keyTransparencySelfHealth');
    if (selfHealth == null) {
      await this.selfCheck(abortSignal);
    } else {
      strictAssert(selfHealth === 'ok', 'Self KT check failed');
    }

    if (abortSignal?.aborted) {
      throw new Error('Aborted');
    }
  }

  async selfCheck(abortSignal?: AbortSignal): Promise<void> {
    return this.#selfCheckDedup.run(abortSignal);
  }

  async #selfCheck(abortSignal: AbortSignal): Promise<void> {
    if (!isKeyTransparencyAvailable()) {
      log.info('not running, feature disabled');
      return;
    }

    const ourAci = itemStorage.user.getAci();
    if (ourAci == null) {
      log.info('not running, no aci');
      return;
    }

    const keyPair = signalProtocolStore.getIdentityKeyPair(ourAci);
    if (keyPair == null) {
      log.error('not running, no identity key pair');
      return;
    }

    log.info('running self check');

    const me = window.ConversationController.getOurConversationOrThrow();

    let e164Info: E164Info | undefined;
    if (
      itemStorage.get('phoneNumberDiscoverability') ===
      PhoneNumberDiscoverability.Discoverable
    ) {
      const ourE164 = itemStorage.user.getNumber();
      strictAssert(ourE164 != null, 'missing our e164');

      me.deriveAccessKeyIfNeeded();
      const ourAccessKey = me.get('accessKey');
      strictAssert(ourAccessKey != null, 'missing our access key');

      e164Info = {
        e164: ourE164,
        unidentifiedAccessKey: Bytes.fromBase64(ourAccessKey),
      };
    }

    let usernameHash: Uint8Array | undefined;

    const username = me.get('username');
    if (username != null && !itemStorage.get('usernameCorrupted')) {
      usernameHash = usernames.hash(username);
    }

    if (itemStorage.get('keyTransparencySelfHealth') === 'intermittent') {
      runStorageServiceSyncJob({ reason: 'keyTransparency' });

      const { promise: once, resolve } = explodePromise<void>();

      // This makes sure that we are both on empty websocket queue and fully
      // up-to-date on storage service.
      window.Whisper.events.once('storageService:syncComplete', () =>
        resolve()
      );

      await pTimeout(once, STORAGE_SERVICE_TIMEOUT);
    }

    try {
      await this.#verify(
        {
          aciInfo: {
            aci: toAciObject(ourAci),
            identityKey: keyPair.publicKey,
          },
          e164Info,
          usernameHash,
        },
        abortSignal
      );

      if (abortSignal?.aborted) {
        throw new Error('Aborted');
      }

      await itemStorage.put('keyTransparencySelfHealth', 'ok');
      log.info('self check success');
    } catch (error) {
      if (abortSignal?.aborted) {
        throw new Error('Aborted');
      }

      const oldResult = itemStorage.get('keyTransparencySelfHealth');
      let newResult: 'fail' | 'intermittent' | undefined;

      if (error instanceof LibSignalErrorBase) {
        if (error.is(ErrorCode.KeyTransparencyVerificationFailed)) {
          if (oldResult === 'intermittent' || oldResult === 'fail') {
            newResult = 'fail';
          } else {
            newResult = 'intermittent';
          }
        } else if (
          error.is(ErrorCode.KeyTransparencyError) ||
          error.is(ErrorCode.ChatServiceInactive) ||
          error.is(ErrorCode.IoError) ||
          error.is(ErrorCode.RateLimitedError)
        ) {
          if (oldResult === 'intermittent' || oldResult === 'fail') {
            // Keep failed state until successful retry
            newResult = oldResult;
          } else {
            // Update status to "unknown"
            newResult = undefined;
          }
        } else {
          // Unknown error
          newResult = 'fail';
        }
      }

      log.warn(
        'failed to check our own records',
        toLogFormat(error),
        'changing state to',
        newResult
      );

      await itemStorage.put('keyTransparencySelfHealth', newResult);
      if (
        (oldResult !== 'fail' || isEnabled('desktop.internalUser')) &&
        newResult === 'fail'
      ) {
        window.reduxActions.globalModals.showKeyTransparencyErrorDialog();
      }

      if (newResult === 'intermittent') {
        await this.#scheduler.runAt(
          Date.now() + INTERMITTENT_ERROR_RETRY_DELAY
        );
      }

      throw error;
    }
  }

  async #verify(
    request: Request,
    abortSignal?: AbortSignal,
    backOff = new BackOff(KEY_TRANSPARENCY_TIMEOUTS)
  ): Promise<void> {
    try {
      const existing = await signalProtocolStore.getKTAccountData(
        request.aciInfo.aci
      );
      if (abortSignal?.aborted) {
        throw new Error('Aborted');
      }
      const aciString = fromAciObject(request.aciInfo.aci);
      if (existing == null) {
        log.info('search', aciString);
        await keyTransparencySearch(request, abortSignal);
      } else {
        const mode = itemStorage.user.isOurServiceId(aciString)
          ? MonitorMode.Self
          : MonitorMode.Other;
        log.info('monitor', aciString);
        await keyTransparencyMonitor(request, mode, abortSignal);
      }
    } catch (error) {
      if (abortSignal?.aborted) {
        throw new Error('Aborted');
      }

      if (backOff.isFull() || !(error instanceof LibSignalErrorBase)) {
        throw error;
      }

      let timeout = backOff.getAndIncrement();

      if (
        error.is(ErrorCode.ChatServiceInactive) ||
        error.is(ErrorCode.IoError)
      ) {
        // Use default timeout
      } else if (error.is(ErrorCode.RateLimitedError)) {
        timeout = error.retryAfterSecs * SECOND;
      } else {
        // KeyTransparencyError, KeyTransparencyVerificationFailed, etc
        throw error;
      }

      log.warn(
        `retriable error error=${toLogFormat(error)} retrying in ` +
          `${timeout}ms`
      );
      await sleep(timeout, abortSignal);

      if (abortSignal?.aborted) {
        throw new Error('Aborted');
      }

      return this.#verify(request, abortSignal, backOff);
    }
  }
}

export const keyTransparency = new KeyTransparency();
