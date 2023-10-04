// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { BodyRange, applyRangesForText } from '../types/BodyRange';
import { extractHydratedMentions } from '../state/selectors/message';
import { findAndFormatContact } from './findAndFormatContact';
import { getNotificationDataForMessage } from './getNotificationDataForMessage';
import { isConversationAccepted } from './isConversationAccepted';
import { strictAssert } from './assert';

export function getNotificationTextForMessage(
  attributes: MessageAttributesType
): string {
  const { text, emoji } = getNotificationDataForMessage(attributes);

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

  const mentions =
    extractHydratedMentions(attributes, {
      conversationSelector: findAndFormatContact,
    }) || [];
  const spoilers = (attributes.bodyRanges || []).filter(
    range =>
      BodyRange.isFormatting(range) && range.style === BodyRange.Style.SPOILER
  ) as Array<BodyRange<BodyRange.Formatting>>;
  const modifiedText = applyRangesForText({ text, mentions, spoilers });

  // Linux emoji support is mixed, so we disable it. (Note that this doesn't touch
  //   the `text`, which can contain emoji.)
  const shouldIncludeEmoji = Boolean(emoji) && !window.Signal.OS.isLinux();
  if (shouldIncludeEmoji) {
    return window.i18n('icu:message--getNotificationText--text-with-emoji', {
      text: modifiedText,
      emoji,
    });
  }

  return modifiedText || '';
}
