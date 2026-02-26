// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { orderBy } from 'lodash';
import { getIntl } from '../selectors/user.std.js';
import {
  getConversationSelector,
  getPinnedMessages,
  getMessages,
  getConversationIsReady,
} from '../selectors/conversations.dom.js';
import { getSelectedConversationId } from '../selectors/nav.std.js';
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
  canPinMessages as getCanPinMessages,
  getMessagePropsSelector,
  type MessagePropsType,
} from '../selectors/message.preload.js';
import * as Attachment from '../../util/Attachment.std.js';
import * as MIME from '../../types/MIME.std.js';
import * as EmbeddedContact from '../../types/EmbeddedContact.std.js';
import type { StateSelector } from '../types.std.js';
import { useNavActions } from '../ducks/nav.std.js';

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

function isPinMessageViewOnceMedia(props: MessagePropsType): boolean {
  return props.isTapToView ?? false;
}

function getPinMessage(
  props: MessagePropsType,
  sentAtTimestamp: number,
  receivedAtCounter: number
): PinMessage {
  return {
    id: props.id,
    sentAtTimestamp,
    receivedAtCounter,
    text: getPinMessageText(props),
    attachment: getPinMessageAttachment(props),
    contact: getPinMessageContact(props),
    payment: isPinMessagePayment(props),
    poll: getPinMessagePoll(props),
    sticker: isPinMessageSticker(props),
    viewOnceMedia: isPinMessageViewOnceMedia(props),
  };
}

function getPinSender(props: MessagePropsType): PinSender {
  return {
    id: props.author.id,
    title: props.author.title,
    isMe: props.author.isMe,
  };
}

function getLastPinId(pins: ReadonlyArray<Pin>): PinnedMessageId | null {
  return pins.at(-1)?.id ?? null;
}

function getPrevPinId(
  pins: ReadonlyArray<Pin>,
  pinnedMessageId: PinnedMessageId
): PinnedMessageId | null {
  let prev: Pin | null = null;
  for (const pin of pins) {
    if (pin.id === pinnedMessageId) {
      break;
    }
    prev = pin;
  }
  return prev?.id ?? null;
}

function getNextPinId(
  pins: ReadonlyArray<Pin>,
  pinnedMessageId: PinnedMessageId
): PinnedMessageId | null {
  let found = false;
  for (const pin of pins) {
    if (found) {
      return pin.id;
    }
    if (pin.id === pinnedMessageId) {
      found = true;
    }
  }
  return null;
}

const selectPins: StateSelector<ReadonlyArray<Pin>> = createSelector(
  getPinnedMessages,
  getMessages,
  getMessagePropsSelector,
  (pinnedMessages, messagesLookup, messagePropsSelector) => {
    return pinnedMessages.map((pinnedMessage): Pin => {
      const message = messagesLookup[pinnedMessage.messageId];
      strictAssert(message != null, 'Missing pinned message');
      const messageProps = messagePropsSelector(message);

      return {
        id: pinnedMessage.id,
        sender: getPinSender(messageProps),
        message: getPinMessage(
          messageProps,
          message.sent_at,
          message.received_at
        ),
      };
    });
  }
);

function isHTMLElement(node: Node): node is HTMLElement {
  return node instanceof HTMLElement;
}

function getNodeDataMessageId(node: Node): string | null {
  if (isHTMLElement(node)) {
    return node.dataset.messageId ?? null;
  }
  return null;
}

