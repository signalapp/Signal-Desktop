// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Note: this is a dangerous import; it will break storybook
import { getRandomBytes } from '../Crypto';

import * as Bytes from '../Bytes';
import * as log from '../logging/log';

import { NOTIFICATION_PROFILE_ID_LENGTH } from './NotificationProfile';

import type { NotificationProfileIdString } from './NotificationProfile';
import type { LoggerType } from './Logging';

export function generateNotificationProfileId(): NotificationProfileIdString {
  return Bytes.toHex(
    getRandomBytes(NOTIFICATION_PROFILE_ID_LENGTH)
  ) as NotificationProfileIdString;
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
  const result = id.toUpperCase();

  if (!isNotificationProfileId(result)) {
    logger.warn(
      'Normalizing invalid notification profile id: ' +
        `${id} to ${result} in context "${context}"`
    );

    return result as unknown as NotificationProfileIdString;
  }

  return result;
}
