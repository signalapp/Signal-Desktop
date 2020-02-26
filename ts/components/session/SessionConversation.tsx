import React, { useEffect, useRef } from 'react';

import { ConversationHeader } from '../conversation/ConversationHeader';
import { SessionCompositionBox } from './SessionCompositionBox';
import { SessionProgress } from './SessionProgress'

import { Message } from '../conversation/Message';
import { FriendRequest } from '../conversation/FriendRequest';
import { TimerNotification } from '../conversation/TimerNotification';


import { SessionSpinner } from './SessionSpinner';
import { SessionScrollButton } from './SessionScrollButton';

// interface Props {
//   getHeaderProps: any;
//   conversationKey: any;
// }


interface State {
  sendingProgess: number;
  prevSendingProgess: number;
  conversationKey: string;
  unreadCount: number;
  messages: Array<any>;
  isScrolledToBottom: boolean;
  doneInitialScroll: boolean;
  messageFetchTimestamp: number;
}

export class SessionConversation extends React.Component<any, State> {
  private messagesEndRef: React.RefObject<HTMLDivElement>;

  constructor(props: any) {
    super(props);
    
    const conversationKey = this.props.conversations.selectedConversation;
    
    const conversation = this.props.conversations.conversationLookup[conversationKey];
    const unreadCount = conversation.unreadCount;

    console.log(`[vince][info] Conversation: `, conversation);

    this.state = {
      sendingProgess: 0,
      prevSendingProgess: 0,
      conversationKey,
      unreadCount,
      messages: [],
      isScrolledToBottom: !unreadCount,
      doneInitialScroll: false,
      messageFetchTimestamp: 0,
    };

    this.handleScroll = this.handleScroll.bind(this);
    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.renderMessage = this.renderMessage.bind(this);
    this.renderTimerNotification = this.renderTimerNotification.bind(this);
    this.renderFriendRequest = this.renderFriendRequest.bind(this);

    this.messagesEndRef = React.createRef();
  }

  public async componentWillMount() {
    await this.getMessages();
    
    // Inside a setTimeout to simultate onready()
    setTimeout(() => {
      this.scrollToUnread();
    }, 0);
    setTimeout(() => {
      this.setState({
        doneInitialScroll: true,
      });
    }, 100);
  }

  public componentDidUpdate(){
    // Keep scrolled to bottom unless user scrolls up
    if (this.state.isScrolledToBottom){
      this.scrollToBottom();
    }
  }

  public async componentWillReceiveProps() {
    const timestamp = this.getTimestamp();

    // If we have pulled messages in the last second, don't bother rescanning
    // This avoids getting messages on every re-render.
    if (timestamp > this.state.messageFetchTimestamp) {
      await this.getMessages();
    }
  }

  render() {
    // const headerProps = this.props.getHeaderProps;
    const { messages, conversationKey, doneInitialScroll } = this.state;
    const loading = !doneInitialScroll || messages.length === 0;

    const conversation = this.props.conversations.conversationLookup[conversationKey]

    return (
      <div className="conversation-item">
        <div className="conversation-header">
          {this.renderHeader(conversation)}
        </div>

        <SessionProgress
          visible={true}
          value={this.state.sendingProgess}
          prevValue={this.state.prevSendingProgess}
        />

        <div className="messages-wrapper">
          { loading && (
            <div className="messages-container__loading">
              {/* <SessionSpinner/> */}
            </div>
          )}

          <div className="messages-container" onScroll={this.handleScroll}>
            {this.renderMessages()}
            <div ref={this.messagesEndRef} />
          </div>

          <SessionScrollButton display={true} onClick={this.scrollToBottom}/>
          
        </div>
        
        <SessionCompositionBox
            onSendMessage={() => null}
        />
      </div>
    );
  }

  public renderMessages() {
    const { messages } = this.state;

    // FIXME VINCE: IF MESSAGE IS THE TOP OF UNREAD, THEN INSERT AN UNREAD BANNER

    return (
      <>{
        messages.map((message: any) => {
          const messageProps = message.propsForMessage;
          const timerProps = message.propsForTimerNotification;
          const friendRequestProps = message.propsForFriendRequest;
          const attachmentProps = message.propsForAttachment;
          const groupNotificationProps = message.propsForGroupNotification;
          const quoteProps = message.propsForQuote;
          
          let item;
          // firstMessageOfSeries tells us to render the avatar only for the first message
          // in a series of messages from the same user
          item = messageProps     ? this.renderMessage(messageProps, message.firstMessageOfSeries) : item;
          item = timerProps       ? this.renderTimerNotification(timerProps) : item;
          item = quoteProps       ? this.renderMessage(timerProps, message.firstMessageOfSeries, quoteProps) : item;
          item = friendRequestProps
            ? this.renderFriendRequest(friendRequestProps): item;
          // item = attachmentProps  ? this.renderMessage(timerProps) : item;

          return item;
        })
      }</>
    );

  }

