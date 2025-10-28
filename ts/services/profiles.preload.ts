// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ClientZkProfileOperations,
  ProfileKeyCredentialRequestContext,
} from '@signalapp/libsignal-client/zkgroup.js';
import PQueue from 'p-queue';
import { IdentityChange } from '@signalapp/libsignal-client';

import type { ReadonlyDeep } from 'type-fest';
import type { ConversationModel } from '../models/conversations.preload.js';
import type { CapabilitiesType } from '../types/Capabilities.d.ts';
import type { ProfileType } from '../textsecure/WebAPI.preload.js';
import {
  checkAccountExistence,
  getProfile,
  getProfileUnauth,
} from '../textsecure/WebAPI.preload.js';
import { MessageSender } from '../textsecure/SendMessage.preload.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { DataWriter } from '../sql/Client.preload.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import * as Bytes from '../Bytes.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { isRecord } from '../util/isRecord.std.js';
import { sleep } from '../util/sleep.std.js';
import { MINUTE, SECOND } from '../util/durations/index.std.js';
import {
  generateProfileKeyCredentialRequest,
  getClientZkProfileOperations,
  handleProfileKeyCredential,
} from '../util/zkgroup.node.js';
import { isMe } from '../util/whatTypeOfConversation.dom.js';
import { parseBadgesFromServer } from '../badges/parseBadgesFromServer.std.js';
import { strictAssert } from '../util/assert.std.js';
import { drop } from '../util/drop.std.js';
import { findRetryAfterTimeFromError } from '../jobs/helpers/findRetryAfterTimeFromError.std.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.js';
import { SEALED_SENDER } from '../types/SealedSender.std.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { Address } from '../types/Address.std.js';
import { QualifiedAddress } from '../types/QualifiedAddress.std.js';
import {
  trimForDisplay,
  verifyAccessKey,
  decryptProfile,
} from '../Crypto.node.js';
import type { ConversationLastProfileType } from '../model-types.d.ts';
import type { GroupSendToken } from '../types/GroupSendEndorsements.std.js';
import {
  maybeCreateGroupSendEndorsementState,
  onFailedToSendWithEndorsements,
} from '../util/groupSendEndorsements.preload.js';
import { ProfileDecryptError } from '../types/errors.std.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('profiles');

type JobType = {
  resolve: () => void;
  reject: (error: Error) => void;
  promise: Promise<void>;
  startTime: number;
};

// Goals for this service:
//   1. Ensure that when we get a 413/429 from the server, we stop firing off profile
//      fetches for a while.
//   2. Ensure that all existing profile fetches don't hang in this case; to solve this we
//      cancel all outstanding requests when we hit a 413/429, and throw instead of
//      queueing something new if we're waiting due to a retry-after. Note: It's no worse
//      than what we were doing before, failing all requests and pushing the retry-after
//      time out further.
//   3. Require no changes to callers.

// Potential future goals for this problem area:
//   - Update all getProfiles() callers; make them resilient to longer delays
//   - Keep track of last profile fetch per conversation, reduce unnecessary re-fetches
//   - Enforce a maximum profile fetch frequency
//   - Don't even attempt jobs when offline

const OBSERVED_CAPABILITY_KEYS = Object.keys({
  attachmentBackfill: true,
} satisfies CapabilitiesType) as ReadonlyArray<keyof CapabilitiesType>;

const PROFILE_FETCH_CONCURRENCY = 30;

export class ProfileService {
  #jobQueue: PQueue;
  #jobsByConversationId: Map<string, JobType> = new Map();
  #isPaused = false;

