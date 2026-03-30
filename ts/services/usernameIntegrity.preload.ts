// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pTimeout from 'p-timeout';
import { usernames } from '@signalapp/libsignal-client';

import { whoami } from '../textsecure/WebAPI.preload.ts';
import { isDone as isRegistrationDone } from '../util/registration.preload.ts';
import { getConversation } from '../util/getConversation.preload.ts';
import { MINUTE, DAY } from '../util/durations/index.std.ts';
import { drop } from '../util/drop.std.ts';
import { explodePromise } from '../util/explodePromise.std.ts';
import { storageJobQueue } from '../util/JobQueue.std.ts';
import { getProfile } from '../util/getProfile.preload.ts';
import { isSharingPhoneNumberWithEverybody } from '../util/phoneNumberSharingMode.preload.ts';
import { bytesToUuid } from '../util/uuidToBytes.std.ts';
import { CheckScheduler } from '../util/CheckScheduler.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import * as Bytes from '../Bytes.std.ts';
import { runStorageServiceSyncJob } from './storage.preload.ts';
import { writeProfile } from './writeProfile.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

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
