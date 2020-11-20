import React from 'react';

import { Message } from '../../conversation/Message';
import { TimerNotification } from '../../conversation/TimerNotification';

import { SessionScrollButton } from '../SessionScrollButton';
import { ResetSessionNotification } from '../../conversation/ResetSessionNotification';
import { Constants } from '../../../session';
import _ from 'lodash';
import { contextMenu } from 'react-contexify';
import { AttachmentType } from '../../../types/Attachment';
import { GroupNotification } from '../../conversation/GroupNotification';
import { GroupInvitation } from '../../conversation/GroupInvitation';
import { ConversationType } from '../../../state/ducks/conversations';
import { MessageModel } from '../../../../js/models/messages';
import { SessionLastSeenIndicator } from './SessionLastSeedIndicator';
import { VerificationNotification } from '../../conversation/VerificationNotification';
import { ToastUtils } from '../../../session/utils';

interface State {
  showScrollButton: boolean;
  doneInitialScroll: boolean;
}

interface Props {
  selectedMessages: Array<string>;
  conversationKey: string;
  messages: Array<MessageModel>;
  conversation: ConversationType;
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
  onClickAttachment: (attachment: any, message: any) => void;
  onDownloadAttachment: ({ attachment }: { attachment: any }) => void;
  onDeleteSelectedMessages: () => Promise<void>;
}

export class SessionMessagesList extends React.Component<Props, State> {
  private readonly messageContainerRef: React.RefObject<any>;
  private scrollOffsetPx: number = Number.MAX_VALUE;

  public constructor(props: Props) {
    super(props);

    this.state = {
      showScrollButton: false,
      doneInitialScroll: false,
    };
    this.renderMessage = this.renderMessage.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);
    this.scrollToQuoteMessage = this.scrollToQuoteMessage.bind(this);
    this.getScrollOffsetPx = this.getScrollOffsetPx.bind(this);

