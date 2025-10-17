// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import { ReadStatus } from './MessageReadStatus.std.js';

export function migrateLegacyReadStatus(
  message: Readonly<Pick<MessageAttributesType, 'readStatus'>>
): undefined | ReadStatus {
  const shouldMigrate = message.readStatus == null;
  if (!shouldMigrate) {
    return;
  }

  const legacyUnread = (message as Record<string, unknown>).unread;
  return legacyUnread ? ReadStatus.Unread : ReadStatus.Read;
}