function useTimelineIntersectionObserver(
  unsortedPins: ReadonlyArray<Pin>,
  onCurrentChange: (current: PinnedMessageId) => void
) {
  const onCurrentChangeRef = useRef(onCurrentChange);
  useEffect(() => {
    onCurrentChangeRef.current = onCurrentChange;
  }, [onCurrentChange]);

  useEffect(() => {
    // We only need to track anything if there are multiple pins
    if (unsortedPins.length <= 1) {
      return;
    }

    const pins = orderBy<Pin>(
      unsortedPins,
      [
        pin => pin.message.receivedAtCounter,
        pin => pin.message.sentAtTimestamp,
      ],
      ['ASC', 'ASC']
    );

    const scroller = document.querySelector(
      '.module-timeline__messages__container'
    );
    strictAssert(scroller != null, 'Missing timeline scroller element');
    const messagesList = document.querySelector('.module-timeline__messages');
    strictAssert(
      messagesList != null,
      'Missing timeline messages list element'
    );

    const pinnedMessageIdsByMessageIds = new Map<string, PinnedMessageId>();
    for (const pin of pins) {
      pinnedMessageIdsByMessageIds.set(pin.message.id, pin.id);
    }

    const pinnedMessageIdVisibility = new Map<PinnedMessageId, boolean>();

    const intersectionObserver = new IntersectionObserver(
      entries => {
        const changesByPinnedMessageId = new Map<
          PinnedMessageId,
          IntersectionObserverEntry
        >();

        const sortedEntries = entries.toSorted((a, b) => {
          return b.boundingClientRect.bottom - a.boundingClientRect.bottom;
        });

        for (const entry of sortedEntries) {
          const messageId = getNodeDataMessageId(entry.target);
          strictAssert(messageId != null, 'Missing node messageId');
          const pinnedMessageId = pinnedMessageIdsByMessageIds.get(messageId);
          strictAssert(pinnedMessageId != null, 'Message is not pinned');

          const prevVisible = pinnedMessageIdVisibility.get(pinnedMessageId);
          const isVisible = entry.isIntersecting;

          if (prevVisible != null && prevVisible !== isVisible) {
            changesByPinnedMessageId.set(pinnedMessageId, entry);
          }

          pinnedMessageIdVisibility.set(pinnedMessageId, isVisible);
        }

        let currentPinId: PinnedMessageId | null = null;

        for (const [pinnedMessageId, entry] of changesByPinnedMessageId) {
          strictAssert(entry.rootBounds != null, 'Missing rootBounds');
          const { top, bottom } = entry.boundingClientRect;

          if (top > entry.rootBounds.bottom) {
            // entry is below scroll area, show prev pin
            currentPinId = getPrevPinId(pins, pinnedMessageId);
            break; // don't check lower pins
          }

          if (bottom < entry.rootBounds.top) {
            // entry is above scroll area, show next pin if visible
            const nextPinId = getNextPinId(pins, pinnedMessageId);
            if (nextPinId != null && pinnedMessageIdVisibility.get(nextPinId)) {
              currentPinId = nextPinId;
            }
            continue;
          }

          // entry is intersecting with scroll area, show it
          currentPinId = pinnedMessageId;
          break; // don't show further pins
        }

        if (currentPinId != null) {
          onCurrentChangeRef.current(currentPinId);
        }
      },
      { root: scroller }
    );

    function added(node: Node, messageId: string | null) {
      if (messageId == null || !isHTMLElement(node)) {
        return;
      }
      const pinnedMessageId = pinnedMessageIdsByMessageIds.get(messageId);
      if (pinnedMessageId == null) {
        return;
      }

      intersectionObserver.observe(node);
    }

    function removed(node: Node, messageId: string | null) {
      if (messageId == null || !isHTMLElement(node)) {
        return;
      }
      const pinnedMessageId = pinnedMessageIdsByMessageIds.get(messageId);
      if (pinnedMessageId == null) {
        return;
      }

      pinnedMessageIdVisibility.delete(pinnedMessageId);
      intersectionObserver.unobserve(node);
    }

    const mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          removed(mutation.target, mutation.oldValue ?? '');
          added(mutation.target, getNodeDataMessageId(mutation.target));
        } else if (mutation.type === 'childList') {
          for (const removedNode of mutation.removedNodes) {
            removed(removedNode, getNodeDataMessageId(removedNode));
          }
          for (const addedNode of mutation.addedNodes) {
            added(addedNode, getNodeDataMessageId(addedNode));
          }
        }
      }
    });

    mutationObserver.observe(messagesList, {
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-message-id'],
    });

    for (const child of messagesList.children) {
      added(child, getNodeDataMessageId(child));
    }

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [unsortedPins]);
}

export const SmartPinnedMessagesBar = memo(function SmartPinnedMessagesBar() {
  const i18n = useSelector(getIntl);
  const conversationId = useSelector(getSelectedConversationId);
  strictAssert(
    conversationId != null,
    'PinnedMessagesBar should only be rendered in selected conversation'
  );

  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(conversationId);
  strictAssert(conversation != null, 'Missing conversation');

  const conversationIsReady = useSelector(getConversationIsReady);
  const pins = useSelector(selectPins);
  const canPinMessages = getCanPinMessages(conversation);

  const { onPinnedMessageRemove, scrollToMessage } = useConversationsActions();
  const { pushPanelForConversation } = useNavActions();

  const [current, setCurrent] = useState(() => {
    return getLastPinId(pins);
  });

  const [prevPins, setPrevPins] = useState(pins);
  if (pins !== prevPins) {
    // Needed for `expectedCurrent` which might update `current` in the same render
    setPrevPins(pins);
  }

  const expectedCurrent = useMemo(() => {
    const latestPinId = getLastPinId(pins);

    // If `current` is null, use the latest pin id if we have one.
    if (current == null) {
      return latestPinId;
    }

    // If `current` is already the latest pin id, leave it.
    if (current === latestPinId) {
      return current;
    }

    // Update `current` if it no longer exists.
    const hasCurrent = pins.some(pin => pin.id === current);
    if (!hasCurrent) {
      return latestPinId;
    }

    // Update `current` if it was previously the latest and there's a new latest.
    const prevLatestPinId = getLastPinId(prevPins);
    if (prevLatestPinId === current && latestPinId != null) {
      return latestPinId;
    }

    return current;
  }, [current, pins, prevPins]);

  if (current !== expectedCurrent) {
    setCurrent(expectedCurrent);
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
      if (current == null) {
        return;
      }

      const updatedCurrent = getPrevPinId(pins, current) ?? getLastPinId(pins);
      if (updatedCurrent != null) {
        setCurrent(updatedCurrent);
      }
    },
    [scrollToMessage, conversationId, pins, current]
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

  useTimelineIntersectionObserver(pins, nextCurrent => {
    setCurrent(nextCurrent);
  });

  if (!conversationIsReady) {
    return null;
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
      canPinMessages={canPinMessages}
    />
  );
});
