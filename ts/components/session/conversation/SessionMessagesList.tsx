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
  ReduxConversationType,
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
import { getMessagesBySentAt } from '../../../data/data';
import autoBind from 'auto-bind';
import { ConversationTypeEnum } from '../../../models/conversation';
import { DataExtractionNotification } from '../../conversation/DataExtractionNotification';
import { StateType } from '../../../state/reducer';
import { connect, useSelector } from 'react-redux';
import {
  getMessagesOfSelectedConversation,
  getSelectedConversation,
  getSelectedConversationKey,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';

interface State {
  showScrollButton: boolean;
  animateQuotedMessageId?: string;
  nextMessageToPlay: number | undefined;
}

export type SessionMessageListProps = {
  messageContainerRef: React.RefObject<any>;
};

type Props = SessionMessageListProps & {
  conversationKey?: string;
  messagesProps: Array<SortedMessageModelProps>;

  conversation?: ReduxConversationType;
};

const UnreadIndicator = (props: { messageId: string; show: boolean }) => (
  <SessionLastSeenIndicator show={props.show} key={`unread-indicator-${props.messageId}`} />
);

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
}) => {
  const multiSelectMode = useSelector(isMessageSelectionMode);
  // const selectedConversation = useSelector(getSelectedConversationKey) as string;

  const messageId = props.messageId;

  console.warn('FIXME audric');

  // const onQuoteClick = props.messageProps.propsForMessage.quote
  //   ? this.scrollToQuoteMessage
  //   : async () => {};

  const regularProps: MessageRegularProps = {
    ...props.messageProps.propsForMessage,
    // firstMessageOfSeries,
    multiSelectMode,
    // isQuotedMessageToAnimate: messageId === this.state.animateQuotedMessageId,
    // nextMessageToPlay: this.state.nextMessageToPlay,
    // playNextMessage: this.playNextMessage,
    // onQuoteClick,
  };

  return (
    <React.Fragment key={props.messageId}>
      <Message
        {...regularProps}
        playableMessageIndex={props.playableMessageIndex}
        multiSelectMode={multiSelectMode}
        // onQuoteClick={onQuoteClick}
        key={messageId}
      />
      <UnreadIndicator messageId={props.messageId} show={props.showUnreadIndicator} />
    </React.Fragment>
  );
};

const MessageList = ({ hasNextPage: boolean, isNextPageLoading, list, loadNextPage }) => {
  const messagesProps = useSelector(getMessagesOfSelectedConversation);
  let playableMessageIndex = 0;

  return (
    <>
      {messagesProps.map((messageProps: SortedMessageModelProps) => {
        const timerProps = messageProps.propsForTimerNotification;
        const propsForGroupInvitation = messageProps.propsForGroupInvitation;
        const propsForDataExtractionNotification = messageProps.propsForDataExtractionNotification;

        const groupNotificationProps = messageProps.propsForGroupNotification;

        // IF we found the first unread message
        // AND we are not scrolled all the way to the bottom
        // THEN, show the unread banner for the current message
        const showUnreadIndicator = Boolean(messageProps.firstUnread);
        console.warn('&& this.getScrollOffsetBottomPx() !== 0');

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
          />
        );
      })}
    </>
  );
};

class SessionMessagesListInner extends React.Component<Props, State> {
  private scrollOffsetBottomPx: number = Number.MAX_VALUE;
  private ignoreScrollEvents: boolean;
  private timeoutResetQuotedScroll: NodeJS.Timeout | null = null;

