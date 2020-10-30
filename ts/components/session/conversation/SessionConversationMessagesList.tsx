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

interface State {
  isScrolledToBottom: boolean;
  showScrollButton: boolean;
  doneInitialScroll: boolean;
}

interface Props {
  selectedMessages: Array<string>;
  conversationKey: string;
  messages: Array<any>;
  initialFetchComplete: boolean;
  conversation: ConversationType;
  messageContainerRef: React.RefObject<any>;
  selectMessage: (messageId: string) => void;
  getMessages: (numMessages: number) => Promise<void>;
  replyToMessage: (messageId: number) => Promise<void>;
  onClickAttachment: (attachment: any, message: any) => void;
  onDownloadAttachment: ({ attachment }: { attachment: any }) => void;
  onDeleteSelectedMessages: () => Promise<void>;
}

export class SessionConversationMessagesList extends React.Component<
  Props,
  State
> {
  private readonly messagesEndRef: React.RefObject<HTMLDivElement>;
  private readonly messageContainerRef: React.RefObject<any>;

  public constructor(props: Props) {
    super(props);

    this.state = {
      isScrolledToBottom: false,
      showScrollButton: false,
      doneInitialScroll: false,
    };
    this.renderMessage = this.renderMessage.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.messagesEndRef = React.createRef();
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
    if (prevProps.conversationKey !== this.props.conversationKey) {
      // we have a bit of cleaning to do here
      this.setState(
        {
          isScrolledToBottom: false,
          showScrollButton: false,
          doneInitialScroll: false,
        },
        this.scrollToUnread
      );
    } else {
      // Keep scrolled to bottom unless user scrolls up
      if (this.state.isScrolledToBottom) {
        this.scrollToBottom();
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
        <div ref={this.messagesEndRef} />

        <SessionScrollButton
          show={showScrollButton}
          onClick={this.scrollToBottom}
        />
      </div>
    );
  }

  public renderMessages(messages: any) {
    const multiSelectMode = Boolean(this.props.selectedMessages.length);
    // FIXME VINCE: IF MESSAGE IS THE TOP OF UNREAD, THEN INSERT AN UNREAD BANNER
    return (
      <>
        {messages.map((message: any) => {
          const messageProps = message.propsForMessage;

          const timerProps = message.propsForTimerNotification;
          const resetSessionProps = message.propsForResetSessionNotification;
          const propsForGroupInvitation = message.propsForGroupInvitation;

          const groupNotificationProps = message.propsForGroupNotification;

          if (groupNotificationProps) {
            return <GroupNotification {...groupNotificationProps} />;
          }

          if (propsForGroupInvitation) {
            return <GroupInvitation {...propsForGroupInvitation} />;
          }

          if (resetSessionProps) {
            return <ResetSessionNotification {...resetSessionProps} />;
          }

          if (timerProps) {
            return <TimerNotification {...timerProps} />;
          }

          // firstMessageOfSeries tells us to render the avatar only for the first message
          // in a series of messages from the same user
          return this.renderMessage(
            messageProps,
            message.firstMessageOfSeries,
            multiSelectMode
          );
        })}
      </>
    );
  }

  public renderMessage(
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
    messageProps.onSelectMessage = (messageId: string) => {
      this.selectMessage(messageId);
    };

    messageProps.onReply = (messageId: number) => {
      void this.props.replyToMessage(messageId);
    };

    messageProps.onClickAttachment = (attachment: any) => {
      this.props.onClickAttachment(attachment, messageProps);
    };
    messageProps.onDownload = (attachment: AttachmentType) => {
      this.props.onDownloadAttachment({ attachment });
    };

    return <Message {...messageProps} />;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~ MESSAGE HANDLING ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public updateReadMessages() {
    const { messages, conversationKey } = this.props;
    const { isScrolledToBottom } = this.state;

    let unread;

    if (!messages || messages.length === 0) {
      return;
    }

    const conversation = window.ConversationController.getOrThrow(
      conversationKey
    );

    if (conversation.isBlocked()) {
      return;
    }

    if (isScrolledToBottom) {
      unread = messages[0];
    } else {
      unread = null;
    }

    if (unread) {
      conversation.markRead(unread.attributes.received_at);
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ SCROLLING METHODS ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public async handleScroll() {
    const messageContainer = this.messageContainerRef?.current;
    if (!messageContainer) {
      return;
    }
    contextMenu.hideAll();

    if (!this.state.doneInitialScroll) {
      return;
    }

    const scrollTop = messageContainer.scrollTop;
    const scrollHeight = messageContainer.scrollHeight;
    const clientHeight = messageContainer.clientHeight;

    const scrollButtonViewShowLimit = 0.75;
    const scrollButtonViewHideLimit = 0.4;
    const scrollOffsetPx = scrollHeight - scrollTop - clientHeight;
    const scrollOffsetPc = scrollOffsetPx / clientHeight;

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
    const isScrolledToBottom = scrollOffsetPc === 0;

    // Pin scroll to bottom on new message, unless user has scrolled up
    if (this.state.isScrolledToBottom !== isScrolledToBottom) {
      this.setState({ isScrolledToBottom }, () => {
        // Mark messages read
        this.updateReadMessages();
      });
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

      await this.props.getMessages(numMessages);
      if (previousTopMessage && oldLen !== messages.length) {
        this.scrollToMessage(previousTopMessage);
      }
    }
  }

  public scrollToUnread() {
    const { messages, conversation } = this.props;
    const message = messages[conversation.unreadCount];

    if (message) {
      this.scrollToMessage(message.id);
    }
    if (!this.state.doneInitialScroll) {
      this.setState({
        doneInitialScroll: true,
      });
    }
  }

  public scrollToMessage(messageId: string) {
    const topUnreadMessage = document.getElementById(messageId);
    topUnreadMessage?.scrollIntoView();
  }

  public scrollToBottom() {
    // FIXME VINCE: Smooth scrolling that isn't slow@!
    // this.messagesEndRef.current?.scrollIntoView(
    //   { behavior: firstLoad ? 'auto' : 'smooth' }
    // );

    const messageContainer = this.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollTop =
      messageContainer.scrollHeight - messageContainer.clientHeight;
    this.updateReadMessages();
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ MESSAGE SELECTION ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public selectMessage(messageId: string) {
    this.props.selectMessage(messageId);
  }
}
