import _, { noop } from 'lodash';
import React, { createContext, useCallback, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useDispatch, useSelector } from 'react-redux';
import { getMessageById } from '../../data/data';
import { Constants } from '../../session';
import { getConversationController } from '../../session/conversations';
import {
  fetchMessagesForConversation,
  markConversationFullyRead,
  showScrollToBottomButton,
} from '../../state/ducks/conversations';
import {
  areMoreMessagesBeingFetched,
  getHaveDoneFirstScroll,
  getLoadedMessagesLength,
  getMostRecentMessageId,
  getOldestMessageId,
  getSelectedConversationKey,
} from '../../state/selectors/conversations';
import { getIsAppFocused } from '../../state/selectors/section';

type ReadableMessageProps = {
  children: React.ReactNode;
  messageId: string;
  className?: string;
  receivedAt: number | undefined;
  isUnread: boolean;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void;
};

const debouncedTriggerLoadMore = _.debounce(
  (loadedMessagesLength: number, selectedConversationKey: string | undefined) => {
    const numMessages = loadedMessagesLength + Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
    (window.inboxStore?.dispatch as any)(
      fetchMessagesForConversation({
        conversationKey: selectedConversationKey as string,
        count: numMessages,
      })
    );
  },
  100
);

export const IsMessageVisibleContext = createContext(false);

export const ReadableMessage = (props: ReadableMessageProps) => {
  const { messageId, onContextMenu, className, receivedAt, isUnread } = props;

  const isAppFocused = useSelector(getIsAppFocused);
  const dispatch = useDispatch();
  //         onVisible={haveDoneFirstScrollProp ? onVisible : noop}

  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const loadedMessagesLength = useSelector(getLoadedMessagesLength);
  const haveDoneFirstScroll = useSelector(getHaveDoneFirstScroll);
  const mostRecentMessageId = useSelector(getMostRecentMessageId);
  const oldestMessageId = useSelector(getOldestMessageId);
  const fetchingMore = useSelector(areMoreMessagesBeingFetched);
  const shouldMarkReadWhenVisible = isUnread;

  const [isMessageVisible, setMessageIsVisible] = useState(false);

  const onVisible = useCallback(
    // tslint:disable-next-line: cyclomatic-complexity
    async (inView: boolean | Object) => {
      // when the view first loads, it needs to scroll to the unread messages.
      // we need to disable the inview on the first loading
      if (!haveDoneFirstScroll) {
        if (inView === true) {
          window.log.info('onVisible but waiting for first scroll event');
        }
        return;
      }
      // we are the most recent message
      if (mostRecentMessageId === messageId) {
        // make sure the app is focused, because we mark message as read here
        if (inView === true && isAppFocused) {
          dispatch(showScrollToBottomButton(false));
          void getConversationController()
            .get(selectedConversationKey as string)
            ?.markRead(receivedAt || 0)
            .then(() => {
              dispatch(markConversationFullyRead(selectedConversationKey as string));
            });
        } else if (inView === false) {
          dispatch(showScrollToBottomButton(true));
        }
      }

      if (inView === true && isAppFocused && oldestMessageId === messageId && !fetchingMore) {
        debouncedTriggerLoadMore(loadedMessagesLength, selectedConversationKey);
      }

      // this part is just handling the marking of the message as read if needed
      if (
        (inView === true ||
          ((inView as any).type === 'focus' && (inView as any).returnValue === true)) &&
        isAppFocused
      ) {
        if (isMessageVisible !== true) {
          setMessageIsVisible(true);
        }
        if (shouldMarkReadWhenVisible) {
          const found = await getMessageById(messageId);

          if (found && Boolean(found.get('unread'))) {
            // mark the message as read.
            // this will trigger the expire timer.
            await found.markRead(Date.now());
          }
        }
      }
    },
    [
      selectedConversationKey,
      haveDoneFirstScroll,
      mostRecentMessageId,
      oldestMessageId,
      fetchingMore,
      isAppFocused,
      loadedMessagesLength,
      receivedAt,
      shouldMarkReadWhenVisible,
      messageId,
      debouncedTriggerLoadMore,
    ]
  );

  return (
    // tslint:disable-next-line: use-simple-attributes
    <InView
      id={`msg-${messageId}`}
      onContextMenu={onContextMenu}
      className={className}
      as="div"
      threshold={0.5}
      delay={haveDoneFirstScroll && isAppFocused ? 100 : 200}
      onChange={haveDoneFirstScroll && isAppFocused ? onVisible : noop}
      triggerOnce={false}
      trackVisibility={true}
    >
      <IsMessageVisibleContext.Provider value={isMessageVisible}>
        {props.children}
      </IsMessageVisibleContext.Provider>
    </InView>
  );
};