  public renderHeader(conversation: any) {
    return (
      <ConversationHeader
        id={conversation.cid}
        phoneNumber={conversation.id}
        isVerified={true}
        isMe={false}
        isFriend={true}
        i18n={window.i18n}
        isGroup={false}
        isArchived={false}
        isPublic={false}
        isRss={false}
        amMod={false}
        members={[]}
        showBackButton={false}
        timerOptions={[]}
        isBlocked={false}
        hasNickname={false}
        isFriendRequestPending={false}
        isOnline={true}
        selectedMessages={null}
        onSetDisappearingMessages={() => null}
        onDeleteMessages={() => null}
        onDeleteContact={() => null}
        onResetSession={() => null}
        onCloseOverlay={() => null}
        onDeleteSelectedMessages={() => null}
        onArchive={() => null}
        onMoveToInbox={() => null}
        onShowSafetyNumber={() => null}
        onShowAllMedia={() => null}
        onShowGroupMembers={() => null}
        onGoBack={() => null}
        onBlockUser={() => null}
        onUnblockUser={() => null}
        onClearNickname={() => null}
        onChangeNickname={() => null}
        onCopyPublicKey={() => null}
        onLeaveGroup={() => null}
        onAddModerators={() => null}
        onRemoveModerators={() => null}
        onInviteFriends={() => null}
      />
    );
  }


  public renderMessage(messageProps: any, firstMessageOfSeries: boolean, quoteProps?: any) {

    return (
      <Message
        i18n = {window.i18n}
        text = {messageProps?.text}
        direction = {messageProps?.direction}
        timestamp = {messageProps?.timestamp}
        attachments = {messageProps?.attachments}
        authorAvatarPath = {messageProps?.authorAvatarPath}
        authorColor = {messageProps?.authorColor}
        authorName = {messageProps?.authorName}
        authorPhoneNumber = {messageProps?.authorPhoneNumber}
        firstMessageOfSeries = {firstMessageOfSeries}
        authorProfileName = {messageProps?.authorProfileName}
        contact = {messageProps?.contact}
        conversationType = {messageProps?.conversationType}
        convoId = {messageProps?.convoId}
        expirationLength = {messageProps?.expirationLength}
        expirationTimestamp = {messageProps?.expirationTimestamp}
        id = {messageProps?.id}
        isDeletable = {messageProps?.isDeletable}
        isExpired = {messageProps?.isExpired}
        isModerator = {messageProps?.isModerator}
        isPublic = {messageProps?.isPublic}
        isRss = {messageProps?.isRss}
        multiSelectMode = {messageProps?.multiSelectMode}
        onBanUser = {messageProps?.onBanUser}
        onClickAttachment = {messageProps?.onClickAttachment}
        onClickLinkPreview = {messageProps?.onClickLinkPreview}
        onCopyPubKey = {messageProps?.onCopyPubKey}
        onCopyText = {messageProps?.onCopyText}
        onDelete = {messageProps?.onDelete}
        onDownload = {messageProps?.onDownload}
        onReply = {messageProps?.onReply}
        onRetrySend = {messageProps?.onRetrySend}
        onSelectMessage = {messageProps?.onSelectMessage}
        onSelectMessageUnchecked = {messageProps?.onSelectMessageUnchecked}
        onShowDetail = {messageProps?.onShowDetail}
        onShowUserDetails = {messageProps?.onShowUserDetails}
        previews = {messageProps?.previews}
        quote = {quoteProps || undefined}
        selected = {messageProps?.selected}
        senderIsModerator = {messageProps?.senderIsModerator}
        status = {messageProps?.status}
        textPending = {messageProps?.textPending}
      />
    );

  }

