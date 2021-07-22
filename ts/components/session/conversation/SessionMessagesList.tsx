import React from 'react';

import { Message } from '../../conversation/Message';
import { TimerNotification } from '../../conversation/TimerNotification';

import { SessionScrollButton } from '../SessionScrollButton';
import { Constants } from '../../../session';
import _ from 'lodash';
import { contextMenu } from 'react-contexify';
import { GroupNotification } from '../../conversation/GroupNotification';
import { GroupInvitation } from '../../conversation/GroupInvitation';
import {
  fetchMessagesForConversation,
  PropsForExpirationTimer,
  PropsForGroupInvitation,
  PropsForGroupUpdate,
  quotedMessageToAnimate,
  ReduxConversationType,
  setNextMessageToPlay,
  showScrollToBottomButton,
  SortedMessageModelProps,
} from '../../../state/ducks/conversations';
import { SessionLastSeenIndicator } from './SessionLastSeenIndicator';
import { ToastUtils } from '../../../session/utils';
import { TypingBubble } from '../../conversation/TypingBubble';
import { getConversationController } from '../../../session/conversations';
import { MessageModel } from '../../../models/message';
import {
  MessageRegularProps,
  PropsForDataExtractionNotification,
  QuoteClickOptions,
} from '../../../models/messageType';
import { getFirstUnreadMessageIdInConversation, getMessagesBySentAt } from '../../../data/data';
import autoBind from 'auto-bind';
import { ConversationTypeEnum } from '../../../models/conversation';
import { DataExtractionNotification } from '../../conversation/DataExtractionNotification';
import { StateType } from '../../../state/reducer';
import { connect, useSelector } from 'react-redux';
import {
  getSortedMessagesOfSelectedConversation,
  getNextMessageToPlayIndex,
  getQuotedMessageToAnimate,
  getSelectedConversation,
  getSelectedConversationKey,
  getShowScrollButton,
  isMessageSelectionMode,
  getFirstUnreadMessageIndex,
  areMoreMessagesBeingFetched,
  isFirstUnreadMessageIdAbove,
} from '../../../state/selectors/conversations';
import { isElectronWindowFocused } from '../../../session/utils/WindowUtils';
import useInterval from 'react-use/lib/useInterval';

export type SessionMessageListProps = {
  messageContainerRef: React.RefObject<any>;
};

type Props = SessionMessageListProps & {
  conversationKey?: string;
  messagesProps: Array<SortedMessageModelProps>;

  conversation?: ReduxConversationType;
  showScrollButton: boolean;
  animateQuotedMessageId: string | undefined;
  areMoreMessagesBeingFetched: boolean;
};

const UnreadIndicator = (props: { messageId: string; show: boolean }) => {
  if (!props.show) {
    return null;
  }
  return <SessionLastSeenIndicator key={`unread-indicator-${props.messageId}`} />;
};

const GroupUpdateItem = (props: {
  messageId: string;
  groupNotificationProps: PropsForGroupUpdate;
  showUnreadIndicator: boolean;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <GroupNotification key={props.messageId} {...props.groupNotificationProps} />
      <UnreadIndicator messageId={props.messageId} show={props.showUnreadIndicator} />
    </React.Fragment>
  );
};

const GroupInvitationItem = (props: {
  messageId: string;
  propsForGroupInvitation: PropsForGroupInvitation;
  showUnreadIndicator: boolean;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <GroupInvitation key={props.messageId} {...props.propsForGroupInvitation} />

      <UnreadIndicator messageId={props.messageId} show={props.showUnreadIndicator} />
    </React.Fragment>
  );
};

const DataExtractionNotificationItem = (props: {
  messageId: string;
  propsForDataExtractionNotification: PropsForDataExtractionNotification;
  showUnreadIndicator: boolean;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <DataExtractionNotification
        key={props.messageId}
        {...props.propsForDataExtractionNotification}
      />

      <UnreadIndicator messageId={props.messageId} show={props.showUnreadIndicator} />
    </React.Fragment>
  );
};

