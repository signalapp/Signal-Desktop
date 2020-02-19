import React from 'react';

import { ConversationHeader } from '../conversation/ConversationHeader';
import { SessionCompositionBox } from './SessionCompositionBox';
import { SessionProgress } from './SessionProgress'

import { Message } from '../conversation/Message';



interface Props {
  getHeaderProps: any;
  conversationKey: any;
}

interface State {
  sendingProgess: number;
  prevSendingProgess: number;
  loadingMessages: boolean;
  messages: any;
}

export class SessionConversation extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      sendingProgess: 0,
      prevSendingProgess: 0,
      loadingMessages: false,
      messages: {},
    };
  }

  async componentWillMount() {
    const { conversationKey } = this.props;

    this.setState({
      messages: await window.getMessagesByKey(conversationKey)
    })
    
  }

  render() {
    // const headerProps = this.props.getHeaderProps;
    const { conversationKey } = this.props;

    // TMEPORARY SOLUTION TO GETTING CONVERSATION UNTIL
    // SessionConversationStack is created

    // Get conversation by Key (NOT cid)
    const conversation = window.getConversationByKey(conversationKey);

    console.log(`Conversation key: `, conversationKey);

    return (
      <div className={`conversation-item conversation-${conversation.cid}`}>
        <div className="conversation-header">
          {this.renderHeader(conversation)}
        </div>

        <SessionProgress
          visible={true}
          value={this.state.sendingProgess}
          prevValue={this.state.prevSendingProgess}
        />
        

        <div className="messages-container">
          {this.renderMessages(conversationKey)}

        </div>

        <SessionCompositionBox
            onSendMessage={() => null}
        />
      </div>
    );
  }

  public renderMessages(conversationKey: string ) {
    const { messages } = this.state;

    // FIXME PAY ATTENTION; ONLY RENDER MESSAGES THAT ARE VISIBLE
    const messagesLength = messages.length;

    console.log(`Messages`, messages);

    let messageList = [];

    messages?.keys.map(key => {
      const message = messages[key];
      return (<>THIS IS A MESSAGE</>)
    });
    console.log(messages);

    return messages;

    // for(let i = messagesLength - 1; i > 0; i--){
    //     messageList.push({
    //       isDeletable: true,
    //       text: 'fdgdfg',
    //       direction: 'incoming',
    //       timestamp: '1581565995228',
    //       i18n: window.i18n,
    //       authorPhoneNumber: messages[i].source,
    //       conversationType: 'direct',
    //       previews: [],
    //       isExpired: false, 
    //       convoId: messages[i].conversationId,
    //       selected: false,
    //       multiSelectMode: false,
    //       onSelectMessage: () => null,
    //       onSelectMessageUnchecked: () => null,
    //       onShowDetail : () => null,
    //       onShowUserDetails: () => null,
    //     });
    // }

    // console.log(`[vince] MessageList: `, messageList);

    // return messages && (
    //   <Message
    //     isDeletable = {false}
    //     text = {messages[0].body}
    //     direction = {'incoming'}
    //     timestamp = {1581565995228}
    //     i18n = {window.i18n}
    //     authorPhoneNumber = {messages[0].source}
    //     conversationType = {'direct'}
    //     previews = {[]}
    //     isExpired = {false}
    //     convoId = {messages[0].conversationId}
    //     selected = {false}
    //     multiSelectMode = {false}
    //     onSelectMessage = {() => null}
    //     onSelectMessageUnchecked = {() => null}
    //     onShowDetail = {() => null}
    //     onShowUserDetails = {() => null}
    //   />
    // )

    // return (
    //   <>
    //     {
    //       messageList.map(message => {
    //         return (
    //           <Message
    //             isDeletable = {message.isDeletable}
    //             text = {message.text}
    //             direction = {'incoming'}
    //             timestamp = {1581565995228}
    //             i18n = {message.i18n}
    //             authorPhoneNumber = {message.authorPhoneNumber}
    //             conversationType = {'direct'}
    //             previews = {message.previews}
    //             isExpired = {message.isExpired}
    //             convoId = {message.convoId}
    //             selected = {message.selected}
    //             multiSelectMode = {message.multiSelectMode}
    //             onSelectMessage = {message.onSelectMessage}
    //             onSelectMessageUnchecked = {message.onSelectMessageUnchecked}
    //             onShowDetail = {message.onShowDetail}
    //             onShowUserDetails = {message.onShowUserDetails}
    //           />
    //         )}
    //       );
    //     }
    //   </>
    // );
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
}
