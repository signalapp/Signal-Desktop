import React from 'react';
import classNames from 'classnames';

import { ConversationHeader } from '../../conversation/ConversationHeader';
import { SessionCompositionBox } from './SessionCompositionBox';
import { SessionProgress } from '../SessionProgress'

import { Message } from '../../conversation/Message';
import { FriendRequest } from '../../conversation/FriendRequest';
import { TimerNotification } from '../../conversation/TimerNotification';

import { getTimestamp } from './SessionConversationManager';

import { SessionScrollButton } from '../SessionScrollButton';
import { SessionGroupSettings } from './SessionGroupSettings';

interface State {
  conversationKey: string;
  sendingProgess: number;
  prevSendingProgess: number;
  unreadCount: number;
  messages: Array<any>;
  selectedMessages: Array<string>;
  isScrolledToBottom: boolean;
  doneInitialScroll: boolean;
  displayScrollToBottomButton: boolean;
  messageFetchTimestamp: number;
  showRecordingView: boolean;
  showOptionsPane: boolean;
}

export class SessionConversation extends React.Component<any, State> {
  private messagesEndRef: React.RefObject<HTMLDivElement>;
  private messageContainerRef: React.RefObject<HTMLDivElement>;

  constructor(props: any) {
    super(props);

    console.log(`[conv] Props:`, props);
  
    const conversationKey = this.props.conversations.selectedConversation;
    const conversation = this.props.conversations.conversationLookup[conversationKey];
    const unreadCount = conversation.unreadCount;

    this.state = {
      sendingProgess: 0,
      prevSendingProgess: 0,
      conversationKey,
      unreadCount,
      messages: [],
      selectedMessages: [],
      isScrolledToBottom: !unreadCount,
      doneInitialScroll: false,
      displayScrollToBottomButton: false,
      messageFetchTimestamp: 0,
      showRecordingView: false,
      showOptionsPane: true,
    };

    this.handleScroll = this.handleScroll.bind(this);
    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.renderMessage = this.renderMessage.bind(this);
    this.renderTimerNotification = this.renderTimerNotification.bind(this);
    this.renderFriendRequest = this.renderFriendRequest.bind(this);

    // Group options panels
    this.toggleOptionsPane = this.toggleOptionsPane.bind(this);

    // Recording View render and unrender
    this.onLoadVoiceNoteView = this.onLoadVoiceNoteView.bind(this);
    this.onExitVoiceNoteView = this.onExitVoiceNoteView.bind(this);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.selectMessage = this.selectMessage.bind(this);
    this.resetSelection = this.resetSelection.bind(this);

    this.messagesEndRef = React.createRef();
    this.messageContainerRef = React.createRef();
  }

  public componentDidMount() {
    this.getMessages().then(() => {    
      // Pause thread to wait for rendering to complete
      setTimeout(() => {
        this.scrollToUnread();
      }, 0);
      setTimeout(() => {
        this.setState({
          doneInitialScroll: true,
        });
      }, 100);
    });

    
    //FIXME VINCE
    // Only now should you renderGroupOptionsPane
  }

  public componentDidUpdate(){
    // Keep scrolled to bottom unless user scrolls up
    if (this.state.isScrolledToBottom){
      this.scrollToBottom();
    }

    console.log(`[update] Props: `, this.props);
  }

  public async componentWillReceiveProps() {
    const timestamp = getTimestamp();

    // If we have pulled messages in the last second, don't bother rescanning
    // This avoids getting messages on every re-render.
    if (timestamp > this.state.messageFetchTimestamp) {
      await this.getMessages();
    }
  }

