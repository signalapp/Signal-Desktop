import React from 'react';

import { Message } from '../../conversation/Message';
import { TimerNotification } from '../../conversation/TimerNotification';

import { SessionScrollButton } from '../SessionScrollButton';
import { Constants } from '../../../session';
import _ from 'lodash';
import { contextMenu } from 'react-contexify';
import { AttachmentType } from '../../../types/Attachment';
import { GroupNotification } from '../../conversation/GroupNotification';
import { GroupInvitation } from '../../conversation/GroupInvitation';
import { ConversationType } from '../../../state/ducks/conversations';
import { SessionLastSeenIndicator } from './SessionLastSeedIndicator';
import { ToastUtils } from '../../../session/utils';
import { TypingBubble } from '../../conversation/TypingBubble';
import { ConversationController } from '../../../session/conversations';
import { MessageCollection, MessageModel } from '../../../models/message';
import { MessageRegularProps } from '../../../models/messageType';

interface State {
  showScrollButton: boolean;
  animateQuotedMessageId?: string;
}

interface Props {
  selectedMessages: Array<string>;
  conversationKey: string;
  messages: Array<MessageModel>;
  conversation: ConversationType;
  ourPrimary: string;
  messageContainerRef: React.RefObject<any>;
  selectMessage: (messageId: string) => void;
  deleteMessage: (messageId: string) => void;
  fetchMessagesForConversation: ({
    conversationKey,
    count,
  }: {
    conversationKey: string;
    count: number;
  }) => void;
  replyToMessage: (messageId: number) => Promise<void>;
  showMessageDetails: (messageProps: any) => Promise<void>;
  onClickAttachment: (attachment: any, message: any) => void;
  onDownloadAttachment: ({ attachment }: { attachment: any }) => void;
  onDeleteSelectedMessages: () => Promise<void>;
}

export class SessionMessagesList extends React.Component<Props, State> {
  private readonly messageContainerRef: React.RefObject<any>;
  private scrollOffsetBottomPx: number = Number.MAX_VALUE;
  private ignoreScrollEvents: boolean;
  private timeoutResetQuotedScroll: NodeJS.Timeout | null = null;

  public constructor(props: Props) {
    super(props);

    this.state = {
      showScrollButton: false,
    };
    this.renderMessage = this.renderMessage.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);
    this.scrollToQuoteMessage = this.scrollToQuoteMessage.bind(this);
    this.getScrollOffsetBottomPx = this.getScrollOffsetBottomPx.bind(this);
    this.displayUnreadBannerIndex = this.displayUnreadBannerIndex.bind(this);

    this.onSendAnyway = this.onSendAnyway.bind(this);

