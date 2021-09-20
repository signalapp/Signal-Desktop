import React from 'react';

import { SessionScrollButton } from '../SessionScrollButton';
import { contextMenu } from 'react-contexify';
import {
  quotedMessageToAnimate,
  ReduxConversationType,
  showScrollToBottomButton,
  SortedMessageModelProps,
  updateHaveDoneFirstScroll,
} from '../../../state/ducks/conversations';
import { ToastUtils } from '../../../session/utils';
import { TypingBubble } from '../../conversation/TypingBubble';
import { getConversationController } from '../../../session/conversations';
import { MessageModel } from '../../../models/message';
import { QuoteClickOptions } from '../../../models/messageType';
import { getMessagesBySentAt } from '../../../data/data';
import autoBind from 'auto-bind';
import { ConversationTypeEnum } from '../../../models/conversation';
import { StateType } from '../../../state/reducer';
import { connect } from 'react-redux';
import {
  getFirstUnreadMessageId,
  getQuotedMessageToAnimate,
  getSelectedConversation,
  getSelectedConversationKey,
  getShowScrollButton,
  getSortedMessagesOfSelectedConversation,
} from '../../../state/selectors/conversations';
import { SessionMessagesList } from './SessionMessagesList';

export type SessionMessageListProps = {
  messageContainerRef: React.RefObject<any>;
};

type Props = SessionMessageListProps & {
  conversationKey?: string;
  messagesProps: Array<SortedMessageModelProps>;

  conversation?: ReduxConversationType;
  showScrollButton: boolean;
  animateQuotedMessageId: string | undefined;
  firstUnreadOnOpen: string | undefined;
};

class SessionMessagesListContainerInner extends React.Component<Props> {
  private timeoutResetQuotedScroll: NodeJS.Timeout | null = null;

  public constructor(props: Props) {
    super(props);
    autoBind(this);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidMount() {
    this.initialMessageLoadingPosition();
  }

  public componentWillUnmount() {
    if (this.timeoutResetQuotedScroll) {
      global.clearTimeout(this.timeoutResetQuotedScroll);
    }
  }

  public componentDidUpdate(
    prevProps: Props,
    _prevState: any,
    snapShot: { fakeScrollTop: number; realScrollTop: number; scrollHeight: number }
  ) {
    // this was hard to write, it should be hard to read
    // just make sure you don't remove that as a bug in chrome makes the column-reverse do bad things
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1189195&q=column-reverse&can=2#makechanges
    const currentRef = this.props.messageContainerRef.current;
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;
    const prevMsgLength = prevProps.messagesProps.length;
    const newMsgLength = this.props.messagesProps.length;

    const prevFirstMesssageId = prevProps.messagesProps[0]?.propsForMessage.id;
    const newFirstMesssageId = this.props.messagesProps[0]?.propsForMessage.id;
    const messageAddedWasMoreRecentOne = prevFirstMesssageId !== newFirstMesssageId;

    if (isSameConvo && snapShot?.realScrollTop && prevMsgLength !== newMsgLength) {
      if (messageAddedWasMoreRecentOne) {
        if (snapShot.scrollHeight - snapShot.realScrollTop < 50) {
          // consider that we were scrolled to bottom
          currentRef.scrollTop = 0;
        } else {
          currentRef.scrollTop = -(currentRef.scrollHeight - snapShot.realScrollTop);
        }
      } else {
        currentRef.scrollTop = snapShot.fakeScrollTop;
      }
    }
    if (!isSameConvo || (prevMsgLength === 0 && newMsgLength !== 0)) {
      this.setupTimeoutResetQuotedHighlightedMessage(this.props.animateQuotedMessageId);

      // displayed conversation changed. We have a bit of cleaning to do here
      this.initialMessageLoadingPosition();
    }
  }

  public getSnapshotBeforeUpdate() {
    const messageContainer = this.props.messageContainerRef.current;

    const scrollTop = messageContainer.scrollTop;
    const scrollHeight = messageContainer.scrollHeight;

    // as we use column-reverse for displaying message list
    // the top is < 0
    // tslint:disable-next-line: restrict-plus-operands
    const realScrollTop = scrollHeight + scrollTop;
    return {
      realScrollTop,
      fakeScrollTop: scrollTop,
      scrollHeight: scrollHeight,
    };
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
          pubkey={conversationKey}
          conversationType={conversation.type}
          displayedName={displayedName}
          isTyping={!!conversation.isTyping}
          key="typing-bubble"
        />

        <SessionMessagesList scrollToQuoteMessage={this.scrollToQuoteMessage} />

        <SessionScrollButton onClick={this.scrollToBottom} key="scroll-down-button" />
      </div>
    );
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ SCROLLING METHODS ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private handleScroll() {
    contextMenu.hideAll();
  }

  /**
   * Position the list to the middle of the loaded list if the conversation has unread messages and we have some messages loaded
   */
  private initialMessageLoadingPosition() {
    const { messagesProps, conversation, firstUnreadOnOpen } = this.props;
    if (!conversation || !messagesProps.length) {
      return;
    }

    if (
      (conversation.unreadCount && conversation.unreadCount <= 0) ||
      firstUnreadOnOpen === undefined
    ) {
      this.scrollToBottom();
    } else {
      // just assume that this need to be shown by default
      window.inboxStore?.dispatch(showScrollToBottomButton(true));
      const firstUnreadIndex = messagesProps.findIndex(
        m => m.propsForMessage.id === firstUnreadOnOpen
      );

      if (firstUnreadIndex === -1) {
        // the first unread message is not in the 30 most recent messages
        // just scroll to the middle as we don't have enough loaded message nevertheless
        const middle = Math.floor(messagesProps.length / 2);
        const idToStringTo = messagesProps[middle].propsForMessage.id;
        this.scrollToMessage(idToStringTo, 'center');
      } else {
        const messageElementDom = document.getElementById('unread-indicator');
        messageElementDom?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      }
    }

    setTimeout(() => {
      window.inboxStore?.dispatch(updateHaveDoneFirstScroll());
    }, 100);
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
  private setupTimeoutResetQuotedHighlightedMessage(messageId: string | undefined) {
    if (this.timeoutResetQuotedScroll) {
      global.clearTimeout(this.timeoutResetQuotedScroll);
    }

    if (messageId !== undefined) {
      this.timeoutResetQuotedScroll = global.setTimeout(() => {
        window.inboxStore?.dispatch(quotedMessageToAnimate(undefined));
      }, 2000); // should match .flash-green-once
    }
  }

  private scrollToMessage(messageId: string, block: 'center' | 'end' | 'nearest' | 'start') {
    const messageElementDom = document.getElementById(`msg-${messageId}`);
    messageElementDom?.scrollIntoView({
      behavior: 'auto',
      block,
    });
  }

  private scrollToBottom() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
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
    this.scrollToMessage(databaseId, 'center');
    // Highlight this message on the UI
    window.inboxStore?.dispatch(quotedMessageToAnimate(databaseId));
    this.setupTimeoutResetQuotedHighlightedMessage(databaseId);
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    conversationKey: getSelectedConversationKey(state),
    conversation: getSelectedConversation(state),
    messagesProps: getSortedMessagesOfSelectedConversation(state),
    showScrollButton: getShowScrollButton(state),
    animateQuotedMessageId: getQuotedMessageToAnimate(state),
    firstUnreadOnOpen: getFirstUnreadMessageId(state),
  };
};

const smart = connect(mapStateToProps);

export const SessionMessagesListContainer = smart(SessionMessagesListContainerInner);