  public constructor(props: Props) {
    super(props);

    this.state = {
      showScrollButton: false,
      nextMessageToPlay: undefined,
    };
    autoBind(this);

    this.ignoreScrollEvents = true;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidMount() {
    // Pause thread to wait for rendering to complete
    setTimeout(this.scrollToUnread, 0);
  }

  public componentWillUnmount() {
    if (this.timeoutResetQuotedScroll) {
      clearTimeout(this.timeoutResetQuotedScroll);
    }
  }

  public componentDidUpdate(prevProps: Props, _prevState: State) {
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;
    const messageLengthChanged = prevProps.messagesProps.length !== this.props.messagesProps.length;
    if (
      !isSameConvo ||
      (prevProps.messagesProps.length === 0 && this.props.messagesProps.length !== 0)
    ) {
      // displayed conversation changed. We have a bit of cleaning to do here
      this.scrollOffsetBottomPx = Number.MAX_VALUE;
      this.ignoreScrollEvents = true;
      this.setupTimeoutResetQuotedHighlightedMessage(true);
      this.setState(
        {
          showScrollButton: false,
          animateQuotedMessageId: undefined,
        },
        this.scrollToUnread
      );
    } else {
      // if we got new message for this convo, and we are scrolled to bottom
      if (isSameConvo && messageLengthChanged) {
        // Keep scrolled to bottom unless user scrolls up
        if (this.getScrollOffsetBottomPx() === 0) {
          this.scrollToBottom();
        } else {
          const messageContainer = this.props.messageContainerRef?.current;

          if (messageContainer) {
            const scrollHeight = messageContainer.scrollHeight;
            const clientHeight = messageContainer.clientHeight;
            this.ignoreScrollEvents = true;
            messageContainer.scrollTop = scrollHeight - clientHeight - this.scrollOffsetBottomPx;
            this.ignoreScrollEvents = false;
          }
        }
      }
    }
  }

  public render() {
    const { conversationKey, conversation } = this.props;
    const { showScrollButton } = this.state;

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

        <MessageList />

        <SessionScrollButton
          show={showScrollButton}
          onClick={this.scrollToBottom}
          key="scroll-down-button"
        />
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

    if (this.getScrollOffsetBottomPx() === 0) {
      void conversation.markRead(messagesProps[0].propsForMessage.receivedAt || 0);
    }
  }

  /**
   * Sets the targeted index for the next
   * @param index index of message that just completed
   */
  private readonly playNextMessage = (index: any) => {
    const { messagesProps } = this.props;
    let nextIndex: number | undefined = index - 1;

    // to prevent autoplaying as soon as a message is received.
    const latestMessagePlayed = index <= 0 || messagesProps.length < index - 1;
    if (latestMessagePlayed) {
      nextIndex = undefined;
      this.setState({
        nextMessageToPlay: nextIndex,
      });
      return;
    }

    // stop auto-playing when the audio messages change author.
    const prevAuthorNumber = messagesProps[index].propsForMessage.authorPhoneNumber;
    const nextAuthorNumber = messagesProps[index - 1].propsForMessage.authorPhoneNumber;
    const differentAuthor = prevAuthorNumber !== nextAuthorNumber;
    if (differentAuthor) {
      nextIndex = undefined;
    }

    this.setState({
      nextMessageToPlay: nextIndex,
    });
  };

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

    const scrollTop = messageContainer.scrollTop;
    const clientHeight = messageContainer.clientHeight;

    const scrollButtonViewShowLimit = 0.75;
    const scrollButtonViewHideLimit = 0.4;
    this.scrollOffsetBottomPx = this.getScrollOffsetBottomPx();

    const scrollOffsetPc = this.scrollOffsetBottomPx / clientHeight;

    // Scroll button appears if you're more than 75% scrolled up
    if (scrollOffsetPc > scrollButtonViewShowLimit && !this.state.showScrollButton) {
      this.setState({ showScrollButton: true });
    }
    // Scroll button disappears if you're more less than 40% scrolled up
    if (scrollOffsetPc < scrollButtonViewHideLimit && this.state.showScrollButton) {
      this.setState({ showScrollButton: false });
    }

    // Scrolled to bottom
    const isScrolledToBottom = this.getScrollOffsetBottomPx() === 0;
    if (isScrolledToBottom) {
      // Mark messages read
      this.updateReadMessages();
    }

    // Fetch more messages when nearing the top of the message list
    const shouldFetchMoreMessages = scrollTop <= Constants.UI.MESSAGE_CONTAINER_BUFFER_OFFSET_PX;

    if (shouldFetchMoreMessages) {
      const { messagesProps } = this.props;
      const numMessages = messagesProps.length + Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
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

  private scrollToUnread() {
    const { messagesProps, conversation } = this.props;
    if (!conversation) {
      return;
    }
    if (conversation.unreadCount > 0) {
      let message;
      if (messagesProps.length > conversation.unreadCount) {
        // if we have enough message to show one more message, show one more to include the unread banner
        message = messagesProps[conversation.unreadCount - 1];
      } else {
        message = messagesProps[conversation.unreadCount - 1];
      }

      if (message) {
        this.scrollToMessage(message.propsForMessage.id);
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
    if (this.state.animateQuotedMessageId !== undefined) {
      this.timeoutResetQuotedScroll = global.setTimeout(() => {
        this.setState({ animateQuotedMessageId: undefined });
      }, 3000);
    }
  }

  private scrollToMessage(messageId: string, smooth: boolean = false) {
    const topUnreadMessage = document.getElementById(messageId);
    topUnreadMessage?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'center',
    });

    // we consider that a `smooth` set to true, means it's a quoted message, so highlight this message on the UI
    if (smooth) {
      this.setState(
        { animateQuotedMessageId: messageId },
        this.setupTimeoutResetQuotedHighlightedMessage
      );
    }

    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    const scrollHeight = messageContainer.scrollHeight;
    const clientHeight = messageContainer.clientHeight;

    if (scrollHeight !== 0 && scrollHeight === clientHeight) {
      this.updateReadMessages();
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

    const conversation = getConversationController().getOrThrow(conversationKey);
    void conversation.markRead(messagesProps[0].propsForMessage.receivedAt || 0);
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
    messagesProps: getMessagesOfSelectedConversation(state),
  };
};

const smart = connect(mapStateToProps);

export const SessionMessagesList = smart(SessionMessagesListInner);
