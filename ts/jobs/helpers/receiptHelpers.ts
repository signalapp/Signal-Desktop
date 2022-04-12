// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../../util/durations';
import type { LoggerType } from '../../types/Logging';
import type { Receipt, ReceiptType } from '../../types/Receipt';
import { sendReceipts } from '../../util/sendReceipts';
import { commonShouldJobContinue } from './commonShouldJobContinue';
import { handleCommonJobRequestError } from './handleCommonJobRequestError';

export const MAX_RETRY_TIME = durations.DAY;

export async function runReceiptJob({
  attempt,
  log,
  timestamp,
  receipts,
  type,
}: Readonly<{
  attempt: number;
  log: LoggerType;
  receipts: ReadonlyArray<Receipt>;
  timestamp: number;
  type: ReceiptType;
}>): Promise<void> {
  const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();

  const shouldContinue = await commonShouldJobContinue({
    attempt,
    log,
    timeRemaining,
    skipWait: false,
  });
  if (!shouldContinue) {
    return;
  }

  try {
    await sendReceipts({ log, receipts, type });
  } catch (err: unknown) {
    await handleCommonJobRequestError({ err, log, timeRemaining });
  }
}