    this.messageContainerRef = this.props.messageContainerRef;
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
    const isSameConvo =
      prevProps.conversationKey === this.props.conversationKey;
    const messageLengthChanged =
      prevProps.messages.length !== this.props.messages.length;
    if (
      !isSameConvo ||
      (prevProps.messages.length === 0 && this.props.messages.length !== 0)
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
          const messageContainer = this.messageContainerRef?.current;

          if (messageContainer) {
            const scrollHeight = messageContainer.scrollHeight;
            const clientHeight = messageContainer.clientHeight;
            this.ignoreScrollEvents = true;
            messageContainer.scrollTop =
              scrollHeight - clientHeight - this.scrollOffsetBottomPx;
            this.ignoreScrollEvents = false;
          }
        }
      }
    }
  }

  public render() {
    const { conversationKey, conversation, messages } = this.props;
    const { showScrollButton } = this.state;

    let displayedName = null;
    if (conversation.type === 'direct') {
      displayedName = ConversationController.getInstance().getContactProfileNameOrShortenedPubKey(
        conversationKey
      );
    }

    return (
      <div
        className="messages-container"
        onScroll={this.handleScroll}
        ref={this.messageContainerRef}
      >
        <TypingBubble
          phoneNumber={conversationKey}
          conversationType={conversation.type}
          displayedName={displayedName}
          isTyping={conversation.isTyping}
        />

        {this.renderMessages(messages)}

        <SessionScrollButton
          show={showScrollButton}
          onClick={this.scrollToBottom}
        />
      </div>
    );
  }

  private displayUnreadBannerIndex(messages: Array<MessageModel>) {
    const { conversation } = this.props;
    if (conversation.unreadCount === 0) {
      return -1;
    }
    // conversation.unreadCount is the number of messages we incoming we did not read yet.
    // also, unreacCount is updated only when the conversation is marked as read.
    // So we can have an unreadCount for the conversation not correct based on the real number of unread messages.
    // some of the messages we have in "messages" are ones we sent ourself (or from another device).
    // those messages should not be counted to display the unread banner.

    let findFirstUnreadIndex = -1;
    let incomingMessagesSoFar = 0;
    const { unreadCount } = conversation;

    // Basically, count the number of incoming messages from the most recent one.
    for (let index = 0; index <= messages.length - 1; index++) {
      const message = messages[index];
      if (message.attributes.type === 'incoming') {
        incomingMessagesSoFar++;
        // message.attributes.unread is !== undefined if the message is unread.
        if (
          message.attributes.unread !== undefined &&
          incomingMessagesSoFar >= unreadCount
        ) {
          findFirstUnreadIndex = index;
          break;
        }
      }
    }

    //
    if (findFirstUnreadIndex === -1 && conversation.unreadCount >= 0) {
      return conversation.unreadCount - 1;
    }
    return findFirstUnreadIndex;
  }

  private renderMessages(messages: Array<MessageModel>) {
    const { conversation, ourPrimary, selectedMessages } = this.props;
    const multiSelectMode = Boolean(selectedMessages.length);
    let currentMessageIndex = 0;
    const displayUnreadBannerIndex = this.displayUnreadBannerIndex(messages);

    return (
      <>
        {messages.map((message: MessageModel) => {
          const messageProps = message.propsForMessage;

          const timerProps = message.propsForTimerNotification;
          const propsForGroupInvitation = message.propsForGroupInvitation;

          const groupNotificationProps = message.propsForGroupNotification;

          // IF there are some unread messages
          // AND we found the last read message
          // AND we are not scrolled all the way to the bottom
          // THEN, show the unread banner for the current message
          const showUnreadIndicator =
            displayUnreadBannerIndex >= 0 &&
            currentMessageIndex === displayUnreadBannerIndex &&
            this.getScrollOffsetBottomPx() !== 0;
          const unreadIndicator = (
            <SessionLastSeenIndicator
              count={displayUnreadBannerIndex + 1} // count is used for the 118n of the string
              show={showUnreadIndicator}
              key={`unread-indicator-${message.id}`}
            />
          );

          currentMessageIndex = currentMessageIndex + 1;

          if (groupNotificationProps) {
            return (
              <>
                <GroupNotification
                  {...groupNotificationProps}
                  key={message.id}
                />
                {unreadIndicator}
              </>
            );
          }

          if (propsForGroupInvitation) {
            return (
              <>
                <GroupInvitation
                  {...propsForGroupInvitation}
                  key={message.id}
                />
                {unreadIndicator}
              </>
            );
          }

          if (timerProps) {
            return (
              <>
                <TimerNotification {...timerProps} key={message.id} />
                {unreadIndicator}
              </>
            );
          }
          if (!messageProps) {
            return;
          }

          if (messageProps.conversationType === 'group') {
            messageProps.weAreAdmin = conversation.groupAdmins?.includes(
              ourPrimary
            );
          }
          // a message is deletable if
          // either we sent it,
          // or the convo is not a public one (in this case, we will only be able to delete for us)
          // or the convo is public and we are an admin
          const isDeletable =
            messageProps.authorPhoneNumber === this.props.ourPrimary ||
            !conversation.isPublic ||
            (conversation.isPublic && !!messageProps.weAreAdmin);

          messageProps.isDeletable = isDeletable;
          messageProps.isAdmin = conversation.groupAdmins?.includes(
            messageProps.authorPhoneNumber
          );

          // firstMessageOfSeries tells us to render the avatar only for the first message
          // in a series of messages from the same user
          return (
            <>
              {this.renderMessage(
                messageProps,
                messageProps.firstMessageOfSeries,
                multiSelectMode,
                message
              )}
              {unreadIndicator}
            </>
          );
        })}
      </>
    );
  }

  private renderMessage(
    messageProps: MessageRegularProps,
    firstMessageOfSeries: boolean,
    multiSelectMode: boolean,
    message: MessageModel
  ) {
    const selected =
      !!messageProps?.id &&
      this.props.selectedMessages.includes(messageProps.id);

    messageProps.selected = selected;
    messageProps.firstMessageOfSeries = firstMessageOfSeries;

    messageProps.multiSelectMode = multiSelectMode;
    messageProps.onSelectMessage = this.props.selectMessage;
    messageProps.onDeleteMessage = this.props.deleteMessage;
    messageProps.onReply = this.props.replyToMessage;
    messageProps.onShowDetail = async () => {
      const messageDetailsProps = await message.getPropsForMessageDetail();
      void this.props.showMessageDetails(messageDetailsProps);
    };

    messageProps.onClickAttachment = (attachment: AttachmentType) => {
      this.props.onClickAttachment(attachment, messageProps);
    };
    messageProps.onDownload = (attachment: AttachmentType) => {
      this.props.onDownloadAttachment({ attachment });
    };

    messageProps.isQuotedMessageToAnimate =
      messageProps.id === this.state.animateQuotedMessageId;

    if (messageProps.quote) {
      messageProps.quote.onClick = (options: {
        quoteAuthor: string;
        quoteId: any;
        referencedMessageNotFound: boolean;
      }) => {
        void this.scrollToQuoteMessage(options);
      };
    }

    return <Message {...messageProps} key={messageProps.id} />;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~ MESSAGE HANDLING ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private updateReadMessages() {
    const { messages, conversationKey } = this.props;

    if (!messages || messages.length === 0) {
      return;
    }

    const conversation = ConversationController.getInstance().getOrThrow(
      conversationKey
    );

    if (conversation.isBlocked()) {
      return;
    }

    if (this.ignoreScrollEvents) {
      return;
    }

    if (this.getScrollOffsetBottomPx() === 0) {
      void conversation.markRead(messages[0].attributes.received_at);
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ SCROLLING METHODS ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private async handleScroll() {
    const messageContainer = this.messageContainerRef?.current;

    const { fetchMessagesForConversation, conversationKey } = this.props;
    if (!messageContainer) {
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
    if (
      scrollOffsetPc > scrollButtonViewShowLimit &&
      !this.state.showScrollButton
    ) {
      this.setState({ showScrollButton: true });
    }
    // Scroll button disappears if you're more less than 40% scrolled up
    if (
      scrollOffsetPc < scrollButtonViewHideLimit &&
      this.state.showScrollButton
    ) {
      this.setState({ showScrollButton: false });
    }

    // Scrolled to bottom
    const isScrolledToBottom = this.getScrollOffsetBottomPx() === 0;
    if (isScrolledToBottom) {
      // Mark messages read
      this.updateReadMessages();
    }

    // Fetch more messages when nearing the top of the message list
    const shouldFetchMoreMessages =
      scrollTop <= Constants.UI.MESSAGE_CONTAINER_BUFFER_OFFSET_PX;

    if (shouldFetchMoreMessages) {
      const { messages } = this.props;
      const numMessages =
        this.props.messages.length +
        Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
      const oldLen = messages.length;
      const previousTopMessage = messages[oldLen - 1]?.id;

      fetchMessagesForConversation({ conversationKey, count: numMessages });
      if (previousTopMessage && oldLen !== messages.length) {
        this.scrollToMessage(previousTopMessage);
      }
    }
  }

  private scrollToUnread() {
    const { messages, conversation } = this.props;
    if (conversation.unreadCount > 0) {
      let message;
      if (messages.length > conversation.unreadCount) {
        // if we have enough message to show one more message, show one more to include the unread banner
        message = messages[conversation.unreadCount - 1];
      } else {
        message = messages[conversation.unreadCount - 1];
      }

      if (message) {
        this.scrollToMessage(message.id);
      }
    }

    if (this.ignoreScrollEvents && messages.length > 0) {
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

    const messageContainer = this.messageContainerRef.current;
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
    const messageContainer = this.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollTop =
      messageContainer.scrollHeight - messageContainer.clientHeight;
    this.updateReadMessages();
  }

  private async scrollToQuoteMessage(options: any = {}) {
    const { quoteAuthor, quoteId, referencedMessageNotFound } = options;

    // For simplicity's sake, we show the 'not found' toast no matter what if we were
    //   not able to find the referenced message when the quote was received.
    if (referencedMessageNotFound) {
      ToastUtils.pushOriginalNotFound();
      return;
    }
    // Look for message in memory first, which would tell us if we could scroll to it
    const targetMessage = this.props.messages.find(item => {
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
      const collection = await window.Signal.Data.getMessagesBySentAt(quoteId, {
        MessageCollection,
      });
      const found = Boolean(
        collection.find((item: MessageModel) => {
          const messageAuthor = item.propsForMessage?.authorPhoneNumber;

          return messageAuthor && quoteAuthor === messageAuthor;
        })
      );

      if (found) {
        ToastUtils.pushFoundButNotLoaded();
      } else {
        ToastUtils.pushOriginalNoLongerAvailable();
      }
      return;
    }

    const databaseId = targetMessage.id;
    this.scrollToMessage(databaseId, true);
  }

  // basically the offset in px from the bottom of the view (most recent message)
  private getScrollOffsetBottomPx() {
    const messageContainer = this.messageContainerRef?.current;

    if (!messageContainer) {
      return Number.MAX_VALUE;
    }

    const scrollTop = messageContainer.scrollTop;
    const scrollHeight = messageContainer.scrollHeight;
    const clientHeight = messageContainer.clientHeight;
    return scrollHeight - scrollTop - clientHeight;
  }

  private async onSendAnyway({ contact, message }: any) {
    message.resend(contact.id);
  }
}
