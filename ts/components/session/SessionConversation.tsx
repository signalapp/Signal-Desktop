import React, { useEffect, useRef } from 'react';

import { ConversationHeader } from '../conversation/ConversationHeader';
import { SessionCompositionBox } from './SessionCompositionBox';
import { SessionProgress } from './SessionProgress'

import { Message } from '../conversation/Message';
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
  messages: Array<any>;
  // Scroll position as percentage of message-list
  scrollPositionPc: number;
  // Scroll position in pixels
  scrollPositionPx: number;
  doneInitialScroll: boolean;
}

export class SessionConversation extends React.Component<any, State> {
  private messagesEndRef: React.RefObject<HTMLDivElement>;

  constructor(props: any) {
    super(props);
    const conversationKey = this.props.conversations.selectedConversation;

    this.state = {
      sendingProgess: 0,
      prevSendingProgess: 0,
      conversationKey,
      messages: [],
      doneInitialScroll: false,
      scrollPositionPc: 0,
      scrollPositionPx: 0,
    };

    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.renderMessage = this.renderMessage.bind(this);
    this.renderTimerNotification = this.renderTimerNotification.bind(this);

    this.messagesEndRef = React.createRef();
  }

  public async componentWillMount() {
    const { conversationKey } = this.state;
    await this.getMessages(conversationKey);

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

  }

  render() {
    console.log('[vince] SessionConversation was just rerendered!');
    console.log(`[vince] These are SessionConversation props: `, this.props);

    // const headerProps = this.props.getHeaderProps;
    const { messages, conversationKey, doneInitialScroll } = this.state;
    const loading = !doneInitialScroll || messages.length === 0;

    console.log(`[vince] Loading: `, loading);
    console.log(`[vince] My conversation key is: `, conversationKey);
    console.log(`[vince][messages]`, messages);


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
            {this.renderMessages(conversationKey)}
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
  
    // FIXME PAY ATTENTION; ONLY RENDER MESSAGES THAT ARE VISIBLE
    return (
      <>{
        messages.map((message: any) => {
          const messageProps = message.propsForMessage;
          const timerProps = message.propsForTimerNotification;
          const attachmentProps = message.propsForAttachment;
          const quoteProps = message.propsForQuote;
          
          console.log(`[vince][props] messageProps`, messageProps);
          console.log(`[vince][props] timerProps`, timerProps);
          console.log(`[vince][props] attachmentProps`, attachmentProps);
          console.log(`[vince][props] quoteProps`, quoteProps);

          let item;
          item = messageProps     ? this.renderMessage(messageProps) : item;
          item = timerProps       ? this.renderTimerNotification(timerProps) : item;
          item = attachmentProps  ? this.renderMessage(timerProps) : item;
          item = quoteProps       ? this.renderMessage(timerProps) : item;

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

  public scrollToUnread() {

  }

  public scrollToBottom(firstLoad = false) {
    this.messagesEndRef.current?.scrollIntoView(
      { behavior: firstLoad ? 'auto' : 'smooth' }
    );
  }

  public async getMessages(conversationKey: string, limit = window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT){
    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      { limit, MessageCollection: window.Whisper.MessageCollection },
    );

    console.log(`[vince][messages] MessageSet!!!`, messageSet);32

    const messages = messageSet.models;
    this.setState({ messages });
  }

  public renderMessage(messageProps: any) {
    return (
      <Message
        text = {messageProps.text || ''}
        direction = {messageProps.direction}
        timestamp = {messageProps.timestamp}
        i18n = {window.i18n}
        authorPhoneNumber = {messageProps.source}
        conversationType = {messageProps.conversationType}
        previews = {messageProps.previews}
        isExpired = {messageProps.isExpired}
        isDeletable = {messageProps.isDeletable}
        convoId = {messageProps.convoId}
        selected = {messageProps.selected}
        multiSelectMode = {messageProps.multiSelectMode}
        onSelectMessage = {messageProps.onSelectMessage}
        onSelectMessageUnchecked = {messageProps.onSelectMessageUnchecked}
        onShowDetail = {messageProps.onShowDetail}
        onShowUserDetails = {messageProps.onShowUserDetails}
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
}

