import _, { noop } from 'lodash';
import React, { useCallback, useContext, useLayoutEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useDispatch, useSelector } from 'react-redux';
import { getMessageById } from '../../../../data/data';
import { getConversationController } from '../../../../session/conversations';
import {
  fetchBottomMessagesForConversation,
  fetchTopMessagesForConversation,
  markConversationFullyRead,
  showScrollToBottomButton,
} from '../../../../state/ducks/conversations';
import {
  areMoreMessagesBeingFetched,
  getConversationHasUnread,
  getLoadedMessagesLength,
  getMostRecentMessageId,
  getOldestMessageId,
  getQuotedMessageToAnimate,
  getSelectedConversationKey,
  getShowScrollButton,
  getYoungestMessageId,
} from '../../../../state/selectors/conversations';
import { getIsAppFocused } from '../../../../state/selectors/section';
import { ScrollToLoadedMessageContext } from '../../SessionMessagesListContainer';

type ReadableMessageProps = {
  children: React.ReactNode;
  messageId: string;
  className?: string;
  receivedAt: number | undefined;
  isUnread: boolean;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void;
};

const debouncedTriggerLoadMoreTop = _.debounce(
  (selectedConversationKey: string, oldestMessageId: string) => {
    (window.inboxStore?.dispatch as any)(
      fetchTopMessagesForConversation({
        conversationKey: selectedConversationKey,
        oldTopMessageId: oldestMessageId,
      })
    );
  },
  100
);

const debouncedTriggerLoadMoreBottom = _.debounce(
  (selectedConversationKey: string, youngestMessageId: string) => {
    (window.inboxStore?.dispatch as any)(
      fetchBottomMessagesForConversation({
        conversationKey: selectedConversationKey,
        oldBottomMessageId: youngestMessageId,
      })
    );
  },
  100
);

export const ReadableMessage = (props: ReadableMessageProps) => {
  const { messageId, onContextMenu, className, receivedAt, isUnread } = props;

  const isAppFocused = useSelector(getIsAppFocused);
  const dispatch = useDispatch();

  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const loadedMessagesLength = useSelector(getLoadedMessagesLength);
  const mostRecentMessageId = useSelector(getMostRecentMessageId);
  const oldestMessageId = useSelector(getOldestMessageId);
  const youngestMessageId = useSelector(getYoungestMessageId);
  const fetchingMoreInProgress = useSelector(areMoreMessagesBeingFetched);
  const conversationHasUnread = useSelector(getConversationHasUnread);
  const scrollButtonVisible = useSelector(getShowScrollButton);
  const shouldMarkReadWhenVisible = isUnread;

  const [didScroll, setDidScroll] = useState(false);
  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);

  const scrollToLoadedMessage = useContext(ScrollToLoadedMessageContext);

  // if this unread-indicator is rendered,
  // we want to scroll here only if the conversation was not opened to a specific message

  useLayoutEffect(() => {
    if (
      props.messageId === youngestMessageId &&
      !quotedMessageToAnimate &&
      !scrollButtonVisible &&
      !didScroll &&
      !conversationHasUnread
    ) {
      scrollToLoadedMessage(props.messageId, 'go-to-bottom');
      setDidScroll(true);
    } else if (quotedMessageToAnimate) {
      setDidScroll(true);
    }
  });

  const onVisible = useCallback(
    // tslint:disable-next-line: cyclomatic-complexity
    async (inView: boolean | Object) => {
      // we are the most recent message
      if (mostRecentMessageId === messageId && selectedConversationKey) {
        // make sure the app is focused, because we mark message as read here
        if (inView === true && isAppFocused) {
          dispatch(showScrollToBottomButton(false));
          getConversationController()
            .get(selectedConversationKey)
            ?.markRead(receivedAt || 0);

          dispatch(markConversationFullyRead(selectedConversationKey));
        } else if (inView === false) {
          dispatch(showScrollToBottomButton(true));
        }
      }

      if (
        inView === true &&
        isAppFocused &&
        oldestMessageId === messageId &&
        !fetchingMoreInProgress &&
        selectedConversationKey
      ) {
        debouncedTriggerLoadMoreTop(selectedConversationKey, oldestMessageId);
      }

      if (
        inView === true &&
        isAppFocused &&
        youngestMessageId === messageId &&
        !fetchingMoreInProgress &&
        selectedConversationKey
      ) {
        debouncedTriggerLoadMoreBottom(selectedConversationKey, youngestMessageId);
      }

      // this part is just handling the marking of the message as read if needed
      if (
        (inView === true ||
          ((inView as any).type === 'focus' && (inView as any).returnValue === true)) &&
        isAppFocused
      ) {
        if (shouldMarkReadWhenVisible) {
          const found = await getMessageById(messageId);

          if (found && Boolean(found.get('unread'))) {
            const foundReceivedAt = found.get('received_at');
            // mark the message as read.
            // this will trigger the expire timer.
            await found.markRead(Date.now());

            // we should stack those and send them in a single message once every 5secs or something.
            // this would be part of an redesign of the sending pipeline
            if (foundReceivedAt) {
              void getConversationController()
                .get(found.id)
                ?.sendReadReceiptsIfNeeded([foundReceivedAt]);
            }
          }
        }
      }
    },
    [
      selectedConversationKey,
      mostRecentMessageId,
      oldestMessageId,
      fetchingMoreInProgress,
      isAppFocused,
      loadedMessagesLength,
      receivedAt,
      shouldMarkReadWhenVisible,
      messageId,
    ]
  );

  return (
    // tslint:disable-next-line: use-simple-attributes
    <InView
      id={`msg-${messageId}`}
      onContextMenu={onContextMenu}
      className={className}
      as="div"
      threshold={0.8}
      delay={isAppFocused ? 100 : 200}
      onChange={isAppFocused ? onVisible : noop}
      triggerOnce={false}
      trackVisibility={true}
      key={`inview-msg-${messageId}`}
      data-testid="readable-message"
    >
      {props.children}
    </InView>
  );
};
