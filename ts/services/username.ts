// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  usernames,
  LibSignalErrorBase,
  ErrorCode,
} from '@signalapp/libsignal-client';

import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { sleep } from '../util/sleep.std.js';
import { getMinNickname, getMaxNickname } from '../util/Username.dom.js';
import { bytesToUuid, uuidToBytes } from '../util/uuidToBytes.std.js';
import type { UsernameReservationType } from '../types/Username.std.js';
import {
  ReserveUsernameError,
  ConfirmUsernameResult,
  getNickname,
  getDiscriminator,
  isCaseChange,
} from '../types/Username.std.js';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { MessageSender } from '../textsecure/SendMessage.preload.js';
import {
  reserveUsername as doReserveUsername,
  replaceUsernameLink,
  confirmUsername as doConfirmUsername,
  deleteUsername as doDeleteUsername,
  resolveUsernameLink,
} from '../textsecure/WebAPI.preload.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { findRetryAfterTimeFromError } from '../jobs/helpers/findRetryAfterTimeFromError.std.js';
import * as Bytes from '../Bytes.std.js';
import { storageServiceUploadJob } from './storage.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('username');

export type WriteUsernameOptionsType = Readonly<
  | {
      reservation: UsernameReservationType;
    }
  | {
      username: undefined;
      previousUsername: string | undefined;
      reservation?: undefined;
    }
>;

export type ReserveUsernameOptionsType = Readonly<{
  nickname: string;
  customDiscriminator: string | undefined;
  previousUsername: string | undefined;
  abortSignal?: AbortSignal;
}>;

export type ReserveUsernameResultType = Readonly<
  | {
      ok: true;
      reservation: UsernameReservationType;
      error?: void;
    }
  | {
      ok: false;
      reservation?: void;
      error: ReserveUsernameError;
    }
>;

export async function reserveUsername(
  options: ReserveUsernameOptionsType
): Promise<ReserveUsernameResultType> {
  const { nickname, customDiscriminator, previousUsername, abortSignal } =
    options;

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('reserveUsername: Username has changed on another device');
  }

  try {
    if (previousUsername !== undefined && !customDiscriminator) {
      const previousNickname = getNickname(previousUsername);

      // Case change
      if (
        previousNickname !== undefined &&
        nickname.toLowerCase() === previousNickname.toLowerCase()
      ) {
        const previousDiscriminator = getDiscriminator(previousUsername);
        const newUsername = `${nickname}.${previousDiscriminator}`;
        const hash = usernames.hash(newUsername);
        return {
          ok: true,
          reservation: { previousUsername, username: newUsername, hash },
        };
      }
    }

    const candidates = customDiscriminator
      ? [
          usernames.fromParts(
            nickname,
            customDiscriminator,
            getMinNickname(),
            getMaxNickname()
          ).username,
        ]
      : usernames.generateCandidates(
          nickname,
          getMinNickname(),
          getMaxNickname()
        );

    const hashes = candidates.map(username => usernames.hash(username));

    const { usernameHash } = await doReserveUsername({
      hashes,
      abortSignal,
    });

    const index = hashes.findIndex(hash => Bytes.areEqual(hash, usernameHash));
    if (index === -1) {
      log.warn('reserveUsername: failed to find username hash in the response');
      return { ok: false, error: ReserveUsernameError.Unprocessable };
    }

    const username = candidates[index];

    return {
      ok: true,
      reservation: { previousUsername, username, hash: usernameHash },
    };
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.code === 422) {
        return { ok: false, error: ReserveUsernameError.Unprocessable };
      }
      if (error.code === 409) {
        return { ok: false, error: ReserveUsernameError.Conflict };
      }
      if (error.code === 413 || error.code === 429) {
        return {
          ok: false,
          error: ReserveUsernameError.TooManyAttempts,
        };
      }
    }
    if (error instanceof LibSignalErrorBase) {
      if (
        error.code === ErrorCode.NicknameCannotBeEmpty ||
        error.code === ErrorCode.NicknameTooShort
      ) {
        return {
          ok: false,
          error: ReserveUsernameError.NotEnoughCharacters,
        };
      }
      if (error.code === ErrorCode.NicknameTooLong) {
        return {
          ok: false,
          error: ReserveUsernameError.TooManyCharacters,
        };
      }
      if (error.code === ErrorCode.CannotStartWithDigit) {
        return {
          ok: false,
          error: ReserveUsernameError.CheckStartingCharacter,
        };
      }
      if (error.code === ErrorCode.BadNicknameCharacter) {
        return {
          ok: false,
          error: ReserveUsernameError.CheckCharacters,
        };
      }

      if (error.code === ErrorCode.DiscriminatorCannotBeZero) {
        return {
          ok: false,
          error: ReserveUsernameError.AllZeroDiscriminator,
        };
      }

      if (error.code === ErrorCode.DiscriminatorCannotHaveLeadingZeros) {
        return {
          ok: false,
          error: ReserveUsernameError.LeadingZeroDiscriminator,
        };
      }

      if (
        error.code === ErrorCode.DiscriminatorCannotBeEmpty ||
        error.code === ErrorCode.DiscriminatorCannotBeSingleDigit ||
        // This is handled on UI level
        error.code === ErrorCode.DiscriminatorTooLarge
      ) {
        return {
          ok: false,
          error: ReserveUsernameError.NotEnoughDiscriminator,
        };
      }
    }
    throw error;
  }
}