const TimerNotificationItem = (props: {
  messageId: string;
  timerProps: PropsForExpirationTimer;
  showUnreadIndicator: boolean;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <TimerNotification key={props.messageId} {...props.timerProps} />

      <UnreadIndicator messageId={props.messageId} show={props.showUnreadIndicator} />
    </React.Fragment>
  );
};

const GenericMessageItem = (props: {
  messageId: string;
  messageProps: SortedMessageModelProps;
  playableMessageIndex?: number;
  showUnreadIndicator: boolean;
  scrollToQuoteMessage: (options: QuoteClickOptions) => Promise<void>;
  playNextMessage?: (value: number) => void;
}) => {
  const multiSelectMode = useSelector(isMessageSelectionMode);
  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);
  const nextMessageToPlay = useSelector(getNextMessageToPlayIndex);

  const messageId = props.messageId;

  const onQuoteClick = props.messageProps.propsForMessage.quote
    ? props.scrollToQuoteMessage
    : undefined;

  const regularProps: MessageRegularProps = {
    ...props.messageProps.propsForMessage,
    firstMessageOfSeries: props.messageProps.firstMessageOfSeries,
    multiSelectMode,
    isQuotedMessageToAnimate: messageId === quotedMessageToAnimate,
    nextMessageToPlay,
    playNextMessage: props.playNextMessage,
    onQuoteClick,
  };

  return (
    <React.Fragment key={props.messageId}>
      <Message
        {...regularProps}
        playableMessageIndex={props.playableMessageIndex}
        multiSelectMode={multiSelectMode}
        key={messageId}
      />
      <UnreadIndicator messageId={props.messageId} show={props.showUnreadIndicator} />
    </React.Fragment>
  );
};

const MessageList = (props: {
  scrollToQuoteMessage: (options: QuoteClickOptions) => Promise<void>;
  playNextMessage?: (value: number) => void;
}) => {
  const messagesProps = useSelector(getSortedMessagesOfSelectedConversation);
  const firstUnreadMessageIndex = useSelector(getFirstUnreadMessageIndex);
  const isAbove = useSelector(isFirstUnreadMessageIdAbove);

  console.warn('isAbove', isAbove);
  let playableMessageIndex = 0;

  return (
    <>
      {messagesProps.map((messageProps: SortedMessageModelProps, index: number) => {
        const timerProps = messageProps.propsForTimerNotification;
        const propsForGroupInvitation = messageProps.propsForGroupInvitation;
        const propsForDataExtractionNotification = messageProps.propsForDataExtractionNotification;

        const groupNotificationProps = messageProps.propsForGroupNotification;

        // IF we found the first unread message
        // AND we are not scrolled all the way to the bottom
        // THEN, show the unread banner for the current message
        const showUnreadIndicator =
          Boolean(firstUnreadMessageIndex) && firstUnreadMessageIndex === index;

        if (groupNotificationProps) {
          return (
            <GroupUpdateItem
              key={messageProps.propsForMessage.id}
              groupNotificationProps={groupNotificationProps}
              messageId={messageProps.propsForMessage.id}
              showUnreadIndicator={showUnreadIndicator}
            />
          );
        }

        if (propsForGroupInvitation) {
          return (
            <GroupInvitationItem
              key={messageProps.propsForMessage.id}
              propsForGroupInvitation={propsForGroupInvitation}
              messageId={messageProps.propsForMessage.id}
              showUnreadIndicator={showUnreadIndicator}
            />
          );
        }

        if (propsForDataExtractionNotification) {
          return (
            <DataExtractionNotificationItem
              key={messageProps.propsForMessage.id}
              propsForDataExtractionNotification={propsForDataExtractionNotification}
              messageId={messageProps.propsForMessage.id}
              showUnreadIndicator={showUnreadIndicator}
            />
          );
        }

        if (timerProps) {
          return (
            <TimerNotificationItem
              key={messageProps.propsForMessage.id}
              timerProps={timerProps}
              messageId={messageProps.propsForMessage.id}
              showUnreadIndicator={showUnreadIndicator}
            />
          );
        }

        if (!messageProps) {
          return;
        }

        playableMessageIndex++;

        // firstMessageOfSeries tells us to render the avatar only for the first message
        // in a series of messages from the same user
        return (
          <GenericMessageItem
            key={messageProps.propsForMessage.id}
            playableMessageIndex={playableMessageIndex}
            messageId={messageProps.propsForMessage.id}
            messageProps={messageProps}
            showUnreadIndicator={showUnreadIndicator}
            scrollToQuoteMessage={props.scrollToQuoteMessage}
            playNextMessage={props.playNextMessage}
          />
        );
      })}
    </>
  );
};

