// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  usernames,
  LibSignalErrorBase,
  ErrorCode,
} from '@signalapp/libsignal-client';

import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import { strictAssert } from '../util/assert';
import { sleep } from '../util/sleep';
import { getMinNickname, getMaxNickname } from '../util/Username';
import { bytesToUuid, uuidToBytes } from '../util/uuidToBytes';
import type { UsernameReservationType } from '../types/Username';
import {
  ReserveUsernameError,
  ConfirmUsernameResult,
  getNickname,
  getDiscriminator,
  isCaseChange,
} from '../types/Username';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import MessageSender from '../textsecure/SendMessage';
import { HTTPError } from '../textsecure/Errors';
import { findRetryAfterTimeFromError } from '../jobs/helpers/findRetryAfterTimeFromError';
import * as Bytes from '../Bytes';
import { storageServiceUploadJob } from './storage';

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
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

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

    const { usernameHash } = await server.reserveUsername({
      hashes,
      abortSignal,
    });

    const index = hashes.findIndex(hash => hash.equals(usernameHash));
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

  // Update backbone, update DB, then tell linked devices about profile update
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
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

  const { previousUsername, username } = reservation;
  const previousLink = window.storage.get('usernameLink');

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  const { hash } = reservation;
  strictAssert(usernames.hash(username).equals(hash), 'username hash mismatch');

  const wasCorrupted = window.storage.get('usernameCorrupted');

  try {
    await window.storage.remove('usernameLink');

    let serverIdString: string;
    let entropy: Buffer;
    if (previousLink && isCaseChange(reservation)) {
      log.info('confirmUsername: updating link only');

      const updatedLink = usernames.createUsernameLink(
        username,
        Buffer.from(previousLink.entropy)
      );
      ({ entropy } = updatedLink);

      ({ usernameLinkHandle: serverIdString } =
        await server.replaceUsernameLink({
          encryptedUsername: updatedLink.encryptedUsername,
          keepLinkHandle: true,
        }));
    } else {
      log.info('confirmUsername: confirming and replacing link');

      const newLink = usernames.createUsernameLink(username);
      ({ entropy } = newLink);

      const proof = usernames.generateProof(username);

      ({ usernameLinkHandle: serverIdString } = await server.confirmUsername({
        hash,
        proof,
        encryptedUsername: newLink.encryptedUsername,
        abortSignal,
      }));
    }

    await window.storage.put('usernameLink', {
      entropy,
      serverId: uuidToBytes(serverIdString),
    });

    await updateUsernameAndSyncProfile(username);
    await window.storage.remove('usernameCorrupted');
    await window.storage.remove('usernameLinkCorrupted');
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
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  await window.storage.remove('usernameLink');
  await server.deleteUsername(abortSignal);
  await window.storage.remove('usernameCorrupted');
  await updateUsernameAndSyncProfile(undefined);
}

export async function resetLink(username: string): Promise<void> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== username) {
    throw new Error('Username has changed on another device');
  }

  const { entropy, encryptedUsername } = usernames.createUsernameLink(username);

  await window.storage.remove('usernameLink');

  const { usernameLinkHandle: serverIdString } =
    await server.replaceUsernameLink({
      encryptedUsername,
      keepLinkHandle: false,
    });

  await window.storage.put('usernameLink', {
    entropy,
    serverId: uuidToBytes(serverIdString),
  });
  await window.storage.remove('usernameLinkCorrupted');

  me.captureChange('usernameLink');
  storageServiceUploadJob({ reason: 'resetLink' });
}

const USERNAME_LINK_ENTROPY_SIZE = 32;

export async function resolveUsernameByLinkBase64(
  base64: string
): Promise<string | undefined> {
  const content = Bytes.fromBase64(base64);
  const entropy = content.slice(0, USERNAME_LINK_ENTROPY_SIZE);
  const serverId = content.slice(USERNAME_LINK_ENTROPY_SIZE);

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
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

  const serverId = bytesToUuid(serverIdBytes);
  strictAssert(serverId, 'Failed to re-encode server id as uuid');

  strictAssert(window.textsecure.server, 'WebAPI must be available');
  try {
    const { usernameLinkEncryptedValue } =
      await server.resolveUsernameLink(serverId);

    return usernames.decryptUsernameLink({
      entropy: Buffer.from(entropy),
      encryptedUsername: Buffer.from(usernameLinkEncryptedValue),
    });
  } catch (error) {
    if (error instanceof HTTPError && error.code === 404) {
      return undefined;
    }
    throw error;
  }
}
