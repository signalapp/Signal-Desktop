// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { missingCaseError } from './missingCaseError.std.js';

export function isConversationNameKnown(
  conversation: Readonly<
    Pick<ConversationType, 'e164' | 'name' | 'profileName' | 'type'>
  >
): boolean {
  switch (conversation.type) {
    case 'direct':
      return Boolean(
        conversation.name || conversation.profileName || conversation.e164
      );
    case 'group':
      return Boolean(conversation.name);
    default:
      throw missingCaseError(conversation.type);
  }
}
