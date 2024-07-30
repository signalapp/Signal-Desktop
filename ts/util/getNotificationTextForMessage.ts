// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { applyRangesToText, hydrateRanges } from '../types/BodyRange';
import { findAndFormatContact } from './findAndFormatContact';
import { getNotificationDataForMessage } from './getNotificationDataForMessage';
import { isConversationAccepted } from './isConversationAccepted';
import { strictAssert } from './assert';

export function getNotificationTextForMessage(
  attributes: ReadonlyMessageAttributesType
): string {
  const { text, emoji, bodyRanges } = getNotificationDataForMessage(attributes);

  const conversation = window.ConversationController.get(
    attributes.conversationId
  );

  strictAssert(
    conversation != null,
    'Conversation not found in ConversationController'
  );

  if (!isConversationAccepted(conversation.attributes)) {
    return window.i18n('icu:message--getNotificationText--messageRequest');
  }

  if (attributes.storyReaction) {
    if (attributes.type === 'outgoing') {
      const { profileName: name } = conversation.attributes;

      if (!name) {
        return window.i18n(
          'icu:Quote__story-reaction-notification--outgoing--nameless',
          {
            emoji: attributes.storyReaction.emoji,
          }
        );
      }

      return window.i18n('icu:Quote__story-reaction-notification--outgoing', {
        emoji: attributes.storyReaction.emoji,
        name,
      });
    }

    const ourAci = window.textsecure.storage.user.getCheckedAci();

    if (
      attributes.type === 'incoming' &&
      attributes.storyReaction.targetAuthorAci === ourAci
    ) {
      return window.i18n('icu:Quote__story-reaction-notification--incoming', {
        emoji: attributes.storyReaction.emoji,
      });
    }

    if (!window.Signal.OS.isLinux()) {
      return attributes.storyReaction.emoji;
    }

    return window.i18n('icu:Quote__story-reaction--single');
  }

  const result = applyRangesToText(
    {
      body: text,
      bodyRanges: hydrateRanges(bodyRanges, findAndFormatContact) ?? [],
    },
    { replaceMentions: true, replaceSpoilers: true }
  );

  // Linux emoji support is mixed, so we disable it. (Note that this doesn't touch
  //   the `text`, which can contain emoji.)
  const shouldIncludeEmoji = Boolean(emoji) && !window.Signal.OS.isLinux();
  if (shouldIncludeEmoji) {
    return window.i18n('icu:message--getNotificationText--text-with-emoji', {
      text: result.body,
      emoji: emoji ?? '',
    });
  }

  return result.body ?? '';
}