  constructor(
    private fetchProfile = doGetProfile,
    concurrency = PROFILE_FETCH_CONCURRENCY
  ) {
    this.#jobQueue = new PQueue({
      concurrency,
      timeout: MINUTE * 2,
    });
    this.#jobsByConversationId = new Map();

    log.info('Profile Service initialized');
  }

  public async get(
    conversationId: string,
    groupId: string | null
  ): Promise<void> {
    const preCheckConversation =
      window.ConversationController.get(conversationId);
    if (!preCheckConversation) {
      throw new Error(
        `ProfileServices.get: Pre-check conversation ${conversationId} not found`
      );
    }

    if (window.ConversationController.isSignalConversationId(conversationId)) {
      return;
    }

    if (this.#isPaused) {
      throw new Error(
        `ProfileService.get: Cannot add job to paused queue for conversation ${preCheckConversation.idForLogging()}`
      );
    }

    const existing = this.#jobsByConversationId.get(conversationId);
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
        await this.fetchProfile(conversation, groupId);
        resolve();
      } catch (error) {
        resolve();

        if (this.#isPaused) {
          return;
        }

        if (error instanceof ProfileDecryptError) {
          log.warn(
            `ProfileServices.get: Failed to decrypt profile for ${conversation.idForLogging()}`
          );
        } else if (isRecord(error) && 'code' in error) {
          if (error.code === -1) {
            this.clearAll('Failed to connect to the server');
          } else if (error.code === 413 || error.code === 429) {
            this.clearAll(`got ${error.code} from server`);
            const time = findRetryAfterTimeFromError(error);
            void this.pause(time);
          }
        } else {
          log.error(
            `ProfileServices.get: Error was thrown fetching ${conversation.idForLogging()}!`,
            Errors.toLogFormat(error)
          );
        }
      } finally {
        this.#jobsByConversationId.delete(conversationId);

        const now = Date.now();
        const delta = now - jobData.startTime;
        if (delta > 30 * SECOND) {
          log.warn(
            `ProfileServices.get: Job for ${conversation.idForLogging()} finished ${delta}ms after queue`
          );
        }
        const remainingItems = this.#jobQueue.size;
        if (remainingItems && remainingItems % 10 === 0) {
          log.info(
            `ProfileServices.get: ${remainingItems} jobs remaining in the queue`
          );
        }
      }
    };

    this.#jobsByConversationId.set(conversationId, jobData);
    drop(this.#jobQueue.add(job));

    return promise;
  }

  public clearAll(reason: string): void {
    if (this.#isPaused) {
      log.warn(
        `ProfileService.clearAll: Already paused; not clearing; reason: '${reason}'`
      );
      return;
    }

    log.info(`ProfileService.clearAll: Clearing; reason: '${reason}'`);

    try {
      this.#isPaused = true;
      this.#jobQueue.pause();

      this.#jobsByConversationId.forEach(job => {
        job.reject(
          new Error(`ProfileService.clearAll: job canceled because '${reason}'`)
        );
      });

      this.#jobsByConversationId.clear();
      this.#jobQueue.clear();

      this.#jobQueue.start();
    } finally {
      this.#isPaused = false;
      log.info('ProfileService.clearAll: Done clearing');
    }
  }

  public async pause(timeInMS: number): Promise<void> {
    if (this.#isPaused) {
      log.warn('ProfileService.pause: Already paused, not pausing again.');
      return;
    }

    log.info(`ProfileService.pause: Pausing queue for ${timeInMS}ms`);

    this.#isPaused = true;
    this.#jobQueue.pause();

    try {
      await sleep(timeInMS);
    } finally {
      log.info('ProfileService.pause: Restarting queue');
      this.#jobQueue.start();
      this.#isPaused = false;
    }
  }
}

