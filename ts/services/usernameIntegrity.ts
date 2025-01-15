// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pTimeout from 'p-timeout';
import { usernames } from '@signalapp/libsignal-client';

import * as Errors from '../types/errors';
import { strictAssert } from '../util/assert';
import { isDone as isRegistrationDone } from '../util/registration';
import { getConversation } from '../util/getConversation';
import { MINUTE, DAY } from '../util/durations';
import { drop } from '../util/drop';
import { explodePromise } from '../util/explodePromise';
import { BackOff, FIBONACCI_TIMEOUTS } from '../util/BackOff';
import { storageJobQueue } from '../util/JobQueue';
import { getProfile } from '../util/getProfile';
import { isSharingPhoneNumberWithEverybody } from '../util/phoneNumberSharingMode';
import { bytesToUuid } from '../util/uuidToBytes';
import * as log from '../logging/log';
import { runStorageServiceSyncJob } from './storage';
import { writeProfile } from './writeProfile';

const CHECK_INTERVAL = DAY;

const STORAGE_SERVICE_TIMEOUT = 30 * MINUTE;

class UsernameIntegrityService {
  #isStarted = false;
  readonly #backOff = new BackOff(FIBONACCI_TIMEOUTS);

  async start(): Promise<void> {
    if (this.#isStarted) {
      return;
    }

    this.#isStarted = true;

    this.#scheduleCheck();
  }

  #scheduleCheck(): void {
    const lastCheckTimestamp = window.storage.get(
      'usernameLastIntegrityCheck',
      0
    );
    const delay = Math.max(0, lastCheckTimestamp + CHECK_INTERVAL - Date.now());
    if (delay === 0) {
      log.info('usernameIntegrity: running the check immediately');
      drop(this.#safeCheck());
    } else {
      log.info(`usernameIntegrity: running the check in ${delay}ms`);
      setTimeout(() => drop(this.#safeCheck()), delay);
    }
  }

  async #safeCheck(): Promise<void> {
    try {
      await storageJobQueue(() => this.#check());
      this.#backOff.reset();
      await window.storage.put('usernameLastIntegrityCheck', Date.now());

      this.#scheduleCheck();
    } catch (error) {
      const delay = this.#backOff.getAndIncrement();
      log.error(
        'usernameIntegrity: check failed with ' +
          `error: ${Errors.toLogFormat(error)} retrying in ${delay}ms`
      );
      setTimeout(() => drop(this.#safeCheck()), delay);
    }
  }

  async #check(): Promise<void> {
    if (!isRegistrationDone()) {
      return;
    }

    await this.#checkUsername();
    await this.#checkPhoneNumberSharing();
  }

  async #checkUsername(): Promise<void> {
    const me = window.ConversationController.getOurConversationOrThrow();
    const username = me.get('username');
    if (!username) {
      log.info('usernameIntegrity: no username');
      return;
    }

    const { server } = window.textsecure;
    if (!server) {
      log.info('usernameIntegrity: server interface is not available');
      return;
    }

    strictAssert(window.textsecure.server, 'WebAPI must be available');
    const { usernameHash: remoteHash, usernameLinkHandle: remoteLink } =
      await server.whoami();

    let failed = false;

    if (remoteHash !== usernames.hash(username).toString('base64url')) {
      log.error('usernameIntegrity: remote username mismatch');
      await window.storage.put('usernameCorrupted', true);
      failed = true;

      // Intentional fall-through
    }

    const link = window.storage.get('usernameLink');
    if (!link) {
      log.info('usernameIntegrity: no username link');
      return;
    }

    if (remoteLink !== bytesToUuid(link.serverId)) {
      log.error('usernameIntegrity: username link mismatch');
      await window.storage.put('usernameLinkCorrupted', true);
      failed = true;
    }

    if (!failed) {
      log.info('usernameIntegrity: check pass');
    }
  }

  async #checkPhoneNumberSharing(): Promise<void> {
    const me = window.ConversationController.getOurConversationOrThrow();

    await getProfile({
      serviceId: me.getServiceId() ?? null,
      e164: me.get('e164') ?? null,
      groupId: null,
    });

    {
      const localValue = isSharingPhoneNumberWithEverybody();
      const remoteValue = me.get('sharingPhoneNumber') === true;
      if (localValue === remoteValue) {
        return;
      }

      log.warn(
        'usernameIntegrity: phone number sharing mode conflict, running ' +
          `storage service sync (local: ${localValue}, remote: ${remoteValue})`
      );

      runStorageServiceSyncJob({ reason: 'checkPhoneNumberSharing' });
    }

    // Since we already run on storage service job queue - don't await the
    // promise below (otherwise deadlock will happen).
    drop(this.#fixProfile());
  }

  async #fixProfile(): Promise<void> {
    const { promise: once, resolve } = explodePromise<void>();

    window.Whisper.events.once('storageService:syncComplete', () => resolve());

    await pTimeout(once, STORAGE_SERVICE_TIMEOUT);

    const me = window.ConversationController.getOurConversationOrThrow();

    {
      const localValue = isSharingPhoneNumberWithEverybody();
      const remoteValue = me.get('sharingPhoneNumber') === true;
      if (localValue === remoteValue) {
        log.info(
          'usernameIntegrity: phone number sharing mode conflict resolved by ' +
            'storage service sync'
        );
        return;
      }
    }

    log.warn(
      'usernameIntegrity: phone number sharing mode conflict not resolved, ' +
        'updating profile'
    );

    await writeProfile(getConversation(me), {
      keepAvatar: true,
    });

    log.warn('usernameIntegrity: updated profile');
  }
}

export const usernameIntegrity = new UsernameIntegrityService();