async function updateUsernameAndSyncProfile(
  username: string | undefined
): Promise<void> {
  const me = window.ConversationController.getOurConversationOrThrow();

  // Update model, update DB, then tell linked devices about profile update
  await me.updateUsername(username);

  try {
    await singleProtoJobQueue.add(
      MessageSender.getFetchLocalProfileSyncMessage()
    );
  } catch (error) {
    log.error(
      'updateUsernameAndSyncProfile: Failed to queue sync message',
      Errors.toLogFormat(error)
    );
  }
}

export async function confirmUsername(
  reservation: UsernameReservationType,
  abortSignal?: AbortSignal
): Promise<ConfirmUsernameResult> {
  const { previousUsername, username } = reservation;
  const previousLink = itemStorage.get('usernameLink');

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  const { hash } = reservation;
  strictAssert(
    Bytes.areEqual(usernames.hash(username), hash),
    'username hash mismatch'
  );

  const wasCorrupted = itemStorage.get('usernameCorrupted');

  try {
    await itemStorage.remove('usernameLink');

    let serverIdString: string;
    let entropy: Uint8Array;
    if (previousLink && isCaseChange(reservation)) {
      log.info('confirmUsername: updating link only');

      const updatedLink = usernames.createUsernameLink(
        username,
        previousLink.entropy
      );
      ({ entropy } = updatedLink);

      ({ usernameLinkHandle: serverIdString } = await replaceUsernameLink({
        encryptedUsername: updatedLink.encryptedUsername,
        keepLinkHandle: true,
      }));
    } else {
      log.info('confirmUsername: confirming and replacing link');

      const newLink = usernames.createUsernameLink(username);
      ({ entropy } = newLink);

      const proof = usernames.generateProof(username);

      ({ usernameLinkHandle: serverIdString } = await doConfirmUsername({
        hash,
        proof,
        encryptedUsername: newLink.encryptedUsername,
        abortSignal,
      }));
    }

    await itemStorage.put('usernameLink', {
      entropy,
      serverId: uuidToBytes(serverIdString),
    });

    await updateUsernameAndSyncProfile(username);
    await itemStorage.remove('usernameCorrupted');
    await itemStorage.remove('usernameLinkCorrupted');
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.code === 413 || error.code === 429) {
        const time = findRetryAfterTimeFromError(error);
        log.warn(`confirmUsername: got ${error.code}, waiting ${time}ms`);
        await sleep(time, abortSignal);

        return confirmUsername(reservation, abortSignal);
      }

      if (error.code === 409 || error.code === 410) {
        return ConfirmUsernameResult.ConflictOrGone;
      }
    }
    throw error;
  }

  return wasCorrupted
    ? ConfirmUsernameResult.OkRecovered
    : ConfirmUsernameResult.Ok;
}

export async function deleteUsername(
  previousUsername: string | undefined,
  abortSignal?: AbortSignal
): Promise<void> {
  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  await itemStorage.remove('usernameLink');
  await doDeleteUsername(abortSignal);
  await itemStorage.remove('usernameCorrupted');
  await updateUsernameAndSyncProfile(undefined);
}

export async function resetLink(username: string): Promise<void> {
  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== username) {
    throw new Error('Username has changed on another device');
  }

  const { entropy, encryptedUsername } = usernames.createUsernameLink(username);

  await itemStorage.remove('usernameLink');

  const { usernameLinkHandle: serverIdString } = await replaceUsernameLink({
    encryptedUsername,
    keepLinkHandle: false,
  });

  await itemStorage.put('usernameLink', {
    entropy,
    serverId: uuidToBytes(serverIdString),
  });
  await itemStorage.remove('usernameLinkCorrupted');

  me.captureChange('usernameLink');
  storageServiceUploadJob({ reason: 'resetLink' });
}

const USERNAME_LINK_ENTROPY_SIZE = 32;

export async function resolveUsernameByLinkBase64(
  base64: string
): Promise<string | undefined> {
  const content = Bytes.fromBase64(base64);
  const entropy = content.subarray(0, USERNAME_LINK_ENTROPY_SIZE);
  const serverId = content.subarray(USERNAME_LINK_ENTROPY_SIZE);

  return resolveUsernameByLink({ entropy, serverId });
}

export type ResolveUsernameByLinkOptionsType = Readonly<{
  entropy: Uint8Array;
  serverId: Uint8Array;
}>;

export async function resolveUsernameByLink({
  entropy,
  serverId: serverIdBytes,
}: ResolveUsernameByLinkOptionsType): Promise<string | undefined> {
  const serverId = bytesToUuid(serverIdBytes);
  strictAssert(serverId, 'Failed to re-encode server id as uuid');

  try {
    const { usernameLinkEncryptedValue } = await resolveUsernameLink(serverId);

    return usernames.decryptUsernameLink({
      entropy,
      encryptedUsername: usernameLinkEncryptedValue,
    });
  } catch (error) {
    if (error instanceof HTTPError && error.code === 404) {
      return undefined;
    }
    throw error;
  }
}
