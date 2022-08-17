// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ProfileKeyCredentialRequestContext,
  ClientZkProfileOperations,
} from '@signalapp/libsignal-client/zkgroup';
import PQueue from 'p-queue';

import type { ConversationModel } from '../models/conversations';
import type {
  GetProfileOptionsType,
  GetProfileUnauthOptionsType,
} from '../textsecure/WebAPI';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import * as Bytes from '../Bytes';
import { explodePromise } from '../util/explodePromise';
import { isRecord } from '../util/isRecord';
import { sleep } from '../util/sleep';
import { MINUTE, SECOND } from '../util/durations';
import {
  generateProfileKeyCredentialRequest,
  generatePNICredentialRequest,
  getClientZkProfileOperations,
  handleProfileKeyCredential,
  handleProfileKeyPNICredential,
} from '../util/zkgroup';
import { isMe } from '../util/whatTypeOfConversation';
import { getUserLanguages } from '../util/userLanguages';
import { parseBadgesFromServer } from '../badges/parseBadgesFromServer';
import { strictAssert } from '../util/assert';
import { findRetryAfterTimeFromError } from '../jobs/helpers/findRetryAfterTimeFromError';
import { SEALED_SENDER } from '../types/SealedSender';
import { HTTPError } from '../textsecure/Errors';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { UUIDKind } from '../types/UUID';
import { trimForDisplay, verifyAccessKey, decryptProfile } from '../Crypto';

type JobType = {
  resolve: () => void;
  reject: (error: Error) => void;
  promise: Promise<void>;
  startTime: number;
};

// Goals for this service:
//   1. Ensure that when we get a 413 from the server, we stop firing off profile
//      fetches for a while.
//   2. Ensure that all existing profile fetches don't hang in this case; to solve this we
//      cancel all outstanding requests when we hit a 413, and throw instead of queueing
//      something new if we're waiting due to a retry-after. Note: It's no worse than what
//      we were doing before, failing all requests and pushing the retry-after time out
//      further.
//   3. Require no changes to callers.

// Potential future goals for this problem area:
//   - Update all getProfiles() callers; make them resilient to longer delays
//   - Keep track of last profile fetch per conversation, reduce unnecessary re-fetches
//   - Enforce a maximum profile fetch frequency
//   - Don't even attempt jobs when offline

export class ProfileService {
  private jobQueue: PQueue;

  private jobsByConversationId: Map<string, JobType> = new Map();

  private isPaused = false;

  constructor(private fetchProfile = doGetProfile) {
    this.jobQueue = new PQueue({ concurrency: 3, timeout: MINUTE * 2 });
    this.jobsByConversationId = new Map();

    log.info('Profile Service initialized');
  }

  public async get(conversationId: string): Promise<void> {
    const preCheckConversation =
      window.ConversationController.get(conversationId);
    if (!preCheckConversation) {
      throw new Error(
        `ProfileServices.get: Pre-check conversation ${conversationId} not found`
      );
    }

    if (this.isPaused) {
      throw new Error(
        `ProfileService.get: Cannot add job to paused queue for conversation ${preCheckConversation.idForLogging()}`
      );
    }

    const existing = this.jobsByConversationId.get(conversationId);
    if (existing) {
      return existing.promise;
    }

    const { resolve, reject, promise } = explodePromise<void>();
    const jobData = {
      promise,
      resolve,
      reject,
      startTime: Date.now(),
    };

    const job = async () => {
      const conversation = window.ConversationController.get(conversationId);
      if (!conversation) {
        throw new Error(
          `ProfileServices.get: Conversation ${conversationId} not found`
        );
      }

      try {
        await this.fetchProfile(conversation);
        resolve();
      } catch (error) {
        reject(error);

        if (this.isPaused) {
          return;
        }

        if (isRecord(error) && 'code' in error && error.code === 413) {
          this.clearAll('got 413 from server');
          const time = findRetryAfterTimeFromError(error);
          this.pause(time);
        }
      } finally {
        this.jobsByConversationId.delete(conversationId);

        const now = Date.now();
        const delta = now - jobData.startTime;
        if (delta > 30 * SECOND) {
          log.warn(
            `ProfileServices.get: Job for ${conversation.idForLogging()} finished ${delta}ms after queue`
          );
        }
      }
    };

    this.jobsByConversationId.set(conversationId, jobData);
    this.jobQueue.add(job);

    return promise;
  }

