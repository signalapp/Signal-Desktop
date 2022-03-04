// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { getSource, getSourceDevice, getSourceUuid } from '../messages/helpers';

export function getMessageIdForLogging(message: MessageAttributesType): string {
  const account = getSourceUuid(message) || getSource(message);
  const device = getSourceDevice(message);
  const timestamp = message.sent_at;

  return `${account}.${device} ${timestamp}`;
}
