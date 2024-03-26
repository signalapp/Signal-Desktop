import { debounce, noop } from 'lodash';
import React, { AriaRole, MouseEventHandler, useCallback, useLayoutEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useDispatch, useSelector } from 'react-redux';
import { useScrollToLoadedMessage } from '../../../../contexts/ScrollToLoadedMessage';
import { Data } from '../../../../data/data';
import { useHasUnread } from '../../../../hooks/useParamSelector';
import { getConversationController } from '../../../../session/conversations';
import {
  fetchBottomMessagesForConversation,
  fetchTopMessagesForConversation,
  markConversationFullyRead,
  showScrollToBottomButton,
} from '../../../../state/ducks/conversations';
import {
  areMoreMessagesBeingFetched,
  getMostRecentMessageId,
  getOldestMessageId,
  getQuotedMessageToAnimate,
  getShowScrollButton,
  getYoungestMessageId,
} from '../../../../state/selectors/conversations';
import { getIsAppFocused } from '../../../../state/selectors/section';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';

export type ReadableMessageProps = {
  children: React.ReactNode;
  messageId: string;
  className?: string;
  receivedAt: number | undefined;
  isUnread: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onDoubleClickCapture?: MouseEventHandler<HTMLElement>;
  role?: AriaRole;
  dataTestId: string;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void;
  isControlMessage?: boolean;
};

const debouncedTriggerLoadMoreTop = debounce(
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

const debouncedTriggerLoadMoreBottom = debounce(
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
  const {
    messageId,
    onContextMenu,
    className,
    receivedAt,
    isUnread,
    onClick,
    onDoubleClickCapture,
    role,
    dataTestId,
  } = props;

  const isAppFocused = useSelector(getIsAppFocused);
  const dispatch = useDispatch();

  const selectedConversationKey = useSelectedConversationKey();
  const mostRecentMessageId = useSelector(getMostRecentMessageId);
  const oldestMessageId = useSelector(getOldestMessageId);
  const youngestMessageId = useSelector(getYoungestMessageId);
  const fetchingMoreInProgress = useSelector(areMoreMessagesBeingFetched);
  const conversationHasUnread = useHasUnread(selectedConversationKey);
  const scrollButtonVisible = useSelector(getShowScrollButton);

  const [didScroll, setDidScroll] = useState(false);
  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);

  const scrollToLoadedMessage = useScrollToLoadedMessage();

  // if this unread-indicator is rendered,
  // we want to scroll here only if the conversation was not opened to a specific message
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    async (inView: boolean, _: IntersectionObserverEntry) => {
      if (!selectedConversationKey) {
        return;
      }
      // we are the most recent message
      if (mostRecentMessageId === messageId) {
        // make sure the app is focused, because we mark message as read here
        if (inView === true && isAppFocused) {
          dispatch(showScrollToBottomButton(false));
          getConversationController()
            .get(selectedConversationKey)
            ?.markConversationRead({ newestUnreadDate: receivedAt || 0, fromConfigMessage: false }); // TODOLATER this should be `sentAt || serverTimestamp` I think

          dispatch(markConversationFullyRead(selectedConversationKey));
        } else if (inView === false) {
          dispatch(showScrollToBottomButton(true));
        }
      }

      if (inView && isAppFocused && oldestMessageId === messageId && !fetchingMoreInProgress) {
        debouncedTriggerLoadMoreTop(selectedConversationKey, oldestMessageId);
      }

      if (inView && isAppFocused && youngestMessageId === messageId && !fetchingMoreInProgress) {
        debouncedTriggerLoadMoreBottom(selectedConversationKey, youngestMessageId);
      }

      // this part is just handling the marking of the message as read if needed
      if (inView) {
        if (isUnread) {
          // TODOLATER this is pretty expensive and should instead use values from the redux store
          const found = await Data.getMessageById(messageId);

          if (found && Boolean(found.get('unread'))) {
            const foundSentAt = found.get('sent_at') || found.get('serverTimestamp');
            // we should stack those and send them in a single message once every 5secs or something.
            // this would be part of an redesign of the sending pipeline
            // mark the whole conversation as read until this point.
            // this will trigger the expire timer.
            if (foundSentAt) {
              getConversationController()
                .get(selectedConversationKey)
                ?.markConversationRead({ newestUnreadDate: foundSentAt, fromConfigMessage: false });
            }
          }
        }
      }
    },
    [
      dispatch,
      selectedConversationKey,
      mostRecentMessageId,
      oldestMessageId,
      fetchingMoreInProgress,
      isAppFocused,
      receivedAt,
      messageId,
      isUnread,
      youngestMessageId,
    ]
  );

  return (
    <InView
      id={`msg-${messageId}`}
      onContextMenu={onContextMenu}
      className={className}
      as="div"
      threshold={0.5} // consider that more than 50% of the message visible means it is read
      delay={isAppFocused ? 100 : 200}
      onChange={isAppFocused ? onVisible : noop}
      triggerOnce={false}
      trackVisibility={true}
      onClick={onClick}
      onDoubleClickCapture={onDoubleClickCapture}
      role={role}
      key={`inview-msg-${messageId}`}
      data-testid={dataTestId}
    >
      {props.children}
    </InView>
  );
};