class SessionMessagesListInner extends React.Component<Props> {
  private scrollOffsetBottomPx: number = Number.MAX_VALUE;
  private ignoreScrollEvents: boolean;
  private timeoutResetQuotedScroll: NodeJS.Timeout | null = null;

  public constructor(props: Props) {
    super(props);
    autoBind(this);

    this.ignoreScrollEvents = true;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidMount() {
    // Pause thread to wait for rendering to complete
    setTimeout(this.initialMessageLoadingPosition, 0);
  }

  public componentWillUnmount() {
    if (this.timeoutResetQuotedScroll) {
      clearTimeout(this.timeoutResetQuotedScroll);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;
    const messageLengthChanged = prevProps.messagesProps.length !== this.props.messagesProps.length;
    if (
      !isSameConvo ||
      (prevProps.messagesProps.length === 0 && this.props.messagesProps.length !== 0)
    ) {
      // displayed conversation changed. We have a bit of cleaning to do here
      this.ignoreScrollEvents = true;
      this.setupTimeoutResetQuotedHighlightedMessage(true);
      this.initialMessageLoadingPosition();
    } else {
      // if we got new message for this convo, and we are scrolled to bottom
      if (isSameConvo && messageLengthChanged) {
        // Keep scrolled to bottom unless user scrolls up
        if (this.getScrollOffsetBottomPx() === 0) {
          this.scrollToBottom();
        }
      }
    }
  }

  public render() {
    const { conversationKey, conversation } = this.props;

    if (!conversationKey || !conversation) {
      return null;
    }

    let displayedName = null;
    if (conversation.type === ConversationTypeEnum.PRIVATE) {
      displayedName = getConversationController().getContactProfileNameOrShortenedPubKey(
        conversationKey
      );
    }

    return (
      <div
        className="messages-container"
        onScroll={this.handleScroll}
        ref={this.props.messageContainerRef}
      >
        <TypingBubble
          phoneNumber={conversationKey}
          conversationType={conversation.type}
          displayedName={displayedName}
          isTyping={conversation.isTyping}
          key="typing-bubble"
        />

        <MessageList
          scrollToQuoteMessage={this.scrollToQuoteMessage}
          playNextMessage={this.playNextMessage}
        />

        <SessionScrollButton onClick={this.scrollToBottom} key="scroll-down-button" />
      </div>
    );
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~ MESSAGE HANDLING ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private updateReadMessages() {
    const { messagesProps, conversationKey } = this.props;

    if (!messagesProps || messagesProps.length === 0 || !conversationKey) {
      return;
    }

    const conversation = getConversationController().getOrThrow(conversationKey);

    if (conversation.isBlocked()) {
      return;
    }

    if (this.ignoreScrollEvents) {
      return;
    }

    if (this.getScrollOffsetBottomPx() === 0 && isElectronWindowFocused()) {
      void conversation.markRead(messagesProps[0].propsForMessage.receivedAt || 0);
    }
  }

  /**
   * Sets the targeted index for the next
   * @param index index of message that just completed
   */
  private playNextMessage(index: any) {
    const { messagesProps } = this.props;
    let nextIndex: number | undefined = index - 1;

    // to prevent autoplaying as soon as a message is received.
    const latestMessagePlayed = index <= 0 || messagesProps.length < index - 1;
    if (latestMessagePlayed) {
      nextIndex = undefined;
      window.inboxStore?.dispatch(setNextMessageToPlay(nextIndex));
      return;
    }

    // stop auto-playing when the audio messages change author.
    const prevAuthorNumber = messagesProps[index].propsForMessage.authorPhoneNumber;
    const nextAuthorNumber = messagesProps[index - 1].propsForMessage.authorPhoneNumber;
    const differentAuthor = prevAuthorNumber !== nextAuthorNumber;
    if (differentAuthor) {
      nextIndex = undefined;
    }

    window.inboxStore?.dispatch(setNextMessageToPlay(nextIndex));
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ SCROLLING METHODS ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private async handleScroll() {
    const messageContainer = this.props.messageContainerRef?.current;

    const { conversationKey } = this.props;
    if (!messageContainer || !conversationKey) {
      return;
    }
    contextMenu.hideAll();

    if (this.ignoreScrollEvents) {
      return;
    }
    // nothing to do if there are no message loaded
    if (!this.props.messagesProps || this.props.messagesProps.length === 0) {
      return;
    }

    //  ---- First lets see if we need to show the scroll to bottom button, without using clientHeight (which generates a full layout recalculation)
    // get the message the most at the bottom
    const bottomMessageId = this.props.messagesProps[0].propsForMessage.id;
    const bottomMessageDomElement = document.getElementById(bottomMessageId);

    // get the message the most at the top
    const topMessageId = this.props.messagesProps[this.props.messagesProps.length - 1]
      .propsForMessage.id;
    const topMessageDomElement = document.getElementById(topMessageId);

    const containerTop = messageContainer.getBoundingClientRect().top;
    const containerBottom = messageContainer.getBoundingClientRect().bottom;

    // First handle what we gotta handle with the bottom message position
    // either the showScrollButton or the markRead of all messages
    if (!bottomMessageDomElement) {
      window.log.warn('Could not find dom element for handle scroll');
    } else {
      const topOfBottomMessage = bottomMessageDomElement.getBoundingClientRect().top;
      const bottomOfBottomMessage = bottomMessageDomElement.getBoundingClientRect().bottom;

      // this is our limit for the showScrollDownButton.
      const showScrollButton = topOfBottomMessage > window.innerHeight;
      window.inboxStore?.dispatch(showScrollToBottomButton(showScrollButton));

      // trigger markRead if we hit the bottom
      const isScrolledToBottom = bottomOfBottomMessage >= containerBottom - 5;
      if (isScrolledToBottom) {
        // Mark messages read
        this.updateReadMessages();
      }
    }

    // Then, see if we need to fetch more messages because the top message it

    if (!topMessageDomElement) {
      window.log.warn('Could not find dom top element for handle scroll');
    } else {
      const topTopMessage = topMessageDomElement.getBoundingClientRect().top;

      // this is our limit for the showScrollDownButton.
      const shouldFetchMore =
        topTopMessage > containerTop - 10 && !this.props.areMoreMessagesBeingFetched;

      if (shouldFetchMore) {
        const { messagesProps } = this.props;
        const numMessages =
          messagesProps.length + Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
        const oldLen = messagesProps.length;
        const previousTopMessage = messagesProps[oldLen - 1]?.propsForMessage.id;

        (window.inboxStore?.dispatch as any)(
          fetchMessagesForConversation({ conversationKey, count: numMessages })
        );
        if (previousTopMessage && oldLen !== messagesProps.length) {
          this.scrollToMessage(previousTopMessage);
        }
      }
    }
  }

  /**
   * Position the list to the middle of the loaded list if the conversation has unread messages and we have some messages loaded
   */
  private initialMessageLoadingPosition() {
    const { messagesProps, conversation } = this.props;
    if (!conversation) {
      return;
    }
    if (conversation.unreadCount > 0 && messagesProps.length) {
      if (conversation.unreadCount < messagesProps.length) {
        // if we loaded all unread messages, scroll to the first one unread
        const firstUnread = Math.max(conversation.unreadCount, 0);
        messagesProps[firstUnread].propsForMessage.id;
        this.scrollToMessage(messagesProps[firstUnread].propsForMessage.id);
      } else {
        // if we did not load all unread messages, just scroll to the middle of the loaded messages list. so the user can choose to go up or down from there
        const middle = Math.floor(messagesProps.length / 2);
        messagesProps[middle].propsForMessage.id;
        this.scrollToMessage(messagesProps[middle].propsForMessage.id);
      }
    }

    if (this.ignoreScrollEvents && messagesProps.length > 0) {
      this.ignoreScrollEvents = false;
      this.updateReadMessages();
    }
  }

  /**
   * Could not find a better name, but when we click on a quoted message,
   * the UI takes us there and highlights it.
   * If the user clicks again on this message, we want this highlight to be
   * shown once again.
   *
   * So we need to reset the state of of the highlighted message so when the users clicks again,
   * the highlight is shown once again
   */
  private setupTimeoutResetQuotedHighlightedMessage(clearOnly = false) {
    if (this.timeoutResetQuotedScroll) {
      clearTimeout(this.timeoutResetQuotedScroll);
    }
    // only clear the timeout, do not schedule once again
    if (clearOnly) {
      return;
    }

    if (this.props.animateQuotedMessageId !== undefined) {
      this.timeoutResetQuotedScroll = global.setTimeout(() => {
        window.inboxStore?.dispatch(quotedMessageToAnimate(undefined));
      }, 3000);
    }
  }

  private scrollToMessage(messageId: string, smooth: boolean = false) {
    const messageElementDom = document.getElementById(messageId);
    messageElementDom?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    });

    // we consider that a `smooth` set to true, means it's a quoted message, so highlight this message on the UI
    if (smooth) {
      window.inboxStore?.dispatch(quotedMessageToAnimate(messageId));
      this.setupTimeoutResetQuotedHighlightedMessage();
    }

    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
  }

  private scrollToBottom() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
    const { messagesProps, conversationKey } = this.props;

    if (!messagesProps || messagesProps.length === 0 || !conversationKey) {
      return;
    }

    const conversation = getConversationController().get(conversationKey);
    if (isElectronWindowFocused()) {
      void conversation.markRead(messagesProps[0].propsForMessage.receivedAt || 0);
    }
  }

  private async scrollToQuoteMessage(options: QuoteClickOptions) {
    const { quoteAuthor, quoteId, referencedMessageNotFound } = options;

    const { messagesProps } = this.props;

    // For simplicity's sake, we show the 'not found' toast no matter what if we were
    //   not able to find the referenced message when the quote was received.
    if (referencedMessageNotFound) {
      ToastUtils.pushOriginalNotFound();
      return;
    }
    // Look for message in memory first, which would tell us if we could scroll to it
    const targetMessage = messagesProps.find(item => {
      const messageAuthor = item.propsForMessage?.authorPhoneNumber;

      if (!messageAuthor || quoteAuthor !== messageAuthor) {
        return false;
      }
      if (quoteId !== item.propsForMessage?.timestamp) {
        return false;
      }

      return true;
    });

    // If there's no message already in memory, we won't be scrolling. So we'll gather
    //   some more information then show an informative toast to the user.
    if (!targetMessage) {
      const collection = await getMessagesBySentAt(quoteId);
      const found = Boolean(
        collection.find((item: MessageModel) => {
          const messageAuthor = item.getSource();

          return Boolean(messageAuthor && quoteAuthor === messageAuthor);
        })
      );

      if (found) {
        ToastUtils.pushFoundButNotLoaded();
      } else {
        ToastUtils.pushOriginalNoLongerAvailable();
      }
      return;
    }

    const databaseId = targetMessage.propsForMessage.id;
    this.scrollToMessage(databaseId, true);
  }

  // basically the offset in px from the bottom of the view (most recent message)
  private getScrollOffsetBottomPx() {
    const messageContainer = this.props.messageContainerRef?.current;

    if (!messageContainer) {
      return Number.MAX_VALUE;
    }

    const scrollTop = messageContainer.scrollTop;
    const scrollHeight = messageContainer.scrollHeight;
    const clientHeight = messageContainer.clientHeight;
    return scrollHeight - scrollTop - clientHeight;
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    conversationKey: getSelectedConversationKey(state),
    conversation: getSelectedConversation(state),
    messagesProps: getSortedMessagesOfSelectedConversation(state),
    showScrollButton: getShowScrollButton(state),
    animateQuotedMessageId: getQuotedMessageToAnimate(state),
    areMoreMessagesBeingFetched: areMoreMessagesBeingFetched(state),
  };
};

const smart = connect(mapStateToProps);

export const SessionMessagesList = smart(SessionMessagesListInner);
