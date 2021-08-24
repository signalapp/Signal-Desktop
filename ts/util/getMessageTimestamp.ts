// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Message } from '../components/conversation/media-gallery/types/Message';

export function getMessageTimestamp(message: Message): number {
  return message.received_at_ms || message.received_at;
}
