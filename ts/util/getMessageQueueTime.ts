// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig.js';
import { MONTH, SECOND } from './durations/index.js';
import { parseIntWithFallback } from './parseIntWithFallback.js';

export function getMessageQueueTime(
  reduxConfig?: RemoteConfig.ConfigMapType
): number {
  return (
    Math.max(
      parseIntWithFallback(
        RemoteConfig.getValue('global.messageQueueTimeInSeconds', reduxConfig),
        MONTH / SECOND
      ),
      MONTH / SECOND
    ) * SECOND
  );
}