  public clearAll(reason: string): void {
    if (this.isPaused) {
      log.warn(
        `ProfileService.clearAll: Already paused; not clearing; reason: '${reason}'`
      );
      return;
    }

    log.info(`ProfileService.clearAll: Clearing; reason: '${reason}'`);

    try {
      this.isPaused = true;
      this.jobQueue.pause();

      this.jobsByConversationId.forEach(job => {
        job.reject(
          new Error(
            `ProfileService.clearAll: job cancelled because '${reason}'`
          )
        );
      });

      this.jobsByConversationId.clear();
      this.jobQueue.clear();

      this.jobQueue.start();
    } finally {
      this.isPaused = false;
      log.info('ProfileService.clearAll: Done clearing');
    }
  }

  public async pause(timeInMS: number): Promise<void> {
    if (this.isPaused) {
      log.warn('ProfileService.pause: Already paused, not pausing again.');
      return;
    }

    log.info(`ProfileService.pause: Pausing queue for ${timeInMS}ms`);

    this.isPaused = true;
    this.jobQueue.pause();

    try {
      await sleep(timeInMS);
    } finally {
      log.info('ProfileService.pause: Restarting queue');
      this.jobQueue.start();
      this.isPaused = false;
    }
  }
}

export const profileService = new ProfileService();

