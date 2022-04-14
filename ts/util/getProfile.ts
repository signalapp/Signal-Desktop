// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ProfileKeyCredentialRequestContext } from '@signalapp/libsignal-client/zkgroup';
import { SEALED_SENDER } from '../types/SealedSender';
import * as Errors from '../types/errors';
import type {
  GetProfileOptionsType,
  GetProfileUnauthOptionsType,
} from '../textsecure/WebAPI';
import { HTTPError } from '../textsecure/Errors';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import * as Bytes from '../Bytes';
import { trimForDisplay, verifyAccessKey, decryptProfile } from '../Crypto';
import {
  generateProfileKeyCredentialRequest,
  getClientZkProfileOperations,
  handleProfileKeyCredential,
} from './zkgroup';
import { isMe } from './whatTypeOfConversation';
import type { ConversationModel } from '../models/conversations';
import * as log from '../logging/log';
import { getUserLanguages } from './userLanguages';
import { parseBadgesFromServer } from '../badges/parseBadgesFromServer';
import { strictAssert } from './assert';

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
  const existingProfileKeyCredential = c.get('profileKeyCredential');
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

    if (existingProfileKeyCredential) {
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
        const profileKeyCredential = handleProfileKeyCredential(
          clientZkProfileCipher,
          profileCredentialRequestContext,
          profile.credential
        );
        c.set({ profileKeyCredential });
      } else {
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

export async function getProfile(
  providedUuid?: string,
  providedE164?: string
): Promise<void> {
  const id = window.ConversationController.ensureContactIds({
    uuid: providedUuid,
    e164: providedE164,
  });
  const c = window.ConversationController.get(id);
  if (!c) {
    log.error('getProfile: failed to find conversation; doing nothing');
    return;
  }

  await doGetProfile(c);
}
