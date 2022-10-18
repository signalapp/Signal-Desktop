// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import dataInterface from '../sql/Client';
import { updateOurUsernameAndPni } from '../util/updateOurUsernameAndPni';
import { sleep } from '../util/sleep';
import type { UsernameReservationType } from '../types/Username';
import { ReserveUsernameError } from '../types/Username';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import MessageSender from '../textsecure/SendMessage';
import { HTTPError } from '../textsecure/Errors';
import { findRetryAfterTimeFromError } from '../jobs/helpers/findRetryAfterTimeFromError';

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
  await updateOurUsernameAndPni();

  if (me.get('username') !== previousUsername) {
    throw new Error('reserveUsername: Username has changed on another device');
  }

  try {
    const { username, reservationToken } = await server.reserveUsername({
      nickname,
      abortSignal,
    });

    return {
      ok: true,
      reservation: { previousUsername, username, reservationToken },
    };
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.code === 422) {
        return { ok: false, error: ReserveUsernameError.Unprocessable };
      }
      if (error.code === 409) {
        return { ok: false, error: ReserveUsernameError.Conflict };
      }
      if (error.code === 413) {
        const time = findRetryAfterTimeFromError(error);
        log.warn(`reserveUsername: got 413, waiting ${time}ms`);
        await sleep(time, abortSignal);

        return reserveUsername(options);
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
  me.set({ username });
  dataInterface.updateConversation(me.attributes);

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
): Promise<void> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

  const { previousUsername, username, reservationToken } = reservation;

  const me = window.ConversationController.getOurConversationOrThrow();
  await updateOurUsernameAndPni();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  try {
    await server.confirmUsername({
      usernameToConfirm: username,
      reservationToken,
      abortSignal,
    });

    await updateUsernameAndSyncProfile(username);
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.code === 413) {
        const time = findRetryAfterTimeFromError(error);
        log.warn(`confirmUsername: got 413, waiting ${time}ms`);
        await sleep(time, abortSignal);

        return confirmUsername(reservation, abortSignal);
      }
    }
    throw error;
  }
}

export async function deleteUsername(
  previousUsername: string,
  abortSignal?: AbortSignal
): Promise<void> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server interface is not available!');
  }

  const me = window.ConversationController.getOurConversationOrThrow();
  await updateOurUsernameAndPni();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  await server.deleteUsername(abortSignal);
  await updateUsernameAndSyncProfile(undefined);
}
