import React from 'react';

import { SessionScrollButton } from '../SessionScrollButton';
import { contextMenu } from 'react-contexify';

import { connect, useSelector } from 'react-redux';

import { SessionMessagesList } from './SessionMessagesList';
import styled from 'styled-components';
import autoBind from 'auto-bind';
import { ConversationTypeEnum } from '../../models/conversation';
import { getConversationController } from '../../session/conversations';
import {
  quotedMessageToAnimate,
  ReduxConversationType,
  resetOldBottomMessageId,
  resetOldTopMessageId,
  showScrollToBottomButton,
  SortedMessageModelProps,
} from '../../state/ducks/conversations';
import { StateType } from '../../state/reducer';
import {
  getFirstUnreadMessageId,
  getQuotedMessageToAnimate,
  getSelectedConversation,
  getSelectedConversationKey,
  getShowScrollButton,
  getSortedMessagesOfSelectedConversation,
  isFirstUnreadMessageIdAbove,
} from '../../state/selectors/conversations';
import { TypingBubble } from './TypingBubble';

export type SessionMessageListProps = {
  messageContainerRef: React.RefObject<HTMLDivElement>;
};

export const ScrollToLoadedMessageContext = React.createContext(
  // tslint:disable-next-line: no-empty
  (_loadedMessageIdToScrollTo: string) => {}
);

const SessionUnreadAboveIndicator = styled.div`
  position: sticky;
  top: 0;
  margin: 1em;
  display: flex;
  justify-content: center;
  background: var(--color-sent-message-background);
  color: var(--color-sent-message-text);
`;

const UnreadAboveIndicator = () => {
  const isFirstUnreadAbove = useSelector(isFirstUnreadMessageIdAbove);
  const firstUnreadMessageId = useSelector(getFirstUnreadMessageId) as string;

  if (!isFirstUnreadAbove) {
    return null;
  }
  return (
    <SessionUnreadAboveIndicator key={`above-unread-indicator-${firstUnreadMessageId}`}>
      {window.i18n('latestUnreadIsAbove')}
    </SessionUnreadAboveIndicator>
  );
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

  public componentDidUpdate(prevProps: Props, _prevState: any) {
    // // If you want to mess with this, be my guest.
    // // just make sure you don't remove that as a bug in chrome makes the column-reverse do bad things
    // // https://bugs.chromium.org/p/chromium/issues/detail?id=1189195&q=column-reverse&can=2#makechanges
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;

    if (
      !isSameConvo &&
      this.props.messagesProps.length &&
      this.props.messagesProps[0].propsForMessage.convoId === this.props.conversationKey
    ) {
      this.setupTimeoutResetQuotedHighlightedMessage(this.props.animateQuotedMessageId);
      // displayed conversation changed. We have a bit of cleaning to do here
      this.initialMessageLoadingPosition();
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
        data-testid="messages-container"
      >
        <UnreadAboveIndicator />

        <TypingBubble
          pubkey={conversationKey}
          conversationType={conversation.type}
          displayedName={displayedName}
          isTyping={!!conversation.isTyping}
          key="typing-bubble"
        />

        <ScrollToLoadedMessageContext.Provider value={this.scrollToQuoteMessage}>
          <SessionMessagesList
            scrollAfterLoadMore={(
              messageIdToScrollTo: string,
              type: 'load-more-top' | 'load-more-bottom'
            ) => {
              const isLoadMoreTop = type === 'load-more-top';
              const isLoadMoreBottom = type === 'load-more-bottom';
              this.scrollToMessage(messageIdToScrollTo, isLoadMoreTop ? 'start' : 'end', {
                isLoadMoreTop,
                isLoadMoreBottom,
              });
            }}
            onPageDownPressed={this.scrollPgDown}
            onPageUpPressed={this.scrollPgUp}
            onHomePressed={this.scrollTop}
            onEndPressed={this.scrollEnd}
          />
        </ScrollToLoadedMessageContext.Provider>

        <SessionScrollButton onClick={this.scrollToMostRecentMessage} key="scroll-down-button" />
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
      this.scrollToMostRecentMessage();
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
          block: 'center',
        });
      }
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
      global.clearTimeout(this.timeoutResetQuotedScroll);
    }

    if (messageId !== undefined) {
      this.timeoutResetQuotedScroll = global.setTimeout(() => {
        window.inboxStore?.dispatch(quotedMessageToAnimate(undefined));
      }, 2000); // should match .flash-green-once
    }
  }

  private scrollToMessage(
    messageId: string,
    block: ScrollLogicalPosition | undefined,
    options?: { isLoadMoreTop: boolean | undefined; isLoadMoreBottom: boolean | undefined }
  ) {
    const messageElementDom = document.getElementById(`msg-${messageId}`);

    messageElementDom?.scrollIntoView({
      behavior: 'auto',
      block,
    });

    this.props.messageContainerRef.current?.scrollBy({ top: -50 });

    if (options?.isLoadMoreTop) {
      // reset the oldTopInRedux so that a refresh/new message does not scroll us back here again
      window.inboxStore?.dispatch(resetOldTopMessageId());
    }
    if (options?.isLoadMoreBottom) {
      // reset the oldBottomInRedux so that a refresh/new message does not scroll us back here again
      window.inboxStore?.dispatch(resetOldBottomMessageId());
    }
  }

  private scrollToMostRecentMessage() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
  }

  private scrollPgUp() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollBy({
      top: Math.floor(-messageContainer.clientHeight * 2) / 3,
      behavior: 'smooth',
    });
  }

  private scrollPgDown() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    // tslint:disable-next-line: restrict-plus-operands
    messageContainer.scrollBy({
      top: Math.floor(+messageContainer.clientHeight * 2) / 3,
      behavior: 'smooth',
    });
  }

  private scrollTop() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    messageContainer.scrollTo(0, -messageContainer.scrollHeight);
  }

  private scrollEnd() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    messageContainer.scrollTo(0, 0);
  }

  private scrollToQuoteMessage(loadedQuoteMessageToScrollTo: string) {
    if (!this.props.conversationKey || !loadedQuoteMessageToScrollTo) {
      return;
    }

    const { messagesProps } = this.props;

    // If there's no message already in memory, we won't be scrolling. So we'll gather
    //   some more information then show an informative toast to the user.
    if (!messagesProps.find(m => m.propsForMessage.id === loadedQuoteMessageToScrollTo)) {
      throw new Error('this message is not loaded');
    }

    this.scrollToMessage(loadedQuoteMessageToScrollTo, 'start');
    // Highlight this message on the UI
    window.inboxStore?.dispatch(quotedMessageToAnimate(loadedQuoteMessageToScrollTo));
    this.setupTimeoutResetQuotedHighlightedMessage(loadedQuoteMessageToScrollTo);
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
