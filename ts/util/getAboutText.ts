// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';

export function getAboutText(
  attributes: ConversationAttributesType
): string | undefined {
  if (!attributes.about) {
    return undefined;
  }

  const emoji = attributes.aboutEmoji;
  const text = attributes.about;

  if (!emoji) {
    return text;
  }

  return window.i18n('icu:message--getNotificationText--text-with-emoji', {
    text,
    emoji,
  });
}
