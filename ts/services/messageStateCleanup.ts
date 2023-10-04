// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations';
import { isEnabled } from '../RemoteConfig';
import { MessageCache } from './MessageCache';

const TEN_MINUTES = 10 * durations.MINUTE;

export function initMessageCleanup(): void {
  setInterval(
    () => window.MessageCache.deleteExpiredMessages(TEN_MINUTES),
    isEnabled('desktop.messageCleanup') ? TEN_MINUTES : durations.HOUR
  );

  MessageCache.install();
}
