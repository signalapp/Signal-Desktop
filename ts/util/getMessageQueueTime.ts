// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { MONTH, SECOND } from './durations';
import { parseIntWithFallback } from './parseIntWithFallback';

export function getMessageQueueTime(): number {
  return (
    Math.max(
      parseIntWithFallback(
        RemoteConfig.getValue('global.messageQueueTimeInSeconds'),
        MONTH / SECOND
      ),
      MONTH / SECOND
    ) * SECOND
  );
}
