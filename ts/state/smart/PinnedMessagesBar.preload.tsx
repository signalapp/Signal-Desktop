// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { getIntl } from '../selectors/user.std.js';
import { getSelectedConversationId } from '../selectors/conversations.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import type {
  Pin,
  PinMessage,
  PinMessageAttachment,
  PinMessageContact,
  PinMessagePoll,
  PinMessageText,
  PinSender,
} from '../../components/conversation/pinned-messages/PinnedMessagesBar.dom.js';
import { PinnedMessagesBar } from '../../components/conversation/pinned-messages/PinnedMessagesBar.dom.js';
import { PanelType } from '../../types/Panels.std.js';
import type { PinnedMessageId } from '../../types/PinnedMessage.std.js';
import {
  getMessagePropsSelector,
  type MessagePropsType,
} from '../selectors/message.preload.js';
import * as Attachment from '../../util/Attachment.std.js';
import * as MIME from '../../types/MIME.std.js';
import * as EmbeddedContact from '../../types/EmbeddedContact.std.js';
import type { StateSelector } from '../types.std.js';
import { usePinnedMessagesActions } from '../ducks/pinnedMessages.preload.js';
import { getPinnedMessages } from '../selectors/pinnedMessages.dom.js';

function getPinMessageAttachment(
  props: MessagePropsType
): PinMessageAttachment | null {
  const attachment = props.attachments?.at(0);
  if (attachment == null) {
    return null;
  }
  const { contentType } = attachment;
  if (contentType === MIME.IMAGE_GIF || Attachment.isGIF([attachment])) {
    return { type: 'gif' };
  }
  if (Attachment.isImage([attachment])) {
    return { type: 'image', url: attachment.thumbnail?.url ?? null };
  }
  if (Attachment.isVideo([attachment])) {
    return { type: 'video', url: attachment.thumbnail?.url ?? null };
  }
  if (Attachment.isVoiceMessage(attachment)) {
    return { type: 'voiceMessage' };
  }
  return { type: 'file', name: attachment.fileName ?? null };
}

function getPinMessageText(props: MessagePropsType): PinMessageText | null {
  if (props.text == null) {
    return null;
  }
  return { body: props.text, bodyRanges: props.bodyRanges ?? [] };
}

function getPinMessageContact(
  props: MessagePropsType
): PinMessageContact | null {
  if (props.contact == null) {
    return null;
  }

  return {
    name: EmbeddedContact.getDisplayName(props.contact) ?? null,
  };
}

function isPinMessagePayment(props: MessagePropsType): boolean {
  return props.payment != null;
}

function getPinMessagePoll(props: MessagePropsType): PinMessagePoll | null {
  if (props.poll == null) {
    return null;
  }
  return {
    question: props.poll.question,
  };
}

function isPinMessageSticker(props: MessagePropsType): boolean {
  return props.isSticker ?? false;
}

function getPinMessage(props: MessagePropsType): PinMessage {
  return {
    id: props.id,
    text: getPinMessageText(props),
    attachment: getPinMessageAttachment(props),
    contact: getPinMessageContact(props),
    payment: isPinMessagePayment(props),
    poll: getPinMessagePoll(props),
    sticker: isPinMessageSticker(props),
  };
}

function getPinSender(props: MessagePropsType): PinSender {
  return {
    id: props.author.id,
    title: props.author.title,
    isMe: props.author.isMe,
  };
}

const selectPins: StateSelector<ReadonlyArray<Pin>> = createSelector(
  getPinnedMessages,
  getMessagePropsSelector,
  (pinnedMessages, messagePropsSelector) => {
    return pinnedMessages.map((pinnedMessageRenderData): Pin => {
      const { pinnedMessage, message } = pinnedMessageRenderData;
      const messageProps = messagePropsSelector(message);

      return {
        id: pinnedMessage.id,
        sender: getPinSender(messageProps),
        message: getPinMessage(messageProps),
      };
    });
  }
);

export const SmartPinnedMessagesBar = memo(function SmartPinnedMessagesBar() {
  const i18n = useSelector(getIntl);
  const conversationId = useSelector(getSelectedConversationId);
  const pins = useSelector(selectPins);

  strictAssert(
    conversationId != null,
    'PinnedMessagesBar should only be rendered in selected conversation'
  );

  const { pushPanelForConversation, scrollToMessage } =
    useConversationsActions();
  const { onPinnedMessageRemove } = usePinnedMessagesActions();

  const [current, setCurrent] = useState(() => {
    return pins.at(0)?.id ?? null;
  });

  const isCurrentOutOfDate = useMemo(() => {
    if (current == null) {
      if (pins.length > 0) {
        return true;
      }
      return false;
    }

    const hasMatch = pins.some(pin => {
      return pin.id === current;
    });

    return !hasMatch;
  }, [current, pins]);

  if (isCurrentOutOfDate) {
    setCurrent(pins.at(0)?.id ?? null);
  }

  const handleCurrentChange = useCallback(
    (pinnedMessageId: PinnedMessageId) => {
      setCurrent(pinnedMessageId);
    },
    []
  );

  const handlePinGoTo = useCallback(
    (messageId: string) => {
      scrollToMessage(conversationId, messageId);
    },
    [scrollToMessage, conversationId]
  );

  const handlePinRemove = useCallback(
    (messageId: string) => {
      onPinnedMessageRemove(messageId);
    },
    [onPinnedMessageRemove]
  );

  const handlePinsShowAll = useCallback(() => {
    pushPanelForConversation({
      type: PanelType.PinnedMessages,
    });
  }, [pushPanelForConversation]);

  if (current == null) {
    return;
  }

  return (
    <PinnedMessagesBar
      i18n={i18n}
      pins={pins}
      current={current}
      onCurrentChange={handleCurrentChange}
      onPinGoTo={handlePinGoTo}
      onPinRemove={handlePinRemove}
      onPinsShowAll={handlePinsShowAll}
    />
  );
});
