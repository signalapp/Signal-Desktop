// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk } from 'lodash';
import type { LoggerType } from '../../logging/log';
import { getSendOptions } from '../../util/getSendOptions';
import { handleMessageSend, SendTypesType } from '../../util/handleMessageSend';
import { isNotNil } from '../../util/isNotNil';

import { commonShouldJobContinue } from './commonShouldJobContinue';
import { handleCommonJobRequestError } from './handleCommonJobRequestError';

const CHUNK_SIZE = 100;

export async function runReadOrViewSyncJob({
  attempt,
  isView,
  log,
  maxRetryTime,
  syncs,
  timestamp,
}: Readonly<{
  attempt: number;
  isView: boolean;
  log: LoggerType;
  maxRetryTime: number;
  syncs: ReadonlyArray<{
    messageId?: string;
    senderE164?: string;
    senderUuid?: string;
    timestamp: number;
  }>;
  timestamp: number;
}>): Promise<void> {
  let sendType: SendTypesType;
  let doSync:
    | typeof window.textsecure.messaging.syncReadMessages
    | typeof window.textsecure.messaging.syncView;
  if (isView) {
    sendType = 'viewSync';
    doSync = window.textsecure.messaging.syncView.bind(
      window.textsecure.messaging
    );
  } else {
    sendType = 'readSync';
    doSync = window.textsecure.messaging.syncReadMessages.bind(
      window.textsecure.messaging
    );
  }

  if (!syncs.length) {
    log.info("skipping this job because there's nothing to sync");
    return;
  }

  const shouldContinue = await commonShouldJobContinue({
    attempt,
    log,
    maxRetryTime,
    timestamp,
  });
  if (!shouldContinue) {
    return;
  }

  const ourConversation = window.ConversationController.getOurConversationOrThrow();
  const sendOptions = await getSendOptions(ourConversation.attributes, {
    syncMessage: true,
  });

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
    handleCommonJobRequestError(err, log);
  }
}
