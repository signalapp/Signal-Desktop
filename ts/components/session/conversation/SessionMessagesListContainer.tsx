import React from 'react';

import { SessionScrollButton } from '../SessionScrollButton';
import { Constants } from '../../../session';
import _ from 'lodash';
import { contextMenu } from 'react-contexify';
import {
  fetchMessagesForConversation,
  markConversationFullyRead,
  quotedMessageToAnimate,
  ReduxConversationType,
  setNextMessageToPlay,
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
  areMoreMessagesBeingFetched,
  getQuotedMessageToAnimate,
  getSelectedConversation,
  getSelectedConversationKey,
  getShowScrollButton,
  getSortedMessagesOfSelectedConversation,
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
      clearTimeout(this.timeoutResetQuotedScroll);
    }
  }

  public componentDidUpdate(
    prevProps: Props,
    _prevState: any,
    snapshot: { scrollHeight: number; scrollTop: number }
  ) {
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;
    const messageLengthChanged = prevProps.messagesProps.length !== this.props.messagesProps.length;
    if (
      !isSameConvo ||
      (prevProps.messagesProps.length === 0 && this.props.messagesProps.length !== 0)
    ) {
      this.setupTimeoutResetQuotedHighlightedMessage(this.props.animateQuotedMessageId);

      // displayed conversation changed. We have a bit of cleaning to do here
      this.initialMessageLoadingPosition();
    } else {
      // if we got new message for this convo, and we are scrolled to bottom
      if (isSameConvo && messageLengthChanged) {
        // If we have a snapshot value, we've just added new items.
        // Adjust scroll so these new items don't push the old ones out of view.
        // (snapshot here is the value returned from getSnapshotBeforeUpdate)
        if (prevProps.messagesProps.length && snapshot !== null) {
          const list = this.props.messageContainerRef.current;

          // if we added a message at the top, keep position from the bottom.
          if (
            prevProps.messagesProps[0].propsForMessage.id ===
            this.props.messagesProps[0].propsForMessage.id
          ) {
            list.scrollTop = list.scrollHeight - (snapshot.scrollHeight - snapshot.scrollTop);
          } else {
            // if we added a message at the bottom, keep position from the bottom.
            list.scrollTop = snapshot.scrollTop;
          }
        }
      }
    }
  }

  public getSnapshotBeforeUpdate(prevProps: Props) {
    // getSnapshotBeforeUpdate is kind of pain to do in react hooks, so better keep the message list as a
    // class component for now

    // Are we adding new items to the list?
    // Capture the scroll position so we can adjust scroll later.
    if (prevProps.messagesProps.length < this.props.messagesProps.length) {
      const list = this.props.messageContainerRef.current;
      console.warn('getSnapshotBeforeUpdate ', {
        scrollHeight: list.scrollHeight,
        scrollTop: list.scrollTop,
      });
      return { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
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
  private handleScroll() {
    contextMenu.hideAll();
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
        this.scrollToMessage(messagesProps[firstUnread].propsForMessage.id);
      } else {
        // if we did not load all unread messages, just scroll to the middle of the loaded messages list. so the user can choose to go up or down from there
        const middle = Math.floor(messagesProps.length / 2);
        this.scrollToMessage(messagesProps[middle].propsForMessage.id);
      }
    }
    // window.inboxStore?.dispatch(updateHaveDoneFirstScroll());
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

  private scrollToMessage(messageId: string) {
    const messageElementDom = document.getElementById(`inview-${messageId}`);
    messageElementDom?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    });
  }

  private scrollToBottom() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    console.warn('scrollToBottom on messageslistcontainer');
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
    this.scrollToMessage(databaseId);
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
  };
};

const smart = connect(mapStateToProps);

export const SessionMessagesListContainer = smart(SessionMessagesListContainerInner);
