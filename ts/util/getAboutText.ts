// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';

export function getAboutText(
  attributes: Pick<ConversationAttributesType, 'about' | 'aboutEmoji'>
): string | undefined {
  const text = attributes.about;

  if (!text) {
    return undefined;
  }

  const emoji = attributes.aboutEmoji;

  if (!emoji) {
    return text;
  }

  return window.i18n('icu:message--getNotificationText--text-with-emoji', {
    text,
    emoji,
  });
}
