// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util';

export function getStringForConversationMerge({
  obsoleteConversationTitle,
  conversationTitle,
  i18n,
}: {
  obsoleteConversationTitle: string | undefined;
  conversationTitle: string;
  i18n: LocalizerType;
}): string {
  if (!obsoleteConversationTitle) {
    return i18n('icu:ConversationMerge--notification--no-e164', {
      conversationTitle,
    });
  }

  return i18n('icu:ConversationMerge--notification', {
    obsoleteConversationTitle,
    conversationTitle,
  });
}
