// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReadStatus } from '../messages/MessageReadStatus';
import type { MessageAttributesType } from '../model-types.d';

export const isMessageUnread = (
  message: Readonly<Pick<MessageAttributesType, 'readStatus'>>
): boolean => message.readStatus === ReadStatus.Unread;
