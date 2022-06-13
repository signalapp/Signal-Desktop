// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk } from 'lodash';
import type { LoggerType } from '../../types/Logging';
import { getSendOptions } from '../../util/getSendOptions';
import type { SendTypesType } from '../../util/handleMessageSend';
import { handleMessageSend } from '../../util/handleMessageSend';
import { isNotNil } from '../../util/isNotNil';
import { strictAssert } from '../../util/assert';
import { isRecord } from '../../util/isRecord';

import { commonShouldJobContinue } from './commonShouldJobContinue';
import { handleCommonJobRequestError } from './handleCommonJobRequestError';
import { missingCaseError } from '../../util/missingCaseError';
import type SendMessage from '../../textsecure/SendMessage';

const CHUNK_SIZE = 100;

export type SyncType = {
  messageId?: string;
  senderE164?: string;
  senderUuid?: string;
  timestamp: number;
};
export enum SyncTypeList {
  Read = 'Read',
  View = 'View',
  ViewOnceOpen = 'ViewOnceOpen',
}

/**
 * Parse what _should_ be an array of `SyncType`s.
 *
 * Notably, `null`s made it into the job system and caused jobs to fail. This cleans that
 * up in addition to validating the data.
 */
export function parseRawSyncDataArray(value: unknown): Array<SyncType> {
  strictAssert(Array.isArray(value), 'syncs are not an array');
  return value.map((item: unknown) => {
    strictAssert(isRecord(item), 'sync is not an object');

    const { messageId, senderE164, senderUuid, timestamp } = item;
    strictAssert(typeof timestamp === 'number', 'timestamp should be a number');

    return {
      messageId: parseOptionalString('messageId', messageId),
      senderE164: parseOptionalString('senderE164', senderE164),
      senderUuid: parseOptionalString('senderUuid', senderUuid),
      timestamp,
    };
  });
}

function parseOptionalString(name: string, value: unknown): undefined | string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  throw new Error(`${name} was not a string`);
}

export async function runSyncJob({
  attempt,
  type,
  log,
  maxRetryTime,
  syncs,
  timestamp,
}: Readonly<{
  attempt: number;
  type: SyncTypeList;
  log: LoggerType;
  maxRetryTime: number;
  syncs: ReadonlyArray<SyncType>;
  timestamp: number;
}>): Promise<void> {
  if (!syncs.length) {
    log.info("skipping this job because there's nothing to sync");
    return;
  }

  let sendType: SendTypesType;
  switch (type) {
    case SyncTypeList.View:
      sendType = 'viewSync';
      break;
    case SyncTypeList.Read:
      sendType = 'readSync';
      break;
    case SyncTypeList.ViewOnceOpen:
      sendType = 'viewOnceSync';
      break;
    default: {
      throw missingCaseError(type);
    }
  }

  const syncTimestamps = syncs.map(sync => sync.timestamp);
  log.info(
    `sending ${sendType}(s) for timestamp(s) ${syncTimestamps.join(', ')}`
  );

  const timeRemaining = timestamp + maxRetryTime - Date.now();

  const shouldContinue = await commonShouldJobContinue({
    attempt,
    log,
    timeRemaining,
    skipWait: false,
  });
  if (!shouldContinue) {
    return;
  }

  await window.ConversationController.load();

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();
  const sendOptions = await getSendOptions(ourConversation.attributes, {
    syncMessage: true,
  });

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('messaging is not available!');
  }

  let doSync:
    | SendMessage['syncReadMessages']
    | SendMessage['syncView']
    | SendMessage['syncViewOnceOpen'];
  switch (type) {
    case SyncTypeList.View:
      doSync = messaging.syncView.bind(messaging);
      break;
    case SyncTypeList.Read:
      doSync = messaging.syncReadMessages.bind(messaging);
      break;
    case SyncTypeList.ViewOnceOpen:
      doSync = messaging.syncViewOnceOpen.bind(messaging);
      break;
    default: {
      throw missingCaseError(type);
    }
  }

  try {
    await Promise.all(
      chunk(syncs, CHUNK_SIZE).map(batch => {
        const messageIds = batch.map(item => item.messageId).filter(isNotNil);

        return handleMessageSend(doSync(batch, sendOptions), {
          messageIds,
          sendType,
        });
      })
    );
  } catch (err: unknown) {
    await handleCommonJobRequestError({ err, log, timeRemaining });
  }
}
