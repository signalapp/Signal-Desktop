// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util';
import type { ConversationAttributesType } from '../model-types';

export function sanitizeAboutText(
  text: string | undefined
): string | undefined {
  return text?.replace(/[✓✔☑√⛉⛊⛛]/g, '');
}

export function getAboutText(
  attributes: Pick<ConversationAttributesType, 'about' | 'aboutEmoji'>,
  i18n: LocalizerType = window.i18n
): string | undefined {
  const text = sanitizeAboutText(attributes.about);

  if (!text) {
    return undefined;
  }

  const emoji = attributes.aboutEmoji;

  if (!emoji) {
    return text;
  }

  return i18n('icu:message--getNotificationText--text-with-emoji', {
    text,
    emoji,
  });
}