async function doGetProfile(c: ConversationModel): Promise<void> {
  const idForLogging = c.idForLogging();
  const { messaging } = window.textsecure;
  strictAssert(
    messaging,
    'getProfile: window.textsecure.messaging not available'
  );

  const { updatesUrl } = window.SignalContext.config;
  strictAssert(
    typeof updatesUrl === 'string',
    'getProfile: expected updatesUrl to be a defined string'
  );

  const clientZkProfileCipher = getClientZkProfileOperations(
    window.getServerPublicParams()
  );

  const userLanguages = getUserLanguages(
    navigator.languages,
    window.getLocale()
  );

  let profile;

  c.deriveAccessKeyIfNeeded();

  const profileKey = c.get('profileKey');
  const profileKeyVersion = c.deriveProfileKeyVersion();
  const uuid = c.getCheckedUuid('getProfile');
  const lastProfile = c.get('lastProfile');

  let profileCredentialRequestContext:
    | undefined
    | ProfileKeyCredentialRequestContext;

  let getProfileOptions: GetProfileOptionsType | GetProfileUnauthOptionsType;

  let accessKey = c.get('accessKey');
  if (profileKey) {
    strictAssert(
      profileKeyVersion && accessKey,
      'profileKeyVersion and accessKey are derived from profileKey'
    );

    if (!c.hasProfileKeyCredentialExpired()) {
      getProfileOptions = {
        accessKey,
        profileKeyVersion,
        userLanguages,
      };
    } else {
      log.info(
        'getProfile: generating profile key credential request for ' +
          `conversation ${idForLogging}`
      );

      let profileKeyCredentialRequestHex: undefined | string;
      ({
        requestHex: profileKeyCredentialRequestHex,
        context: profileCredentialRequestContext,
      } = generateProfileKeyCredentialRequest(
        clientZkProfileCipher,
        uuid.toString(),
        profileKey
      ));

      getProfileOptions = {
        accessKey,
        userLanguages,
        profileKeyVersion,
        profileKeyCredentialRequest: profileKeyCredentialRequestHex,
      };
    }
  } else {
    strictAssert(
      !accessKey,
      'accessKey have to be absent because there is no profileKey'
    );

    if (lastProfile?.profileKeyVersion) {
      getProfileOptions = {
        userLanguages,
        profileKeyVersion: lastProfile.profileKeyVersion,
      };
    } else {
      getProfileOptions = { userLanguages };
    }
  }

  const isVersioned = Boolean(getProfileOptions.profileKeyVersion);
  log.info(
    `getProfile: getting ${isVersioned ? 'versioned' : 'unversioned'} ` +
      `profile for conversation ${idForLogging}`
  );

  try {
    if (getProfileOptions.accessKey) {
      try {
        profile = await messaging.getProfile(uuid, getProfileOptions);
      } catch (error) {
        if (!(error instanceof HTTPError)) {
          throw error;
        }
        if (error.code === 401 || error.code === 403) {
          if (isMe(c.attributes)) {
            throw error;
          }

          await c.setProfileKey(undefined);

          // Retry fetch using last known profileKeyVersion or fetch
          // unversioned profile.
          return doGetProfile(c);
        }

        if (error.code === 404) {
          await c.removeLastProfile(lastProfile);
        }

        throw error;
      }
    } else {
      try {
        // We won't get the credential, but lets either fetch:
        // - a versioned profile using last known profileKeyVersion
        // - some basic profile information (capabilities, badges, etc).
        profile = await messaging.getProfile(uuid, getProfileOptions);
      } catch (error) {
        if (error instanceof HTTPError && error.code === 404) {
          log.info(`getProfile: failed to find a profile for ${idForLogging}`);

          await c.removeLastProfile(lastProfile);
          if (!isVersioned) {
            log.info(`getProfile: marking ${idForLogging} as unregistered`);
            c.setUnregistered();
          }
        }
        throw error;
      }
    }

    if (isMe(c.attributes) && profileKey && profileKeyVersion) {
      try {
        await maybeGetPNICredential(c, {
          clientZkProfileCipher,
          profileKey,
          profileKeyVersion,
          userLanguages,
        });
      } catch (error) {
        log.warn(
          'getProfile failed to get our own PNI credential',
          Errors.toLogFormat(error)
        );
      }
    }

    if (profile.identityKey) {
      const identityKey = Bytes.fromBase64(profile.identityKey);
      const changed = await window.textsecure.storage.protocol.saveIdentity(
        new Address(uuid, 1),
        identityKey,
        false
      );
      if (changed) {
        // save identity will close all sessions except for .1, so we
        // must close that one manually.
        const ourUuid = window.textsecure.storage.user.getCheckedUuid();
        await window.textsecure.storage.protocol.archiveSession(
          new QualifiedAddress(ourUuid, new Address(uuid, 1))
        );
      }
    }

    // Update accessKey to prevent race conditions. Since we run asynchronous
    // requests above - it is possible that someone updates or erases
    // the profile key from under us.
    accessKey = c.get('accessKey');

    if (profile.unrestrictedUnidentifiedAccess && profile.unidentifiedAccess) {
      log.info(
        `getProfile: setting sealedSender to UNRESTRICTED for conversation ${idForLogging}`
      );
      c.set({
        sealedSender: SEALED_SENDER.UNRESTRICTED,
      });
    } else if (accessKey && profile.unidentifiedAccess) {
      const haveCorrectKey = verifyAccessKey(
        Bytes.fromBase64(accessKey),
        Bytes.fromBase64(profile.unidentifiedAccess)
      );

      if (haveCorrectKey) {
        log.info(
          `getProfile: setting sealedSender to ENABLED for conversation ${idForLogging}`
        );
        c.set({
          sealedSender: SEALED_SENDER.ENABLED,
        });
      } else {
        log.warn(
          `getProfile: setting sealedSender to DISABLED for conversation ${idForLogging}`
        );
        c.set({
          sealedSender: SEALED_SENDER.DISABLED,
        });
      }
    } else {
      log.info(
        `getProfile: setting sealedSender to DISABLED for conversation ${idForLogging}`
      );
      c.set({
        sealedSender: SEALED_SENDER.DISABLED,
      });
    }

    const rawDecryptionKey = c.get('profileKey') || lastProfile?.profileKey;
    const decryptionKey = rawDecryptionKey
      ? Bytes.fromBase64(rawDecryptionKey)
      : undefined;
    if (profile.about) {
      if (decryptionKey) {
        const decrypted = decryptProfile(
          Bytes.fromBase64(profile.about),
          decryptionKey
        );
        c.set('about', Bytes.toString(trimForDisplay(decrypted)));
      }
    } else {
      c.unset('about');
    }

    if (profile.aboutEmoji) {
      if (decryptionKey) {
        const decrypted = decryptProfile(
          Bytes.fromBase64(profile.aboutEmoji),
          decryptionKey
        );
        c.set('aboutEmoji', Bytes.toString(trimForDisplay(decrypted)));
      }
    } else {
      c.unset('aboutEmoji');
    }

    if (profile.paymentAddress && isMe(c.attributes)) {
      window.storage.put('paymentAddress', profile.paymentAddress);
    }

    if (profile.capabilities) {
      c.set({ capabilities: profile.capabilities });
    } else {
      c.unset('capabilities');
    }

    const badges = parseBadgesFromServer(profile.badges, updatesUrl);
    if (badges.length) {
      await window.reduxActions.badges.updateOrCreate(badges);
      c.set({
        badges: badges.map(badge => ({
          id: badge.id,
          ...('expiresAt' in badge
            ? {
                expiresAt: badge.expiresAt,
                isVisible: badge.isVisible,
              }
            : {}),
        })),
      });
    } else {
      c.unset('badges');
    }

    if (profileCredentialRequestContext) {
      if (profile.credential) {
        const {
          credential: profileKeyCredential,
          expiration: profileKeyCredentialExpiration,
        } = handleProfileKeyCredential(
          clientZkProfileCipher,
          profileCredentialRequestContext,
          profile.credential
        );
        c.set({ profileKeyCredential, profileKeyCredentialExpiration });
      } else {
        log.warn(
          'getProfile: Included credential request, but got no credential. Clearing profileKeyCredential.'
        );
        c.unset('profileKeyCredential');
      }
    }
  } catch (error) {
    if (!(error instanceof HTTPError)) {
      throw error;
    }

    switch (error.code) {
      case 401:
      case 403:
        if (
          c.get('sealedSender') === SEALED_SENDER.ENABLED ||
          c.get('sealedSender') === SEALED_SENDER.UNRESTRICTED
        ) {
          log.warn(
            `getProfile: Got 401/403 when using accessKey for ${idForLogging}, removing profileKey`
          );
          if (!isMe(c.attributes)) {
            await c.setProfileKey(undefined);
          }
        }
        if (c.get('sealedSender') === SEALED_SENDER.UNKNOWN) {
          log.warn(
            `getProfile: Got 401/403 when using accessKey for ${idForLogging}, setting sealedSender = DISABLED`
          );
          c.set('sealedSender', SEALED_SENDER.DISABLED);
        }
        return;
      default:
        log.warn(
          'getProfile failure:',
          idForLogging,
          Errors.toLogFormat(error)
        );
        return;
    }
  }

  const decryptionKeyString = profileKey || lastProfile?.profileKey;
  const decryptionKey = decryptionKeyString
    ? Bytes.fromBase64(decryptionKeyString)
    : undefined;

  let isSuccessfullyDecrypted = true;
  if (profile.name) {
    if (decryptionKey) {
      try {
        await c.setEncryptedProfileName(profile.name, decryptionKey);
      } catch (error) {
        log.warn(
          'getProfile decryption failure:',
          idForLogging,
          Errors.toLogFormat(error)
        );
        isSuccessfullyDecrypted = false;
        await c.set({
          profileName: undefined,
          profileFamilyName: undefined,
        });
      }
    }
  } else {
    c.set({
      profileName: undefined,
      profileFamilyName: undefined,
    });
  }

  try {
    if (decryptionKey) {
      await c.setProfileAvatar(profile.avatar, decryptionKey);
    }
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.code === 403 || error.code === 404) {
        log.warn(
          `getProfile: profile avatar is missing for conversation ${idForLogging}`
        );
      }
    } else {
      log.warn(
        `getProfile: failed to decrypt avatar for conversation ${idForLogging}`,
        Errors.toLogFormat(error)
      );
      isSuccessfullyDecrypted = false;
    }
  }

  c.set('profileLastFetchedAt', Date.now());

  // After we successfully decrypted - update lastProfile property
  if (
    isSuccessfullyDecrypted &&
    profileKey &&
    getProfileOptions.profileKeyVersion
  ) {
    await c.updateLastProfile(lastProfile, {
      profileKey,
      profileKeyVersion: getProfileOptions.profileKeyVersion,
    });
  }

  window.Signal.Data.updateConversation(c.attributes);
}

