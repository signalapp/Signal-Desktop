// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk } from 'lodash';
import * as log from '../../logging/log';
import { waitForOnline } from '../../util/waitForOnline';
import { getSendOptions } from '../../util/getSendOptions';
import { handleMessageSend, SendTypesType } from '../../util/handleMessageSend';
import { isNotNil } from '../../util/isNotNil';
import { sleep } from '../../util/sleep';
import { exponentialBackoffSleepTime } from '../../util/exponentialBackoff';
import { isDone as isDeviceLinked } from '../../util/registration';
import { parseIntWithFallback } from '../../util/parseIntWithFallback';

const CHUNK_SIZE = 100;

export async function runReadOrViewSyncJob({
  attempt,
  isView,
  maxRetryTime,
  syncs,
  timestamp,
}: Readonly<{
  attempt: number;
  isView: boolean;
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
  let nameForLogging: string;
  let doSync:
    | typeof window.textsecure.messaging.syncReadMessages
    | typeof window.textsecure.messaging.syncView;
  if (isView) {
    sendType = 'viewSync';
    nameForLogging = 'viewSyncJobQueue';
    doSync = window.textsecure.messaging.syncView.bind(
      window.textsecure.messaging
    );
  } else {
    sendType = 'readSync';
    nameForLogging = 'readSyncJobQueue';
    doSync = window.textsecure.messaging.syncReadMessages.bind(
      window.textsecure.messaging
    );
  }

  const logInfo = (message: string): void => {
    log.info(`${nameForLogging}: ${message}`);
  };

  if (!syncs.length) {
    logInfo("skipping this job because there's nothing to sync");
    return;
  }

  const maxJobAge = timestamp + maxRetryTime;
  const timeRemaining = maxJobAge - Date.now();

  if (timeRemaining <= 0) {
    logInfo("giving up because it's been too long");
    return;
  }

  try {
    await waitForOnline(window.navigator, window, { timeout: timeRemaining });
  } catch (err) {
    logInfo("didn't come online in time, giving up");
    return;
  }

  await new Promise<void>(resolve => {
    window.storage.onready(resolve);
  });

  if (!isDeviceLinked()) {
    logInfo("skipping this job because we're unlinked");
    return;
  }

  await sleep(exponentialBackoffSleepTime(attempt));

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
    if (!(err instanceof Error)) {
      throw err;
    }

    const code = parseIntWithFallback(err.code, -1);
    if (code === 508) {
      logInfo('server responded with 508. Giving up on this job');
      return;
    }

    throw err;
  }
}
