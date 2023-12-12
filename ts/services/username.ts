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
import { ReserveUsernameError, ConfirmUsernameResult } from '../types/Username';
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

  const { nickname, previousUsername, abortSignal } = options;

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('reserveUsername: Username has changed on another device');
  }

  try {
    const candidates = usernames.generateCandidates(
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
        const time = findRetryAfterTimeFromError(error);
        log.warn(`reserveUsername: got ${error.code}, waiting ${time}ms`);
        await sleep(time, abortSignal);

        return reserveUsername(options);
      }
    }
    if (error instanceof LibSignalErrorBase) {
      if (
        error.code === ErrorCode.CannotBeEmpty ||
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

  const { previousUsername, username, hash } = reservation;

  const me = window.ConversationController.getOurConversationOrThrow();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }
  const proof = usernames.generateProof(username);
  strictAssert(usernames.hash(username).equals(hash), 'username hash mismatch');

  try {
    const { entropy, encryptedUsername } =
      usernames.createUsernameLink(username);

    await window.storage.remove('usernameLink');
    await window.storage.remove('usernameCorrupted');
    await window.storage.remove('usernameLinkCorrupted');

    const { usernameLinkHandle: serverIdString } = await server.confirmUsername(
      {
        hash,
        proof,
        encryptedUsername,
        abortSignal,
      }
    );

    await window.storage.put('usernameLink', {
      entropy,
      serverId: uuidToBytes(serverIdString),
    });

    await updateUsernameAndSyncProfile(username);
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

  return ConfirmUsernameResult.Ok;
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
  await window.storage.remove('usernameCorrupted');
  await server.deleteUsername(abortSignal);
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
  await window.storage.remove('usernameLinkCorrupted');

  const { usernameLinkHandle: serverIdString } =
    await server.replaceUsernameLink({ encryptedUsername });

  await window.storage.put('usernameLink', {
    entropy,
    serverId: uuidToBytes(serverIdString),
  });

  me.captureChange('usernameLink');
  storageServiceUploadJob();
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
    const { usernameLinkEncryptedValue } = await server.resolveUsernameLink(
      serverId
    );

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
