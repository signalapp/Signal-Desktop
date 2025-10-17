// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { LoggerType } from '../../types/Logging.std.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { normalizeAci } from '../../util/normalizeAci.std.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import type { SendTypesType } from '../../util/handleMessageSend.preload.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { isNotNil } from '../../util/isNotNil.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { isRecord } from '../../util/isRecord.std.js';

import { commonShouldJobContinue } from './commonShouldJobContinue.preload.js';
import { handleCommonJobRequestError } from './handleCommonJobRequestError.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import {
  type MessageSender,
  messageSender,
} from '../../textsecure/SendMessage.preload.js';

const { chunk } = lodash;

const CHUNK_SIZE = 100;

export type SyncType = {
  messageId?: string;
  senderE164?: string;
  senderAci?: AciString;
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

    const { messageId, senderE164, timestamp } = item;
    strictAssert(typeof timestamp === 'number', 'timestamp should be a number');

    const rawSenderAci = parseOptionalString('senderAci', item.senderAci);
    const senderAci = rawSenderAci
      ? normalizeAci(rawSenderAci, 'parseRawSyncDataArray')
      : undefined;

    return {
      messageId: parseOptionalString('messageId', messageId),
      senderE164: parseOptionalString('senderE164', senderE164),
      senderAci,
      timestamp,
    };
  });
}

function parseOptionalString(name: string, value: unknown): undefined | string {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
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

  let doSync:
    | MessageSender['syncReadMessages']
    | MessageSender['syncView']
    | MessageSender['syncViewOnceOpen'];
  switch (type) {
    case SyncTypeList.View:
      doSync = messageSender.syncView.bind(messageSender);
      break;
    case SyncTypeList.Read:
      doSync = messageSender.syncReadMessages.bind(messageSender);
      break;
    case SyncTypeList.ViewOnceOpen:
      doSync = messageSender.syncViewOnceOpen.bind(messageSender);
      break;
    default: {
      throw missingCaseError(type);
    }
  }

  const aciSyncs = syncs.map(({ senderAci, ...rest }) => {
    return {
      ...rest,
      senderAci: senderAci
        ? normalizeAci(senderAci, 'syncHelpers.senderAci')
        : undefined,
    };
  });

  try {
    await Promise.all(
      chunk(aciSyncs, CHUNK_SIZE).map(batch => {
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
