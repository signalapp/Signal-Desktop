// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId.std.ts';
import { isSignalConversation } from '../util/isSignalConversation.dom.ts';

export function canConversationOnlyBeMutedAlways(conversation: {
  id: string;
  serviceId?: ServiceIdString;
}): boolean {
  return isSignalConversation(conversation);
}
