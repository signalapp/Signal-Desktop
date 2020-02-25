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
  // Scroll position as percentage of message-list
  scrollPositionPc: number;
  // Scroll position in pixels
  scrollPositionPx: number;
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
      doneInitialScroll: false,
      scrollPositionPc: 0,
      scrollPositionPx: 0,
      messageFetchTimestamp: 0,
    };

    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.renderMessage = this.renderMessage.bind(this);
    this.renderTimerNotification = this.renderTimerNotification.bind(this);
    this.renderFriendRequest = this.renderFriendRequest.bind(this);

    this.messagesEndRef = React.createRef();
  }

  public async componentWillMount() {
    const { conversationKey } = this.state;
    await this.getMessages(conversationKey);
    
    // Inside a setTimeout to simultate onready()
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 0);
    setTimeout(() => {
      this.setState({
        doneInitialScroll: true,
      });
    }, 100);

  }

  public async componentWillReceiveProps() {
    const { conversationKey } = this.state;
    const timestamp = this.getTimestamp();

    // If we have pulled messages in the last second, don't bother rescanning
    // This avoids getting messages on every re-render.
    if (timestamp > this.state.messageFetchTimestamp) {
      await this.getMessages(conversationKey);
    } else{
      console.log(`[vince][info] Messages recieved in last second, stream`);
    }
  }

  render() {
    console.log('[vince] SessionConversation was just rerendered!');
    console.log(`[vince] These are SessionConversation props: `, this.props);

    // const headerProps = this.props.getHeaderProps;
    const { messages, conversationKey, doneInitialScroll } = this.state;
    const loading = !doneInitialScroll || messages.length === 0;

    console.log(`[vince] Loading: `, loading);
    console.log(`[vince] My conversation key is: `, conversationKey);


    // TMEPORARY SOLUTION TO GETTING CONVERSATION UNTIL
    // SessionConversationStack is created

    // Get conversation by Key (NOT cid)
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

          <div className="messages-container">
            {this.renderMessages()}
            <div ref={this.messagesEndRef} />
          </div>

          <SessionScrollButton display={true} onClick={this.scrollToUnread}/>

          
        </div>
        
        <SessionCompositionBox
            onSendMessage={() => null}
        />
      </div>
    );
  }

  public renderMessages() {
    const { messages } = this.state;
    
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


  public async getMessages(conversationKey: string){
    const msgCount = window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT + this.state.unreadCount;
    
    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      { msgCount, MessageCollection: window.Whisper.MessageCollection },
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

    const messageFetchTimestamp = this.getTimestamp();
    
    console.log(`[vince][messages] Messages Set`, messageModels);
    this.setState({ messages, messageFetchTimestamp });
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

  public getTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  public handleScroll() {
    // Update unread count

    // Get id of message at bottom of screen in full view. This is scroll position by messageID

  }

  public scrollToUnread() {
    const topUnreadMessage = document.getElementById('70fd6220-5292-43d8-9e0d-f98bf4792f43');
    topUnreadMessage?.scrollIntoView(false);
  }

  public scrollToBottom(firstLoad = false) {
    this.messagesEndRef.current?.scrollIntoView(
      { behavior: firstLoad ? 'auto' : 'smooth' }
    );
  }
}

