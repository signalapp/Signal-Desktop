// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pTimeout from 'p-timeout';
import { usernames } from '@signalapp/libsignal-client';

import { whoami } from '../textsecure/WebAPI.preload.js';
import { isDone as isRegistrationDone } from '../util/registration.preload.js';
import { getConversation } from '../util/getConversation.preload.js';
import { MINUTE, DAY } from '../util/durations/index.std.js';
import { drop } from '../util/drop.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { storageJobQueue } from '../util/JobQueue.std.js';
import { getProfile } from '../util/getProfile.preload.js';
import { isSharingPhoneNumberWithEverybody } from '../util/phoneNumberSharingMode.preload.js';
import { bytesToUuid } from '../util/uuidToBytes.std.js';
import { CheckScheduler } from '../util/CheckScheduler.preload.js';
import { createLogger } from '../logging/log.std.js';
import * as Bytes from '../Bytes.std.js';
import { runStorageServiceSyncJob } from './storage.preload.js';
import { writeProfile } from './writeProfile.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('usernameIntegrity');

const STORAGE_SERVICE_TIMEOUT = 30 * MINUTE;

class UsernameIntegrityService {
  #isStarted = false;
  #scheduler = new CheckScheduler({
    name: 'UsernameIntegrityService',
    interval: DAY,
    storageKey: 'usernameLastIntegrityCheck',
    callback: async () => {
      await storageJobQueue(() => this.#check());
    },
  });

  async start(): Promise<void> {
    if (this.#isStarted) {
      return;
    }

    this.#isStarted = true;

    this.#scheduler.start();
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
      log.info('no username');
      return;
    }

    const { usernameHash: remoteHash, usernameLinkHandle: remoteLink } =
      await whoami();

    let failed = false;

    if (remoteHash !== Bytes.toBase64url(usernames.hash(username))) {
      log.error('remote username mismatch');
      await itemStorage.put('usernameCorrupted', true);
      failed = true;

      // Intentional fall-through
    }

    const link = itemStorage.get('usernameLink');
    if (!link) {
      log.info('no username link');
      return;
    }

    if (remoteLink !== bytesToUuid(link.serverId)) {
      log.error('username link mismatch');
      await itemStorage.put('usernameLinkCorrupted', true);
      failed = true;
    }

    if (!failed) {
      log.info('check pass');
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
        'phone number sharing mode conflict, running ' +
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
          'phone number sharing mode conflict resolved by ' +
            'storage service sync'
        );
        return;
      }
    }

    log.warn(
      'phone number sharing mode conflict not resolved, updating profile'
    );

    await writeProfile(getConversation(me), {
      keepAvatar: true,
    });

    log.warn('updated profile');
  }
}

export const usernameIntegrity = new UsernameIntegrityService();