  public renderTimerNotification(timerProps: any) {
    return (
      <TimerNotification
        type={timerProps.type}
        phoneNumber={timerProps.phoneNumber}
        profileName={timerProps.profileName}
        name={timerProps.name}
        disabled={timerProps.disabled}
        timespan={timerProps.timespan}
        i18n={window.i18n}
      />
    );
  }
  
  public renderFriendRequest(friendRequestProps: any){
    return (
      <FriendRequest
        text={friendRequestProps.text}
        direction={friendRequestProps.direction}
        status={friendRequestProps.status}
        friendStatus={friendRequestProps.friendStatus}
        i18n={window.i18n}
        isBlocked={friendRequestProps.isBlocked}
        timestamp={friendRequestProps.timestamp}
        onAccept={friendRequestProps.onAccept}
        onDecline={friendRequestProps.onDecline}
        onDeleteConversation={friendRequestProps.onDeleteConversation}
        onRetrySend={friendRequestProps.onRetrySend}
        onBlockUser={friendRequestProps.onBlockUser}
        onUnblockUser={friendRequestProps.onUnblockUser}
      />
    );
  }

  public async getMessages(numMessages?: number, fetchInterval = window.CONSTANTS.MESSAGE_FETCH_INTERVAL){
    const { conversationKey, messageFetchTimestamp } = this.state;
    const timestamp = this.getTimestamp();

    // If we have pulled messages in the last interval, don't bother rescanning
    // This avoids getting messages on every re-render.
    if (timestamp - messageFetchTimestamp < fetchInterval) {
      return { newTopMessage: undefined, previousTopMessage: undefined };
    }

    const msgCount = numMessages || window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT + this.state.unreadCount;
    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      { limit: msgCount, MessageCollection: window.Whisper.MessageCollection },
    );

    // Set first member of series here.
    const messageModels = messageSet.models;
    let messages = [];
    let previousSender;
    for (let i = 0; i < messageModels.length; i++){
      // Handle firstMessageOfSeries for conditional avatar rendering
      let firstMessageOfSeries = true;
      if (i > 0 && previousSender === messageModels[i].authorPhoneNumber){
        firstMessageOfSeries = false;
      }

      messages.push({...messageModels[i], firstMessageOfSeries});
      previousSender = messageModels[i].authorPhoneNumber;
    }

    const previousTopMessage = this.state.messages[0]?.id;
    const newTopMessage = messages[0]?.id;

    this.setState({ messages, messageFetchTimestamp });

    return { newTopMessage, previousTopMessage };
  }

  public getTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  public async handleScroll() {
    const { messages } = this.state;
    const messageContainer = document.getElementsByClassName('messages-container')[0];
    const isScrolledToBottom = messageContainer.scrollHeight - messageContainer.clientHeight <= messageContainer.scrollTop + 1;

    // FIXME VINCE: Update unread count
    // In models/conversations
    // Update unread count by geting all divs of .session-message-wrapper
    // which are currently in view.

    // Pin scroll to bottom on new message, unless user has scrolled up
    if (this.state.isScrolledToBottom !== isScrolledToBottom){
      this.setState({ isScrolledToBottom });
    }

    // Fetch more messages when nearing the top of the message list
    const shouldFetchMoreMessages = messageContainer.scrollTop <= window.CONSTANTS.MESSAGE_CONTAINER_BUFFER_OFFSET_PX;
    
    if (shouldFetchMoreMessages){
      const numMessages = this.state.messages.length + window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT;
      
      // Prevent grabbing messags with scroll more frequently than once per 5s.
      const messageFetchInterval = 5;
      const previousTopMessage = (await this.getMessages(numMessages, messageFetchInterval))?.previousTopMessage;
      previousTopMessage && this.scrollToMessage(previousTopMessage);
    }
  }

  public scrollToUnread() {
    const { messages, unreadCount } = this.state;

    const message = messages[(messages.length - 1) - unreadCount];
    this.scrollToMessage(message.id);
  }

  public scrollToMessage(messageId: string) {
    const topUnreadMessage = document.getElementById(messageId);
    topUnreadMessage?.scrollIntoView();
  }

  public scrollToBottom(instant = false) {
    // FIXME VINCE: Smooth scrolling that isn't slow@!
    // this.messagesEndRef.current?.scrollIntoView(
    //   { behavior: firstLoad ? 'auto' : 'smooth' }
    // );

    const messageContainer = document.getElementsByClassName('messages-container')[0];
    messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
  }
}