    this.messageContainerRef = this.props.messageContainerRef;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidMount() {
    // Pause thread to wait for rendering to complete
    setTimeout(this.scrollToUnread, 0);
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
      this.scrollOffsetPx = Number.MAX_VALUE;
      this.setState(
        {
          showScrollButton: false,
          doneInitialScroll: false,
        },
        this.scrollToUnread
      );
    } else {
      // if we got new message for this convo, and we are scrolled to bottom
      if (isSameConvo && messageLengthChanged) {
        // Keep scrolled to bottom unless user scrolls up
        if (this.getScrollOffsetPx() === 0) {
          this.scrollToBottom();
        } else {
          const messageContainer = this.messageContainerRef?.current;

          if (messageContainer) {
            global.setTimeout(() => {
              const scrollHeight = messageContainer.scrollHeight;
              const clientHeight = messageContainer.clientHeight;
              messageContainer.scrollTop =
                scrollHeight - clientHeight - this.scrollOffsetPx;
            }, 10);
          }
        }
      }
    }
  }

  public render() {
    const { messages } = this.props;
    const { showScrollButton } = this.state;

    return (
      <div
        className="messages-container"
        onScroll={this.handleScroll}
        ref={this.messageContainerRef}
      >
        {this.renderMessages(messages)}

        <SessionScrollButton
          show={showScrollButton}
          onClick={this.scrollToBottom}
        />
      </div>
    );
  }

  private renderMessages(messages: Array<MessageModel>) {
    const { conversation } = this.props;

    const multiSelectMode = Boolean(this.props.selectedMessages.length);
    let currentMessageIndex = 0;
    // find the first unread message in the list of messages. We use this to display the
    // unread banner so this is at all times at the correct index.
    // Our messages are marked read, so be sure to skip those.

    // the messages variable is ordered with most recent message being on index 0.
    // so we need to start from the end to find our first message unread

    let findFirstUnreadIndex = -1;

    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (
        message.attributes.type === 'incoming' &&
        message.attributes.unread !== undefined
      ) {
        findFirstUnreadIndex = index;
        break;
      }
    }

    // if we did not find an unread messsages, but the conversation has some,
    // we must not have enough messages in memory, so just display the unread banner
    // at the top of the screen
    if (findFirstUnreadIndex === -1 && conversation.unreadCount !== 0) {
      findFirstUnreadIndex = messages.length - 1;
    }
    if (conversation.unreadCount === 0) {
      findFirstUnreadIndex = -1;
    }

    return (
      <>
        {messages.map((message: MessageModel) => {
          const messageProps = message.propsForMessage;

          const timerProps = message.propsForTimerNotification;
          const resetSessionProps = message.propsForResetSessionNotification;
          const verificationSessionProps =
            message.propsForVerificationNotification;
          const propsForGroupInvitation = message.propsForGroupInvitation;

          const groupNotificationProps = message.propsForGroupNotification;

          // IF there are some unread messages
          // AND we found the last read message
          // AND we are not scrolled all the way to the bottom
          // THEN, show the unread banner for the current message
          const showUnreadIndicator =
            findFirstUnreadIndex >= 0 &&
            currentMessageIndex === findFirstUnreadIndex &&
            this.getScrollOffsetPx() !== 0;
          const unreadIndicator = (
            <SessionLastSeenIndicator
              count={findFirstUnreadIndex + 1} // count is used for the 118n of the string
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

          if (verificationSessionProps) {
            return (
              <>
                <VerificationNotification
                  {...verificationSessionProps}
                  key={message.id}
                />
                {unreadIndicator}
              </>
            );
          }

          if (resetSessionProps) {
            return (
              <>
                <ResetSessionNotification
                  {...resetSessionProps}
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

          // firstMessageOfSeries tells us to render the avatar only for the first message
          // in a series of messages from the same user
          return (
            <>
              {this.renderMessage(
                messageProps,
                message.firstMessageOfSeries,
                multiSelectMode
              )}
              {unreadIndicator}
            </>
          );
        })}
      </>
    );
  }

  private renderMessage(
    messageProps: any,
    firstMessageOfSeries: boolean,
    multiSelectMode: boolean
  ) {
    const selected =
      !!messageProps?.id &&
      this.props.selectedMessages.includes(messageProps.id);

    messageProps.i18n = window.i18n;
    messageProps.selected = selected;
    messageProps.firstMessageOfSeries = firstMessageOfSeries;
    messageProps.multiSelectMode = multiSelectMode;
    messageProps.onSelectMessage = this.props.selectMessage;
    messageProps.onDeleteMessage = this.props.deleteMessage;
    messageProps.onReply = this.props.replyToMessage;

    messageProps.onClickAttachment = (attachment: any) => {
      this.props.onClickAttachment(attachment, messageProps);
    };
    messageProps.onDownload = (attachment: AttachmentType) => {
      this.props.onDownloadAttachment({ attachment });
    };

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

    const conversation = window.ConversationController.getOrThrow(
      conversationKey
    );

    if (conversation.isBlocked()) {
      return;
    }

    if (!this.state.doneInitialScroll) {
      return;
    }

    if (this.getScrollOffsetPx() === 0) {
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

    if (!this.state.doneInitialScroll) {
      return;
    }

    const scrollTop = messageContainer.scrollTop;
    const clientHeight = messageContainer.clientHeight;

    const scrollButtonViewShowLimit = 0.75;
    const scrollButtonViewHideLimit = 0.4;
    this.scrollOffsetPx = this.getScrollOffsetPx();

    const scrollOffsetPc = this.scrollOffsetPx / clientHeight;

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
    const isScrolledToBottom = this.getScrollOffsetPx() === 0;
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

    if (!this.state.doneInitialScroll && messages.length > 0) {
      this.setState(
        {
          doneInitialScroll: true,
        },
        this.updateReadMessages
      );
    }
  }

  private scrollToMessage(messageId: string) {
    const topUnreadMessage = document.getElementById(messageId);
    topUnreadMessage?.scrollIntoView(false);

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
        MessageCollection: window.Whisper.MessageCollection,
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
    // const el = this.$(`#${databaseId}`);
    // if (!el || el.length === 0) {
    //   ToastUtils.pushOriginalNoLongerAvailable();
    //   window.log.info(
    //     `Error: had target message ${id} in messageCollection, but it was not in DOM`
    //   );
    //   return;
    // }
    // this probably does not work for us as we need to call getMessages before
    this.scrollToMessage(databaseId);
  }

  // basically the offset in px from the bottom of the view (most recent message)
  private getScrollOffsetPx() {
    const messageContainer = this.messageContainerRef?.current;

    if (!messageContainer) {
      return Number.MAX_VALUE;
    }

    const scrollTop = messageContainer.scrollTop;
    const scrollHeight = messageContainer.scrollHeight;
    const clientHeight = messageContainer.clientHeight;
    const scrollOffsetPx = scrollHeight - scrollTop - clientHeight;

    return scrollOffsetPx;
  }
}
