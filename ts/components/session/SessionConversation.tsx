import React, { useEffect, useRef } from 'react';

import { ConversationHeader } from '../conversation/ConversationHeader';
import { SessionCompositionBox } from './SessionCompositionBox';
import { SessionProgress } from './SessionProgress'

import { Message } from '../conversation/Message';
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
    const messages = this.props.conversations.conversationLookup[conversationKey].messages;

    this.state = {
      sendingProgess: 0,
      prevSendingProgess: 0,
      conversationKey,
      messages,
      doneInitialScroll: false,
      scrollPositionPc: 0,
      scrollPositionPx: 0,
    };

    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.messagesEndRef = React.createRef();
  }

  public componentDidMount() {
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 20);

    this.setState({
      doneInitialScroll: true,
    });
  }

  public componentWillUpdate () {
    console.log(`[vince][update] State:`, this.state);
    console.log(`[vince][update] Props:`, this.props);
    
  }

  public componentWillReceiveProps() {
    const { conversationKey, messages } = this.state;
    const conversation = this.props.conversations.conversationLookup[conversationKey];

    // Check if another message came through
    const shouldLoad = !messages.length || (conversation.lastUpdated > messages[messages.length - 1]?.received_at);

    console.log(`[vince][update] conversation:`, conversation);
    console.log(`[vince][update] conversation.lastupdated: `, conversation.lastUpdated)
    console.log(`[vince][update] last message received at: `, messages[messages.length - 1]?.received_at)
    console.log(`[vince][update] Should Update: `, shouldLoad)
    console.log(`[vince][update] called ComponentWillRevieceProps. Messages: `, this.state.messages)

    // if (conversationKey && shouldLoad){
    //   this.setState({
    //     messages: await window.getMessagesByKey(conversationKey, true)
    //   });
    // }

    // this.setState({
    //       messages: this.props.conversations.conversationLookup[conversationKey]?.messsages,
    // });

  }

  render() {
    console.log('[vince] SessionConversation was just rerendered!');
    console.log(`[vince] These are SessionConversation props: `, this.props);

    // const headerProps = this.props.getHeaderProps;
    const { messages, conversationKey, doneInitialScroll } = this.state;
    const loading = !doneInitialScroll

    console.log(`[vince] Loading: `, loading);
    console.log(`[vince] My conversation key is: `, conversationKey);

    // TMEPORARY SOLUTION TO GETTING CONVERSATION UNTIL
    // SessionConversationStack is created

    // Get conversation by Key (NOT cid)
    const conversation = this.props.conversations.conversationLookup[conversationKey]
    const conversationType = conversation.type;

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
              <SessionSpinner/>
            </div>
          )}

          <div className="messages-container">
            {this.renderMessages(conversationKey, conversationType)}
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

  public renderMessages(conversationKey: string, conversationType: 'group' | 'direct') {
    const { messages } = this.state;
    
    console.log(`[vince][messages]`, messages);

    // FIND FOR EACH MESSAGE
    const isExpired = false;
    const isDeletable = false;
    const messageType = 'direct';
    const selected = false;
    const preview:any = [];
    const multiSelectMode = false;
    const onSelectMessage = () => null;
    const onSelectMessageUnchecked = () => null;
    const onShowDetail = () => null;
    const onShowUserDetails = () => null;


    // FIXME PAY ATTENTION; ONLY RENDER MESSAGES THAT ARE VISIBLE
    return (
      <>{
        messages.map((message: any) => {

          return message.body && (
            <Message
              text = {message.body || ''}
              direction = {'incoming'}
              timestamp = {1581565995228}
              i18n = {window.i18n}
              authorPhoneNumber = {message.source}
              conversationType = {conversationType}
              previews = {preview}
              isExpired = {isExpired}
              isDeletable = {isDeletable}
              convoId = {conversationKey}
              selected = {selected}
              multiSelectMode = {multiSelectMode}
              onSelectMessage = {onSelectMessage}
              onSelectMessageUnchecked = {onSelectMessageUnchecked}
              onShowDetail = {onShowDetail}
              onShowUserDetails = {onShowUserDetails}
            />
          )}
        )
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
}
