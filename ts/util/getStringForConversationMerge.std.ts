// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util.std.js';

export function getStringForConversationMerge({
  obsoleteConversationTitle,
  obsoleteConversationNumber,
  conversationTitle,
  i18n,
}: {
  obsoleteConversationTitle: string | undefined;
  obsoleteConversationNumber: string | undefined;
  conversationTitle: string;
  i18n: LocalizerType;
}): string {
  if (!obsoleteConversationTitle) {
    return i18n('icu:ConversationMerge--notification--no-title', {
      conversationTitle,
    });
  }

  if (obsoleteConversationNumber) {
    return i18n('icu:ConversationMerge--notification--with-e164', {
      conversationTitle,
      obsoleteConversationNumber,
    });
  }

  return i18n('icu:ConversationMerge--notification', {
    obsoleteConversationTitle,
    conversationTitle,
  });
}
