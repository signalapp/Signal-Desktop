import React from 'react';

import { SessionScrollButton } from '../SessionScrollButton';
import { Constants } from '../../../session';
import _ from 'lodash';
import { contextMenu } from 'react-contexify';
import {
  fetchMessagesForConversation,
  quotedMessageToAnimate,
  ReduxConversationType,
  setNextMessageToPlay,
  showScrollToBottomButton,
  SortedMessageModelProps,
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
  getSortedMessagesOfSelectedConversation,
  getQuotedMessageToAnimate,
  getSelectedConversation,
  getSelectedConversationKey,
  getShowScrollButton,
  areMoreMessagesBeingFetched,
} from '../../../state/selectors/conversations';
import { isElectronWindowFocused } from '../../../session/utils/WindowUtils';
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
  areMoreMessagesBeingFetched: boolean;
};

class SessionMessagesListContainerInner extends React.Component<Props> {
  private ignoreScrollEvents: boolean;
  private timeoutResetQuotedScroll: NodeJS.Timeout | null = null;

  public constructor(props: Props) {
    super(props);
    autoBind(this);

    this.ignoreScrollEvents = true;
    this.triggerFetchMoreMessages = _.debounce(this.triggerFetchMoreMessages, 100);
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

  public componentDidUpdate(prevProps: Props, _prevState: any, snapshot: any) {
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;
    const messageLengthChanged = prevProps.messagesProps.length !== this.props.messagesProps.length;
    if (
      !isSameConvo ||
      (prevProps.messagesProps.length === 0 && this.props.messagesProps.length !== 0)
    ) {
      this.setupTimeoutResetQuotedHighlightedMessage(this.props.animateQuotedMessageId);

      // displayed conversation changed. We have a bit of cleaning to do here
      this.ignoreScrollEvents = true;
      this.initialMessageLoadingPosition();
      this.ignoreScrollEvents = false;
    } else {
      // if we got new message for this convo, and we are scrolled to bottom
      if (isSameConvo && messageLengthChanged) {
        // If we have a snapshot value, we've just added new items.
        // Adjust scroll so these new items don't push the old ones out of view.
        // (snapshot here is the value returned from getSnapshotBeforeUpdate)
        if (prevProps.messagesProps.length && snapshot !== null) {
          this.ignoreScrollEvents = true;

          const list = this.props.messageContainerRef.current;
          list.scrollTop = list.scrollHeight - snapshot;
          this.ignoreScrollEvents = false;
        }
      }
    }
  }

  public getSnapshotBeforeUpdate(prevProps: Props) {
    // Are we adding new items to the list?
    // Capture the scroll position so we can adjust scroll later.
    if (prevProps.messagesProps.length < this.props.messagesProps.length) {
      const list = this.props.messageContainerRef.current;
      return list.scrollHeight - list.scrollTop;
    }
    return null;
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

        <SessionMessagesList
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
  private updateReadMessages(forceIsOnBottom = false) {
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

    if ((forceIsOnBottom || this.getScrollOffsetBottomPx() === 0) && isElectronWindowFocused()) {
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
      const isScrolledToBottom = bottomOfBottomMessage <= containerBottom - 5;
      if (isScrolledToBottom) {
        // Mark messages read
        this.updateReadMessages(true);
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

        const oldLen = messagesProps.length;
        const previousTopMessage = messagesProps[oldLen - 1]?.propsForMessage.id;

        this.triggerFetchMoreMessages();
        if (previousTopMessage && oldLen !== messagesProps.length) {
          this.scrollToMessage(previousTopMessage);
        }
      }
    }
  }

  private triggerFetchMoreMessages() {
    const { messagesProps } = this.props;

    const numMessages = messagesProps.length + Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
    (window.inboxStore?.dispatch as any)(
      fetchMessagesForConversation({
        conversationKey: this.props.conversationKey as string,
        count: numMessages,
      })
    );
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
  private setupTimeoutResetQuotedHighlightedMessage(messageId: string | undefined) {
    if (this.timeoutResetQuotedScroll) {
      clearTimeout(this.timeoutResetQuotedScroll);
    }

    if (messageId !== undefined) {
      this.timeoutResetQuotedScroll = global.setTimeout(() => {
        window.inboxStore?.dispatch(quotedMessageToAnimate(undefined));
      }, 2000); // should match .flash-green-once
    }
  }

  private scrollToMessage(messageId: string, scrollIsQuote: boolean = false) {
    const messageElementDom = document.getElementById(messageId);
    messageElementDom?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    });

    // we consider that a `scrollIsQuote` set to true, means it's a quoted message, so highlight this message on the UI
    if (scrollIsQuote) {
      window.inboxStore?.dispatch(quotedMessageToAnimate(messageId));
      this.setupTimeoutResetQuotedHighlightedMessage(messageId);
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

export const SessionMessagesListContainer = smart(SessionMessagesListContainerInner);