export const profileService = new ProfileService();

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ProfileFetchOptions {
  type WithVersioned = ReadonlyDeep<{
    profileKey: string;
    profileCredentialRequestContext: ProfileKeyCredentialRequestContext | null;
    request: {
      profileKeyVersion: string;
      profileKeyCredentialRequest: string | null;
    };
  }>;
  type WithUnversioned = ReadonlyDeep<{
    profileKey: null;
    profileCredentialRequestContext: null;
    request: {
      profileKeyVersion: null;
      profileKeyCredentialRequest: null;
    };
  }>;
  type WithUnauthAccessKey = ReadonlyDeep<{
    request: { accessKey: string; groupSendToken: null };
  }>;
  type WithUnauthGroupSendToken = ReadonlyDeep<{
    request: {
      accessKey: null;
      groupSendToken: GroupSendToken;
    };
  }>;
  type WithAuth = ReadonlyDeep<{
    request: {
      accessKey: null;
      groupSendToken: null;
    };
  }>;

  export type Unauth =
    // versioned (unauth)
    | (WithVersioned & WithUnauthAccessKey)
    // unversioned (unauth)
    | (WithUnversioned & WithUnauthAccessKey)
    | (WithUnversioned & WithUnauthGroupSendToken);

  export type Auth =
    // unversioned (auth) -- Using lastProfile
    | (WithVersioned & WithAuth)
    // unversioned (auth)
    | (WithUnversioned & WithAuth);
}

export type ProfileFetchUnauthRequestOptions =
  ProfileFetchOptions.Unauth['request'];

export type ProfileFetchAuthRequestOptions =
  ProfileFetchOptions.Auth['request'];

async function buildProfileFetchOptions({
  conversation,
  lastProfile,
  clientZkProfileCipher,
  groupId,
  options,
}: {
  conversation: ConversationModel;
  lastProfile: ConversationLastProfileType | null;
  clientZkProfileCipher: ClientZkProfileOperations;
  groupId: string | null;
  options: { ignoreProfileKey: boolean; ignoreGroupSendToken: boolean };
}): Promise<ProfileFetchOptions.Auth | ProfileFetchOptions.Unauth> {
  const logId = `buildGetProfileOptions(${conversation.idForLogging()})`;

  const profileKey = conversation.get('profileKey');
  const profileKeyVersion = conversation.deriveProfileKeyVersion();
  const accessKey = conversation.get('accessKey');
  const serviceId = conversation.getCheckedServiceId('getProfile');

  function getProfileCredentialsToUseIfExpired(profileKeyArg: string): {
    credentialRequestContext: ProfileKeyCredentialRequestContext | null;
    credentialRequestHex: string | null;
  } {
    if (!conversation.hasProfileKeyCredentialExpired()) {
      log.info(`${logId}: using unexpired profile key credential`);
      return {
        credentialRequestContext: null,
        credentialRequestHex: null,
      };
    }

    log.info(`${logId}: generating profile key credential request`);
    const result = generateProfileKeyCredentialRequest(
      clientZkProfileCipher,
      serviceId,
      profileKeyArg
    );

    return {
      credentialRequestContext: result.context,
      credentialRequestHex: result.requestHex,
    };
  }

  if (
    profileKey &&
    profileKeyVersion &&
    accessKey &&
    !options.ignoreProfileKey &&
    !isMe(conversation.attributes)
  ) {
    const { credentialRequestContext, credentialRequestHex } =
      getProfileCredentialsToUseIfExpired(profileKey);
    return {
      profileKey,
      profileCredentialRequestContext: credentialRequestContext,
      request: {
        accessKey,
        groupSendToken: null,
        profileKeyVersion,
        profileKeyCredentialRequest: credentialRequestHex,
      },
    };
  }

  // If we're ignoring profileKey, try getting the versioned profile with lastProfile.
  // Note: No access key, since this is almost guaranteed not to be their current profile.
  // Also, we can't try the group send token here because the versioned profile can't be
  // decrypted without an up to date profile key.
  if (
    options.ignoreProfileKey &&
    lastProfile != null &&
    lastProfile.profileKey != null &&
    lastProfile.profileKeyVersion != null
  ) {
    log.info(`${logId}: using last profile key and version`);
    return {
      profileKey: lastProfile.profileKey,
      profileCredentialRequestContext: null,
      request: {
        accessKey: null,
        groupSendToken: null,
        profileKeyVersion: lastProfile.profileKeyVersion,
        profileKeyCredentialRequest: null,
      },
    };
  }

  // For self we also use the versioned profile on the authenticated socket,
  // with profile key credentials if needed.
  if (profileKey && profileKeyVersion && isMe(conversation.attributes)) {
    const { credentialRequestContext, credentialRequestHex } =
      getProfileCredentialsToUseIfExpired(profileKey);
    return {
      profileKey,
      profileCredentialRequestContext: credentialRequestContext,
      request: {
        accessKey: null,
        groupSendToken: null,
        profileKeyVersion,
        profileKeyCredentialRequest: credentialRequestHex,
      },
    };
  }

  // Fallback to group send tokens for unversioned profiles
  if (groupId != null && !options.ignoreGroupSendToken) {
    log.info(`${logId}: fetching group endorsements`);
    let result = await maybeCreateGroupSendEndorsementState(groupId, false);

    if (result.state == null && result.didRefreshGroupState) {
      result = await maybeCreateGroupSendEndorsementState(groupId, true);
    }

    const groupSendEndorsementState = result.state;
    const groupSendToken = groupSendEndorsementState?.buildToken(
      new Set([serviceId])
    );

    if (groupSendToken != null) {
      log.info(`${logId}: using group send token`);
      return {
        profileKey: null,
        profileCredentialRequestContext: null,
        request: {
          accessKey: null,
          groupSendToken,
          profileKeyVersion: null,
          profileKeyCredentialRequest: null,
        },
      };
    }
  }

  // Fallback to auth
  return {
    profileKey: null,
    profileCredentialRequestContext: null,
    request: {
      accessKey: null,
      groupSendToken: null,
      profileKeyVersion: null,
      profileKeyCredentialRequest: null,
    },
  };
}

