// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Note: this is a dangerous import; it will break storybook
import { getRandomBytes } from '../Crypto.node.js';

import * as Bytes from '../Bytes.std.js';
import { createLogger } from '../logging/log.std.js';

import { NOTIFICATION_PROFILE_ID_LENGTH } from './NotificationProfile.std.js';

import type { NotificationProfileIdString } from './NotificationProfile.std.js';
import type { LoggerType } from './Logging.std.js';

const log = createLogger('NotificationProfile-node');

export function generateNotificationProfileId(): NotificationProfileIdString {
  return normalizeNotificationProfileId(
    Bytes.toHex(getRandomBytes(NOTIFICATION_PROFILE_ID_LENGTH)),
    'generateNotificationProfileId'
  );
}

export function isNotificationProfileId(
  value?: string
): value is NotificationProfileIdString {
  if (!value) {
    return false;
  }

  const bytes = Bytes.fromHex(value);
  return bytes.byteLength === NOTIFICATION_PROFILE_ID_LENGTH;
}

export function normalizeNotificationProfileId(
  id: string,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): NotificationProfileIdString {
  const result = id.toLowerCase();

  if (!isNotificationProfileId(result)) {
    logger.warn(
      'Normalizing invalid notification profile id: ' +
        `${id} to ${result} in context "${context}"`
    );

    return result as unknown as NotificationProfileIdString;
  }

  return result;
}
