// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ProfileKeyCredentialRequestContext } from '@signalapp/signal-client/zkgroup';
import { SEALED_SENDER } from '../types/SealedSender';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import * as Bytes from '../Bytes';
import { trimForDisplay, verifyAccessKey, decryptProfile } from '../Crypto';
import {
  generateProfileKeyCredentialRequest,
  getClientZkProfileOperations,
  handleProfileKeyCredential,
} from './zkgroup';
import { getSendOptions } from './getSendOptions';
import { isMe } from './whatTypeOfConversation';
import * as log from '../logging/log';
import { getUserLanguages } from './userLanguages';
import { parseBadgesFromServer } from '../badges/parseBadgesFromServer';

export async function getProfile(
  providedUuid?: string,
  providedE164?: string
): Promise<void> {
  if (!window.textsecure.messaging) {
    throw new Error(
      'Conversation.getProfile: window.textsecure.messaging not available'
    );
  }

  const { updatesUrl } = window.SignalContext.config;
  if (typeof updatesUrl !== 'string') {
    throw new Error('getProfile expected updatesUrl to be a defined string');
  }

  const id = window.ConversationController.ensureContactIds({
    uuid: providedUuid,
    e164: providedE164,
  });
  const c = window.ConversationController.get(id);
  if (!c) {
    log.error('getProfile: failed to find conversation; doing nothing');
    return;
  }

  const clientZkProfileCipher = getClientZkProfileOperations(
    window.getServerPublicParams()
  );

  const userLanguages = getUserLanguages(
    navigator.languages,
    window.getLocale()
  );

  let profile;

  try {
    await Promise.all([
      c.deriveAccessKeyIfNeeded(),
      c.deriveProfileKeyVersionIfNeeded(),
    ]);

    const profileKey = c.get('profileKey');
    const uuid = c.getCheckedUuid('getProfile');
    const profileKeyVersionHex = c.get('profileKeyVersion');
    if (!profileKeyVersionHex) {
      throw new Error('No profile key version available');
    }
    const existingProfileKeyCredential = c.get('profileKeyCredential');

    let profileKeyCredentialRequestHex: undefined | string;
    let profileCredentialRequestContext:
      | undefined
      | ProfileKeyCredentialRequestContext;

    if (profileKey && profileKeyVersionHex && !existingProfileKeyCredential) {
      log.info('Generating request...');
      ({
        requestHex: profileKeyCredentialRequestHex,
        context: profileCredentialRequestContext,
      } = generateProfileKeyCredentialRequest(
        clientZkProfileCipher,
        uuid.toString(),
        profileKey
      ));
    }

    const { sendMetadata = {} } = await getSendOptions(c.attributes);
    const getInfo = sendMetadata[uuid.toString()] || {};

    if (getInfo.accessKey) {
      try {
        profile = await window.textsecure.messaging.getProfile(uuid, {
          accessKey: getInfo.accessKey,
          profileKeyVersion: profileKeyVersionHex,
          profileKeyCredentialRequest: profileKeyCredentialRequestHex,
          userLanguages,
        });
      } catch (error) {
        if (error.code === 401 || error.code === 403) {
          log.info(
            `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
          );
          c.set({ sealedSender: SEALED_SENDER.DISABLED });
          profile = await window.textsecure.messaging.getProfile(uuid, {
            profileKeyVersion: profileKeyVersionHex,
            profileKeyCredentialRequest: profileKeyCredentialRequestHex,
            userLanguages,
          });
        } else {
          throw error;
        }
      }
    } else {
      profile = await window.textsecure.messaging.getProfile(uuid, {
        profileKeyVersion: profileKeyVersionHex,
        profileKeyCredentialRequest: profileKeyCredentialRequestHex,
        userLanguages,
      });
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

    const accessKey = c.get('accessKey');
    if (profile.unrestrictedUnidentifiedAccess && profile.unidentifiedAccess) {
      log.info(
        `Setting sealedSender to UNRESTRICTED for conversation ${c.idForLogging()}`
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
          `Setting sealedSender to ENABLED for conversation ${c.idForLogging()}`
        );
        c.set({
          sealedSender: SEALED_SENDER.ENABLED,
        });
      } else {
        log.info(
          `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
        );
        c.set({
          sealedSender: SEALED_SENDER.DISABLED,
        });
      }
    } else {
      log.info(
        `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
      );
      c.set({
        sealedSender: SEALED_SENDER.DISABLED,
      });
    }

    if (profile.about) {
      const key = c.get('profileKey');
      if (key) {
        const keyBuffer = Bytes.fromBase64(key);
        const decrypted = decryptProfile(
          Bytes.fromBase64(profile.about),
          keyBuffer
        );
        c.set('about', Bytes.toString(trimForDisplay(decrypted)));
      }
    } else {
      c.unset('about');
    }

    if (profile.aboutEmoji) {
      const key = c.get('profileKey');
      if (key) {
        const keyBuffer = Bytes.fromBase64(key);
        const decrypted = decryptProfile(
          Bytes.fromBase64(profile.aboutEmoji),
          keyBuffer
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
    switch (error?.code) {
      case 403:
        throw error;
      case 404:
        log.warn(
          `getProfile failure: failed to find a profile for ${c.idForLogging()}`,
          error && error.stack ? error.stack : error
        );
        c.setUnregistered();
        return;
      default:
        log.warn(
          'getProfile failure:',
          c.idForLogging(),
          error && error.stack ? error.stack : error
        );
        return;
    }
  }

  if (profile.name) {
    try {
      await c.setEncryptedProfileName(profile.name);
    } catch (error) {
      log.warn(
        'getProfile decryption failure:',
        c.idForLogging(),
        error && error.stack ? error.stack : error
      );
      await c.set({
        profileName: undefined,
        profileFamilyName: undefined,
      });
    }
  } else {
    c.set({
      profileName: undefined,
      profileFamilyName: undefined,
    });
  }

  try {
    await c.setProfileAvatar(profile.avatar);
  } catch (error) {
    if (error.code === 403 || error.code === 404) {
      log.info(`Clearing profile avatar for conversation ${c.idForLogging()}`);
      c.set({
        profileAvatar: null,
      });
    }
  }

  c.set('profileLastFetchedAt', Date.now());

  window.Signal.Data.updateConversation(c.attributes);
}
