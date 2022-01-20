import _, { noop } from 'lodash';
import React, { useCallback } from 'react';
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
  areMoreBottomMessagesBeingFetched,
  areMoreTopMessagesBeingFetched,
  getLoadedMessagesLength,
  getMostRecentMessageId,
  getOldestMessageId,
  getSelectedConversationKey,
  getYoungestMessageId,
} from '../../../../state/selectors/conversations';
import { getIsAppFocused } from '../../../../state/selectors/section';

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
  const fetchingTopMore = useSelector(areMoreTopMessagesBeingFetched);
  const fetchingBottomMore = useSelector(areMoreBottomMessagesBeingFetched);
  const shouldMarkReadWhenVisible = isUnread;

  const onVisible = useCallback(
    // tslint:disable-next-line: cyclomatic-complexity
    async (inView: boolean | Object) => {
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

      if (
        inView === true &&
        isAppFocused &&
        oldestMessageId === messageId &&
        !fetchingTopMore &&
        selectedConversationKey
      ) {
        debouncedTriggerLoadMoreTop(selectedConversationKey, oldestMessageId);
      }

      if (
        inView === true &&
        isAppFocused &&
        youngestMessageId === messageId &&
        !fetchingBottomMore &&
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
            // mark the message as read.
            // this will trigger the expire timer.
            await found.markRead(Date.now());
          }
        }
      }
    },
    [
      selectedConversationKey,
      mostRecentMessageId,
      oldestMessageId,
      fetchingTopMore,
      fetchingBottomMore,
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
      threshold={0.5}
      delay={isAppFocused ? 100 : 200}
      onChange={isAppFocused ? onVisible : noop}
      triggerOnce={false}
      trackVisibility={true}
      key={`inview-msg-${messageId}`}
    >
      {props.children}
    </InView>
  );
};