  public render() {
    console.log(`[vince][info] Props`, this.props);

    const { messages, conversationKey, doneInitialScroll, showRecordingView, showOptionsPane } = this.state;
    const loading = !doneInitialScroll || messages.length === 0;
    const selectionMode = !!this.state.selectedMessages.length;

    const conversation = this.props.conversations.conversationLookup[conversationKey];
    const conversationModel = window.getConversationByKey(conversationKey);
    const isRss = conversation.isRss;

    const sendMessageFn = conversationModel.sendMessage.bind(conversationModel);

    return (
      <>
        <div
          className={classNames('conversation-item__content', selectionMode && 'selection-mode')}
          tabIndex={0}
          onKeyDown={this.onKeyDown}
        >
          <div className="conversation-header">
            {this.renderHeader()}
          </div>

          <SessionProgress
            visible={true}
            value={this.state.sendingProgess}
            prevValue={this.state.prevSendingProgess}
          />

          <div className="messages-wrapper">
            { loading && (
              <div className="messages-container__loading"></div>
            )}

            <div
              className="messages-container"
              onScroll={this.handleScroll}
              ref={this.messageContainerRef}
            >
              {this.renderMessages()}
              <div ref={this.messagesEndRef} />
            </div>

            <SessionScrollButton display={true} onClick={this.scrollToBottom}/>
            { showRecordingView && (
              <div className="messages-wrapper--blocking-overlay"></div>
            )}
          </div>
          
          { !isRss && (
            <SessionCompositionBox
              sendMessage={sendMessageFn}
              onLoadVoiceNoteView={this.onLoadVoiceNoteView}
              onExitVoiceNoteView={this.onExitVoiceNoteView}
            />
          )}
          
        </div>

        <div className={classNames('conversation-item__options-pane', showOptionsPane && 'show')}>
          {/* Don't render this to the DOM unless it needs to be rendered */}
          {/* { showOptionsPane && ( */}
            <SessionGroupSettings
              id={conversationKey}
              name={"asdfasd"}
              memberCount={345}
              description={"Super cool open group"}
              avatarPath={conversation.avatarPath}
              timerOptions={
                window.Whisper.ExpirationTimerOptions.map((item: any) => ({
                  name: item.getName(),
                  value: item.get('seconds'),
                }))
              }
              isPublic={conversation.isPublic}
              isAdmin={conversation.isAdmin}
              amMod={conversation.amMod}
              onGoBack={this.toggleOptionsPane}
              onInviteFriends={() => null}
              onLeaveGroup={() => null}
              onUpdateGroupName={() => null}
              onUpdateGroupMembers={() => null}
              onShowLightBox={(options: any) => null}
              onSetDisappearingMessages={(seconds: number) => null}
            />
          {/* )} */}
          
        </div>

      </>
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

  public renderHeader() {
    const headerProps = this.getHeaderProps();

    console.log(`[header] Headerprops: `, headerProps);

    return (
      <ConversationHeader
        id={headerProps.id}
        phoneNumber={headerProps.phoneNumber}
        isVerified={headerProps.isVerified}
        isMe={headerProps.isMe}
        isFriend={headerProps.isFriend}
        i18n={window.i18n}
        isGroup={headerProps.isGroup}
        isArchived={headerProps.isArchived}
        isPublic={headerProps.isPublic}
        isRss={headerProps.isRss}
        amMod={headerProps.amMod}
        members={headerProps.members}
        showBackButton={headerProps.showBackButton}
        timerOptions={headerProps.timerOptions}
        isBlocked={headerProps.isBlocked}
        hasNickname={headerProps.hasNickname}
        isFriendRequestPending={headerProps.isFriendRequestPending}
        isOnline={headerProps.isOnline}
        selectedMessages={headerProps.selectedMessages}
        onUpdateGroupName={headerProps.onUpdateGroupName}
        onSetDisappearingMessages={headerProps.onSetDisappearingMessages}
        onDeleteMessages={headerProps.onDeleteMessages}
        onDeleteContact={headerProps.onDeleteContact}
        onResetSession={headerProps.onResetSession}
        onCloseOverlay={headerProps.onCloseOverlay}
        onDeleteSelectedMessages={headerProps.onDeleteSelectedMessages}
        onArchive={headerProps.onArchive}
        onMoveToInbox={headerProps.onMoveToInbox}
        onShowSafetyNumber={headerProps.onShowSafetyNumber}
        onShowAllMedia={headerProps.onShowAllMedia}
        onShowGroupMembers={headerProps.onShowGroupMembers}
        onGoBack={headerProps.onGoBack}
        onBlockUser={headerProps.onBlockUser}
        onUnblockUser={headerProps.onUnblockUser}
        onClearNickname={headerProps.onClearNickname}
        onChangeNickname={headerProps.onChangeNickname}
        onCopyPublicKey={headerProps.onCopyPublicKey}
        onLeaveGroup={headerProps.onLeaveGroup}
        onAddModerators={headerProps.onAddModerators}
        onRemoveModerators={headerProps.onRemoveModerators}
        onInviteFriends={headerProps.onInviteFriends}

        onAvatarClick={headerProps.onAvatarClick}
      />
    );
  }

  public renderMessage(messageProps: any, firstMessageOfSeries: boolean, quoteProps?: any) {
    const selected = !! messageProps?.id
      && this.state.selectedMessages.includes(messageProps.id);

    return (
      <Message
        i18n = {window.i18n}
        text = {messageProps?.text}
        direction = {messageProps?.direction}
        selected = {selected}
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
        onSelectMessage = {messageId => this.selectMessage(messageId)}
        onSelectMessageUnchecked = {messageProps?.onSelectMessageUnchecked}
        onShowDetail = {messageProps?.onShowDetail}
        onShowUserDetails = {messageProps?.onShowUserDetails}
        previews = {messageProps?.previews}
        quote = {quoteProps || undefined}
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

  public async getMessages(numMessages?: number, fetchInterval = window.CONSTANTS.MESSAGE_FETCH_INTERVAL, loopback = false){
    const { conversationKey, messageFetchTimestamp } = this.state;
    const timestamp = getTimestamp();

    // If we have pulled messages in the last interval, don't bother rescanning
    // This avoids getting messages on every re-render.
    const timeBuffer = timestamp - messageFetchTimestamp;
    if (timeBuffer < fetchInterval) {
      // Loopback gets messages after time has elapsed,
      // rather than completely cancelling the fetch.
      // if (loopback) {
      //   setTimeout(() => {
      //     this.getMessages(numMessages, fetchInterval, false);
      //   }, timeBuffer * 1000);
      // }      

      return { newTopMessage: undefined, previousTopMessage: undefined };
    }

    let msgCount = numMessages || window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT + this.state.unreadCount;
    msgCount = msgCount > window.CONSTANTS.MAX_MESSAGE_FETCH_COUNT
      ? window.CONSTANTS.MAX_MESSAGE_FETCH_COUNT
      : msgCount;

    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      { limit: msgCount, MessageCollection: window.Whisper.MessageCollection },
    );

    // Set first member of series here.
    const messageModels = messageSet.models;
    const messages = [];
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

    this.setState({ messages, messageFetchTimestamp: timestamp }, () => {
      if (this.state.isScrolledToBottom) {
        console.log(`[unread] Updating messages from getMessage`);
        this.updateReadMessages();
      }
    });

    return { newTopMessage, previousTopMessage };
  }

  public updateReadMessages() {
    const { isScrolledToBottom, messages, conversationKey } = this.state;
    let unread;

    if (!messages || messages.length === 0) {
      return;
    }

    console.log(`[unread] isScrollToBottom:`, isScrolledToBottom);

    if (isScrolledToBottom) {
      unread = messages[messages.length - 1];
    } else {
      console.log(`[unread] Calling findNewestVisibleUnread`)
      unread = this.findNewestVisibleUnread();
    }

    //console.log(`[unread] Messages:`, messages);
    console.log(`[unread] Updating read messages: `, unread);
    
    if (unread) {
      const model = window.ConversationController.get(conversationKey);
      model.markRead(unread.attributes.received_at);
    }
  }

  public findNewestVisibleUnread() {
    const messageContainer = this.messageContainerRef.current;
    if (!messageContainer) return null;

    const { messages, unreadCount } = this.state;
    const { length } = messages;

    const viewportBottom = (messageContainer?.clientHeight + messageContainer?.scrollTop) || 0;

    console.log(`[findNew] messages`, messages);

    // Start with the most recent message, search backwards in time
    let foundUnread = 0;
    for (let i = length - 1; i >= 0; i -= 1) {
      // Search the latest 30, then stop if we believe we've covered all known
      //   unread messages. The unread should be relatively recent.
      // Why? local notifications can be unread but won't be reflected the
      //   conversation's unread count.
      if (i > 30 && foundUnread >= unreadCount) {
        console.log(`[findNew] foundUnread > unreadCount`);
        return null;
      }

      const message = messages[i];

      if (!message.attributes.unread) {
        // eslint-disable-next-line no-continue
        console.log(`[findNew] no message.attributes`);
        continue;
      }

      foundUnread += 1;

      const el = document.getElementById(`${message.id}`);

      if (!el) {
        // eslint-disable-next-line no-continue
        console.log(`[findNew] no message.id`);
        continue;
      }

      const top = el.offsetTop;

      // If the bottom fits on screen, we'll call it visible. Even if the
      //   message is really tall.
      const height = el.offsetHeight;
      const bottom = top + height;

      // We're fully below the viewport, continue searching up.
      if (top > viewportBottom) {
        // eslint-disable-next-line no-continue
        console.log(`[findNew] top > viewportBottom`);
        continue;
      }

      if (bottom <= viewportBottom) {
        console.log(`[findNew] bottom <= viewportBottom`);
        console.log(`[findNew] Message set`);
        return message;
      }

      // Continue searching up.
    }

    return null;
  }

  public toggleOptionsPane() {
    const { showOptionsPane } = this.state;
    this.setState({ showOptionsPane: !showOptionsPane });
  }

  public async handleScroll() {
    const messageContainer = this.messageContainerRef.current;
    if (!messageContainer) return;

    const isScrolledToBottom = messageContainer.scrollHeight - messageContainer.clientHeight <= messageContainer.scrollTop + 1;

    // Mark messages read
    console.log(`[unread] Updating messages from handleScroll`);
    this.updateReadMessages();

    // Pin scroll to bottom on new message, unless user has scrolled up
    if (this.state.isScrolledToBottom !== isScrolledToBottom){
      this.setState({ isScrolledToBottom });
    }

    // Fetch more messages when nearing the top of the message list
    const shouldFetchMoreMessages = messageContainer.scrollTop <= window.CONSTANTS.MESSAGE_CONTAINER_BUFFER_OFFSET_PX;
    
    if (shouldFetchMoreMessages){
      const numMessages = this.state.messages.length + window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT;
      
      // Prevent grabbing messags with scroll more frequently than once per 5s.
      const messageFetchInterval = 2;
      const previousTopMessage = (await this.getMessages(numMessages, messageFetchInterval, true))?.previousTopMessage;
      previousTopMessage && this.scrollToMessage(previousTopMessage);
    }
  }

  public scrollToUnread() {
    const { messages, unreadCount } = this.state;
    const message = messages[(messages.length - 1) - unreadCount];
    
    if(message) this.scrollToMessage(message.id);
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
    if (!messageContainer) return;
    messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
  }

  public getHeaderProps() {
    const {conversationKey} = this.state;
    const conversation = window.getConversationByKey(conversationKey);

    console.log(`[header] Conversation`, conversation);

    const expireTimer = conversation.get('expireTimer');
    const expirationSettingName = expireTimer
      ? window.Whisper.ExpirationTimerOptions.getName(expireTimer || 0)
      : null;

    const members = conversation.get('members') || [];

    return {
      id: conversation.id,
      name: conversation.getName(),
      phoneNumber: conversation.getNumber(),
      profileName: conversation.getProfileName(),
      color: conversation.getColor(),
      avatarPath: conversation.getAvatarPath(),
      isVerified: conversation.isVerified(),
      isFriendRequestPending: conversation.isPendingFriendRequest(),
      isFriend: conversation.isFriend(),
      isMe: conversation.isMe(),
      isClosable: conversation.isClosable(),
      isBlocked: conversation.isBlocked(),
      isGroup: !conversation.isPrivate(),
      isOnline: conversation.isOnline(),
      isArchived: conversation.get('isArchived'),
      isPublic: conversation.isPublic(),
      isRss: conversation.isRss(),
      amMod: conversation.isModerator(
        window.storage.get('primaryDevicePubKey')
      ),
      members,
      subscriberCount: conversation.get('subscriberCount'),
      selectedMessages: this.state.selectedMessages,
      expirationSettingName,
      showBackButton: Boolean(conversation.panels && conversation.panels.length),
      timerOptions: window.Whisper.ExpirationTimerOptions.map((item: any) => ({
        name: item.getName(),
        value: item.get('seconds'),
      })),
      hasNickname: !!conversation.getNickname(),

      onSetDisappearingMessages: (seconds: any) =>
      conversation.setDisappearingMessages(seconds),
      onDeleteMessages: () => conversation.destroyMessages(),
      onDeleteSelectedMessages: () => conversation.deleteSelectedMessages(),
      onCloseOverlay: () => conversation.resetMessageSelection(),
      onDeleteContact: () => conversation.deleteContact(),
      onResetSession: () => this.resetSelection(),

      // These are view only and don't update the Conversation model, so they
      //   need a manual update call.
      onShowSafetyNumber: () => {
        conversation.showSafetyNumber();
      },
      onShowAllMedia: async () => {
        conversation.updateHeader();
      },
      onUpdateGroupName: () => {
        conversation.onUpdateGroupName();
      },
      onShowGroupMembers: async () => {
        await conversation.showMembers();
        conversation.updateHeader();
      },
      onGoBack: () => {
        conversation.resetPanel();
        conversation.updateHeader();
      },

      onBlockUser: () => {
        conversation.block();
      },
      onUnblockUser: () => {
        conversation.unblock();
      },
      onChangeNickname: () => {
        conversation.changeNickname();
      },
      onClearNickname: () => {
        conversation.setNickname(null);
      },
      onCopyPublicKey: () => {
        conversation.copyPublicKey();
      },
      onArchive: () => {
        conversation.unload('archive');
        conversation.setArchived(true);
      },
      onMoveToInbox: () => {
        conversation.setArchived(false);
      },
      onLeaveGroup: () => {
        window.Whisper.events.trigger('leaveGroup', conversation);
      },

      onInviteFriends: () => {
        window.Whisper.events.trigger('inviteFriends', conversation);
      },

      onAddModerators: () => {
        window.Whisper.events.trigger('addModerators', conversation);
      },

      onRemoveModerators: () => {
        window.Whisper.events.trigger('removeModerators', conversation);
      },

      onAvatarClick: (pubkey: any) => {
        if (conversation.isPrivate()) {
          window.Whisper.events.trigger('onShowUserDetails', {
            userPubKey: pubkey,
          });
        } else if (!conversation.isRss()) {
          this.toggleOptionsPane();
        }
      },
    };
  };

  public selectMessage(messageId: string) {
    const selectedMessages = this.state.selectedMessages.includes(messageId)
      // Add to array if not selected. Else remove.
      ? this.state.selectedMessages.filter(id => id !== messageId)
      : [...this.state.selectedMessages, messageId];
    
    this.setState({ selectedMessages },
      () => console.log(`[vince] SelectedMessages: `, this.state.selectedMessages)
    );
  }

  public resetSelection(){
    this.setState({selectedMessages: []});
  }

  public getGroupSettingsProps() {
    const {conversationKey} = this.state;
    const conversation = window.getConversationByKey[conversationKey];

    const ourPK = window.textsecure.storage.user.getNumber();
    const members = conversation.get('members') || [];

    return {
      id: conversation.id,
      name: conversation.getName(),
      phoneNumber: conversation.getNumber(),
      profileName: conversation.getProfileName(),
      color: conversation.getColor(),
      avatarPath: conversation.getAvatarPath(),
      isGroup: !conversation.isPrivate(),
      isPublic: conversation.isPublic(),
      isAdmin: conversation.get('groupAdmins').includes(ourPK),
      isRss: conversation.isRss(),
      memberCount: members.length,

      timerOptions: window.Whisper.ExpirationTimerOptions.map((item: any) => ({
        name: item.getName(),
        value: item.get('seconds'),
      })),

      onSetDisappearingMessages: (seconds: any) =>
        conversation.setDisappearingMessages(seconds),

      onGoBack: () => {
        conversation.hideConversationRight();
      },

      onUpdateGroupName: () => {
        window.Whisper.events.trigger('updateGroupName', conversation);
      },
      onUpdateGroupMembers: () => {
        window.Whisper.events.trigger('updateGroupMembers', conversation);
      },

      onLeaveGroup: () => {
        window.Whisper.events.trigger('leaveGroup', conversation);
      },

      onInviteFriends: () => {
        window.Whisper.events.trigger('inviteFriends', conversation);
      },
      onShowLightBox: (lightBoxOptions = {}) => {
        conversation.showChannelLightbox(lightBoxOptions);
      },
    };
  };

  private onLoadVoiceNoteView() {
    this.setState({
      showRecordingView: true,
      selectedMessages: [],
    })
  }

  private onExitVoiceNoteView() {
    this.setState({
      showRecordingView: false,
    });
    
    console.log(`[vince] Stopped recording entirely`);
  }

  private onKeyDown(event: any) {
    const messageContainer = this.messageContainerRef.current;
    if (!messageContainer) return;

    const selectionMode = !!this.state.selectedMessages.length;
    const recordingMode = this.state.showRecordingView;
    
    const pageHeight = messageContainer.clientHeight;
    const arrowScrollPx = 50;
    const pageScrollPx = 0.80 * pageHeight;
    
    console.log(`[vince][key] event: `, event);

    console.log(`[vince][key] key: `, event.key);
    console.log(`[vince][key] key: `, event.keyCode);
    if (event.key === 'Escape') {
      //
    }

    switch(event.key){
      case 'Escape':
        if (selectionMode) this.resetSelection();
        break;

      // Scrolling
      case 'ArrowUp':
        messageContainer.scrollBy(0, -arrowScrollPx);
        break;
      case 'ArrowDown':
        messageContainer.scrollBy(0, arrowScrollPx);
        break;
      case 'PageUp':
        messageContainer.scrollBy(0, -pageScrollPx);
        break;
      case 'PageDown':
        messageContainer.scrollBy(0, pageScrollPx);
        break;
      default:
        break;
    }

  }
  
}