function decryptField(field: string, decryptionKey: Uint8Array): Uint8Array {
  return decryptProfile(Bytes.fromBase64(field), decryptionKey);
}

function formatTextField(decrypted: Uint8Array): string {
  return Bytes.toString(trimForDisplay(decrypted));
}

function isFieldDefined(field: string | null | undefined): field is string {
  return field != null && field.length > 0;
}

function getFetchOptionsLabel(
  options: ProfileFetchOptions.Auth | ProfileFetchOptions.Unauth
) {
  let versioned: string;
  if (options.request.profileKeyVersion != null) {
    versioned = 'versioned';
  } else {
    versioned = 'unversioned';
  }
  let auth: string;
  if (options.request.accessKey != null) {
    auth = 'unauth: accessKey';
  } else if (options.request.groupSendToken != null) {
    auth = 'unauth: groupSendToken';
  } else {
    auth = 'auth';
  }
  return `${versioned}, ${auth}`;
}

async function doGetProfile(
  c: ConversationModel,
  groupId: string | null,
  {
    ignoreProfileKey,
    ignoreGroupSendToken,
  }: {
    ignoreProfileKey: boolean;
    ignoreGroupSendToken: boolean;
  } = { ignoreProfileKey: false, ignoreGroupSendToken: false }
): Promise<void> {
  const logId = groupId
    ? `getProfile(${c.idForLogging()} in groupv2(${groupId}))`
    : `getProfile(${c.idForLogging()})`;

  const { updatesUrl } = window.SignalContext.config;
  strictAssert(
    typeof updatesUrl === 'string',
    `${logId}: expected updatesUrl to be a defined string`
  );

  const clientZkProfileCipher = getClientZkProfileOperations(
    window.getServerPublicParams()
  );

  // Step #: Make sure we have an access key if we have a profile key.
  c.deriveAccessKeyIfNeeded();

  const serviceId = c.getCheckedServiceId('getProfile');

  // Step #: Grab the profile key and version we last were successful decrypting with.
  // We'll use it in case we've failed to fetch with our `profileKey`.
  const lastProfile = c.get('lastProfile');

  // Step #: Build the request options we will use for fetching and decrypting the profile
  const options = await buildProfileFetchOptions({
    conversation: c,
    lastProfile: lastProfile ?? null,
    clientZkProfileCipher,
    groupId,
    options: {
      ignoreProfileKey,
      ignoreGroupSendToken,
    },
  });
  const { request } = options;

  log.info(`${logId}: Fetching profile (${getFetchOptionsLabel(options)})`);

  // Step #: Fetch profile
  let profile: ProfileType;
  try {
    if (request.accessKey != null || request.groupSendToken != null) {
      profile = await getProfileUnauth(serviceId, request);
    } else {
      profile = await getProfile(serviceId, request);
    }
  } catch (error) {
    if (error instanceof HTTPError) {
      log.warn(`${logId}: Failed to fetch profile. Code:`, error.code);

      // Unauthorized/Forbidden
      if (error.code === 401 || error.code === 403) {
        if (request.groupSendToken != null) {
          onFailedToSendWithEndorsements(error);
        }

        // Step #: Retries for unauthorized access keys and group send tokens
        if (!isMe(c.attributes)) {
          // Fallback from failed unauth (access key) request
          if (request.accessKey != null) {
            log.warn(
              `${logId}: Got ${error.code} when using access key, failing over to lastProfile`
            );

            // Record that the accessKey we have in the conversation is invalid
            const sealedSender = c.get('sealedSender');
            if (sealedSender !== SEALED_SENDER.DISABLED) {
              c.set({ sealedSender: SEALED_SENDER.DISABLED });
            }

            // Retry fetch using last known profileKey or fetch unversioned profile.
            return doGetProfile(c, groupId, {
              ignoreProfileKey: true,
              ignoreGroupSendToken,
            });
          }

          // Fallback from failed unauth (group send token) request
          if (request.groupSendToken != null) {
            log.warn(`${logId}: Got ${error.code} when using group send token`);
            return doGetProfile(c, null, {
              ignoreProfileKey,
              ignoreGroupSendToken: true,
            });
          }
        }

        return;
      }

      // Not Found
      if (error.code === 404) {
        log.info(`${logId}: Profile not found; checking account existence`);

        const doesAccountExist = await checkAccountExistence(serviceId);
        if (!doesAccountExist) {
          c.setUnregistered();
        }

        c.set({ profileLastFetchedAt: Date.now() });

        return;
      }
    }

    // throw all unhandled errors
    throw error;
  }

  // Step #: Save `identityKey` to SignalProtocolStore
  if (isFieldDefined(profile.identityKey)) {
    const identityKeyBytes = Bytes.fromBase64(profile.identityKey);
    // Note: Queues some jobs
    await updateIdentityKey(identityKeyBytes, serviceId);
  }

  // Step #: Updating `sealedSender` based on the successful response
  {
    // Use the most up to date `accessKey` to prevent race conditions.
    // Since we run asynchronous requests above - it is possible that someone
    // updates or erases the profile key from under us.
    const accessKey = c.get('accessKey');
    let sealedSender: SEALED_SENDER;

    if (isFieldDefined(profile.unidentifiedAccess)) {
      if (isFieldDefined(profile.unrestrictedUnidentifiedAccess)) {
        sealedSender = SEALED_SENDER.UNRESTRICTED;
      } else if (accessKey != null) {
        const haveCorrectKey = verifyAccessKey(
          Bytes.fromBase64(accessKey),
          Bytes.fromBase64(profile.unidentifiedAccess)
        );
        if (haveCorrectKey) {
          sealedSender = SEALED_SENDER.ENABLED;
        } else {
          log.info(
            `${logId}: Access key mismatch with profile.unidentifiedAccess`
          );
        }
      }
    }
    // Default to disabled if we don't have unrestricted access or the correct access key
    sealedSender ??= SEALED_SENDER.DISABLED;
    log.info(
      `${logId}: setting sealedSender to ${SEALED_SENDER[sealedSender]} ` +
        `(unidentifiedAccess: ${isFieldDefined(profile.unidentifiedAccess)}, ` +
        `unrestrictedUnidentifiedAccess: ${isFieldDefined(profile.unrestrictedUnidentifiedAccess)}, ` +
        `accessKey: ${accessKey != null})`
    );
    c.set({ sealedSender });
  }

  // Step #: Grab the current `profileKey` (which may have updated) or the last
  // profile key we successfully decrypted from.
  const rawRequestDecryptionKey = options.profileKey ?? lastProfile?.profileKey;
  const rawUpdatedDecryptionKey =
    c.get('profileKey') ?? lastProfile?.profileKey;

  const requestDecryptionKey = rawRequestDecryptionKey
    ? Bytes.fromBase64(rawRequestDecryptionKey)
    : null;
  const updatedDecryptionKey = rawUpdatedDecryptionKey
    ? Bytes.fromBase64(rawUpdatedDecryptionKey)
    : null;

  // Step #: Save profile `about` to conversation
  if (isFieldDefined(profile.about)) {
    if (updatedDecryptionKey != null) {
      const decrypted = decryptField(profile.about, updatedDecryptionKey);
      c.set({ about: formatTextField(decrypted) });
    }
  } else {
    c.set({ about: undefined });
  }

  // Step #: Save profile `aboutEmoji` to conversation
  if (isFieldDefined(profile.aboutEmoji)) {
    if (updatedDecryptionKey != null) {
      const decrypted = decryptField(profile.aboutEmoji, updatedDecryptionKey);
      c.set({ aboutEmoji: formatTextField(decrypted) });
    }
  } else {
    c.set({ aboutEmoji: undefined });
  }

  // Step #: Save profile `phoneNumberSharing` to conversation
  if (isFieldDefined(profile.phoneNumberSharing)) {
    if (updatedDecryptionKey != null) {
      const decrypted = decryptField(
        profile.phoneNumberSharing,
        updatedDecryptionKey
      );
      // It should be one byte, but be conservative about it and
      // set `sharingPhoneNumber` to `false` in all cases except [0x01].
      const sharingPhoneNumber = decrypted.length === 1 && decrypted[0] === 1;
      c.set({ sharingPhoneNumber });
    }
  } else {
    c.set({ sharingPhoneNumber: undefined });
  }

  // Step #: Save our own `paymentAddress` to Storage
  if (isFieldDefined(profile.paymentAddress) && isMe(c.attributes)) {
    await itemStorage.put('paymentAddress', profile.paymentAddress);
  }

  // Step #: Save profile `capabilities` to conversation
  const pastCapabilities = c.get('capabilities');
  if (profile.capabilities != null) {
    c.set({ capabilities: profile.capabilities });
  } else {
    c.set({ capabilities: undefined });
  }

  // Step #: Save our own `observedCapabilities` to Storage and trigger sync if changed
  if (isMe(c.attributes)) {
    const newCapabilities = c.get('capabilities');

    let hasChanged = false;
    const observedCapabilities = {
      ...itemStorage.get('observedCapabilities'),
    };
    const newKeys = new Array<string>();
    for (const key of OBSERVED_CAPABILITY_KEYS) {
      // Already reported
      if (observedCapabilities[key]) {
        continue;
      }

      if (newCapabilities?.[key]) {
        if (!pastCapabilities?.[key]) {
          hasChanged = true;
          newKeys.push(key);
        }
        observedCapabilities[key] = true;
      }
    }

    await itemStorage.put('observedCapabilities', observedCapabilities);
    if (hasChanged) {
      log.info(
        'getProfile: detected a capability flip, sending fetch profile',
        newKeys
      );
      await singleProtoJobQueue.add(
        MessageSender.getFetchLocalProfileSyncMessage()
      );
    }
  }

  // Step #: Save profile `badges` to conversation and update redux
  const badges = parseBadgesFromServer(profile.badges, updatesUrl);
  if (badges.length) {
    window.reduxActions.badges.updateOrCreate(badges);
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
    c.set({ badges: undefined });
  }

  // Step #: Save updated (or clear if missing) profile `credential` to conversation
  if (options.profileCredentialRequestContext != null) {
    if (profile.credential != null && profile.credential.length > 0) {
      const {
        credential: profileKeyCredential,
        expiration: profileKeyCredentialExpiration,
      } = handleProfileKeyCredential(
        clientZkProfileCipher,
        options.profileCredentialRequestContext,
        profile.credential
      );
      c.set({ profileKeyCredential, profileKeyCredentialExpiration });
    } else {
      log.warn(
        `${logId}: Included credential request, but got no credential. Clearing profileKeyCredential.`
      );
      c.set({ profileKeyCredential: undefined });
    }
  }

  // TODO: Should this track other failures?
  let isSuccessfullyDecrypted = true;

  // Step #: Save profile `name` to conversation
  if (isFieldDefined(profile.name)) {
    if (requestDecryptionKey != null) {
      try {
        // Note: Writes to DB and saves message
        await c.setEncryptedProfileName(profile.name, requestDecryptionKey);
      } catch (error) {
        log.warn(
          `${logId}: Failed to decrypt profile name`,
          Errors.toLogFormat(error)
        );
        isSuccessfullyDecrypted = false;
      }
    } else {
      log.warn(`${logId}: No key to decrypt 'name' field; skipping`);
    }
  } else {
    log.warn(`${logId}: 'name' field missing; clearing profile name`);
    c.set({
      profileName: undefined,
      profileFamilyName: undefined,
    });
  }

  try {
    if (requestDecryptionKey != null) {
      // Note: Fetches avatar
      await c.setAndMaybeFetchProfileAvatar({
        avatarUrl: profile.avatar,
        decryptionKey: requestDecryptionKey,
      });
    }
  } catch (error) {
    if (error instanceof HTTPError) {
      // Forbidden/Not Found
      if (error.code === 403 || error.code === 404) {
        log.warn(`${logId}: Profile avatar is missing (${error.code})`);
      }
    } else {
      log.warn(
        `${logId}: Failed to decrypt profile avatar`,
        Errors.toLogFormat(error)
      );
      isSuccessfullyDecrypted = false;
    }
  }

  c.set({ profileLastFetchedAt: Date.now() });

  // After we successfully decrypted - update lastProfile property
  if (
    isSuccessfullyDecrypted &&
    options.profileKey &&
    request.profileKeyVersion
  ) {
    await c.updateLastProfile(lastProfile, {
      profileKey: options.profileKey,
      profileKeyVersion: request.profileKeyVersion,
    });
  }

  await DataWriter.updateConversation(c.attributes);
}

export type UpdateIdentityKeyOptionsType = Readonly<{
  noOverwrite?: boolean;
}>;

export async function updateIdentityKey(
  identityKey: Uint8Array,
  serviceId: ServiceIdString,
  { noOverwrite = false }: UpdateIdentityKeyOptionsType = {}
): Promise<boolean> {
  if (!Bytes.isNotEmpty(identityKey)) {
    return false;
  }

  const saveOutcome = await signalProtocolStore.saveIdentity(
    new Address(serviceId, 1),
    identityKey,
    false,
    { noOverwrite }
  );
  const changed = saveOutcome === IdentityChange.ReplacedExisting;
  if (changed) {
    log.info(`updateIdentityKey(${serviceId}): changed`);
    // save identity will close all sessions except for .1, so we
    // must close that one manually.
    const ourAci = itemStorage.user.getCheckedAci();
    await signalProtocolStore.archiveSession(
      new QualifiedAddress(ourAci, new Address(serviceId, 1))
    );
  }

  return changed;
}