async function maybeGetPNICredential(
  c: ConversationModel,
  {
    clientZkProfileCipher,
    profileKey,
    profileKeyVersion,
    userLanguages,
  }: {
    clientZkProfileCipher: ClientZkProfileOperations;
    profileKey: string;
    profileKeyVersion: string;
    userLanguages: ReadonlyArray<string>;
  }
): Promise<void> {
  // Already present and up-to-date
  if (c.get('pniCredential')) {
    return;
  }
  strictAssert(isMe(c.attributes), 'Has to fetch PNI credential for ourselves');

  log.info('maybeGetPNICredential: requesting PNI credential');

  const { storage, messaging } = window.textsecure;
  strictAssert(
    messaging,
    'maybeGetPNICredential: window.textsecure.messaging not available'
  );

  const ourACI = storage.user.getCheckedUuid(UUIDKind.ACI);
  const ourPNI = storage.user.getCheckedUuid(UUIDKind.PNI);

  const {
    requestHex: profileKeyCredentialRequestHex,
    context: profileCredentialRequestContext,
  } = generatePNICredentialRequest(
    clientZkProfileCipher,
    ourACI.toString(),
    ourPNI.toString(),
    profileKey
  );

  const profile = await messaging.getProfile(ourACI, {
    userLanguages,
    profileKeyVersion,
    profileKeyCredentialRequest: profileKeyCredentialRequestHex,
    credentialType: 'pni',
  });

  strictAssert(
    profile.pniCredential,
    'We must get the credential for ourselves'
  );
  const pniCredential = handleProfileKeyPNICredential(
    clientZkProfileCipher,
    profileCredentialRequestContext,
    profile.pniCredential
  );
  c.set({ pniCredential });

  log.info('maybeGetPNICredential: updated PNI credential');
}
