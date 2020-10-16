// tslint:disable: no-backbone-get-set-outside-model

import React from 'react';

import classNames from 'classnames';

import { SessionCompositionBox } from './SessionCompositionBox';

import { getTimestamp } from './SessionConversationManager';

import { Constants } from '../../../session';
import { SessionKeyVerification } from '../SessionKeyVerification';
import _ from 'lodash';
import { UserUtil } from '../../../util';
import { MultiDeviceProtocol } from '../../../session/protocols';
import { ConversationHeaderWithDetails } from '../../conversation/ConversationHeader';
import { SessionRightPanelWithDetails } from './SessionRightPanel';
import { SessionTheme } from '../../../state/ducks/SessionTheme';
import { DefaultTheme } from 'styled-components';
import { SessionConversationMessagesList } from './SessionConversationMessagesList';

interface State {
  conversationKey: string;

  // Message sending progress
  messageProgressVisible: boolean;
  sendingProgress: number;
  prevSendingProgress: number;
  // Sending failed:  -1
  // Not send yet:     0
  // Sending message:  1
  // Sending success:  2
  sendingProgressStatus: -1 | 0 | 1 | 2;

  unreadCount: number;
  initialFetchComplete: boolean;
  messages: Array<any>;
  selectedMessages: Array<string>;
  isScrolledToBottom: boolean;
  doneInitialScroll: boolean;
  displayScrollToBottomButton: boolean;
  messageFetchTimestamp: number;

  showOverlay: boolean;
  showRecordingView: boolean;
  showOptionsPane: boolean;

  // For displaying `More Info` on messages, and `Safety Number`, etc.
  infoViewState?: 'safetyNumber' | 'messageDetails';

  // dropZoneFiles?: FileList
  dropZoneFiles: any;

  // quoted message
  quotedMessageTimestamp?: number;
  quotedMessageProps?: any;
}

interface Props {
  conversations: any;
  theme: DefaultTheme;
}

export class SessionConversation extends React.Component<Props, State> {
  private readonly compositionBoxRef: React.RefObject<HTMLDivElement>;

  constructor(props: any) {
    super(props);

    const conversationKey = this.props.conversations.selectedConversation;
    const conversation = this.props.conversations.conversationLookup[
      conversationKey
    ];

    const unreadCount = conversation.unreadCount;

    this.state = {
      messageProgressVisible: false,
      sendingProgress: 0,
      prevSendingProgress: 0,
      sendingProgressStatus: 0,
      conversationKey,
      unreadCount,
      initialFetchComplete: false,
      messages: [],
      selectedMessages: [],
      isScrolledToBottom: !unreadCount,
      doneInitialScroll: false,
      displayScrollToBottomButton: false,
      messageFetchTimestamp: 0,
      showOverlay: false,
      showRecordingView: false,
      showOptionsPane: false,
      infoViewState: undefined,
      dropZoneFiles: undefined, // <-- FileList or something else?
    };
    this.compositionBoxRef = React.createRef();

    // Group settings panel
    this.toggleGroupSettingsPane = this.toggleGroupSettingsPane.bind(this);
    this.getGroupSettingsProps = this.getGroupSettingsProps.bind(this);

    // Recording view
    this.onLoadVoiceNoteView = this.onLoadVoiceNoteView.bind(this);
    this.onExitVoiceNoteView = this.onExitVoiceNoteView.bind(this);

    // Messages
    this.loadInitialMessages = this.loadInitialMessages.bind(this);
    this.selectMessage = this.selectMessage.bind(this);
    this.resetSelection = this.resetSelection.bind(this);
    this.updateSendingProgress = this.updateSendingProgress.bind(this);
    this.resetSendingProgress = this.resetSendingProgress.bind(this);
    this.onMessageSending = this.onMessageSending.bind(this);
    this.onMessageSuccess = this.onMessageSuccess.bind(this);
    this.onMessageFailure = this.onMessageFailure.bind(this);
    this.deleteSelectedMessages = this.deleteSelectedMessages.bind(this);

    this.replyToMessage = this.replyToMessage.bind(this);
    this.getMessages = this.getMessages.bind(this);

    // Keyboard navigation
    this.onKeyDown = this.onKeyDown.bind(this);

    const conversationModel = window.ConversationController.getOrThrow(
      this.state.conversationKey
    );
    conversationModel.on('change', () => {
      this.setState({
        messages: conversationModel.messageCollection.models,
      });
    });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public async componentWillMount() {
    await this.loadInitialMessages();
    this.setState({ initialFetchComplete: true });
  }

  public componentDidMount() {
    // Pause thread to wait for rendering to complete
    setTimeout(() => {
      this.setState({
        doneInitialScroll: true,
      });
    }, 100);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~ RENDER METHODS ~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public render() {
    const {
      conversationKey,
      doneInitialScroll,
      showRecordingView,
      showOptionsPane,
      quotedMessageProps,
    } = this.state;
    const selectionMode = !!this.state.selectedMessages.length;

    const conversation = this.props.conversations.conversationLookup[
      conversationKey
    ];
    const conversationModel = window.ConversationController.getOrThrow(
      conversationKey
    );
    const isRss = conversation.isRss;

    // TODO VINCE: OPTIMISE FOR NEW SENDING???
    const sendMessageFn = conversationModel.sendMessage.bind(conversationModel);

    const shouldRenderGroupSettings =
      !conversationModel.isPrivate() && !conversationModel.isRss();
    const groupSettingsProps = this.getGroupSettingsProps();

    const showSafetyNumber = this.state.infoViewState === 'safetyNumber';
    const showMessageDetails = this.state.infoViewState === 'messageDetails';
    const messagesListProps = this.getMessagesListProps();

    return (
      <SessionTheme theme={this.props.theme}>
        <div className="conversation-header">{this.renderHeader()}</div>

        {/* <SessionProgress
            visible={this.state.messageProgressVisible}
            value={this.state.sendingProgress}
            prevValue={this.state.prevSendingProgress}
            sendStatus={this.state.sendingProgressStatus}
            resetProgress={this.resetSendingProgress}
          /> */}

        <div
          className={classNames(
            'conversation-content',
            selectionMode && 'selection-mode'
          )}
          tabIndex={0}
          onKeyDown={this.onKeyDown}
          role="navigation"
        >
          <div
            className={classNames(
              'conversation-info-panel',
              this.state.infoViewState && 'show'
            )}
          >
            {showSafetyNumber && (
              <SessionKeyVerification conversation={conversationModel} />
            )}
            {showMessageDetails && <>&nbsp</>}
          </div>

          <div className="conversation-messages">
            <SessionConversationMessagesList {...messagesListProps} />

            {showRecordingView && (
              <div className="conversation-messages__blocking-overlay" />
            )}
          </div>

          {!isRss && (
            <SessionCompositionBox
              sendMessage={sendMessageFn}
              dropZoneFiles={this.state.dropZoneFiles}
              onMessageSending={this.onMessageSending}
              onMessageSuccess={this.onMessageSuccess}
              onMessageFailure={this.onMessageFailure}
              onLoadVoiceNoteView={this.onLoadVoiceNoteView}
              onExitVoiceNoteView={this.onExitVoiceNoteView}
              quotedMessageProps={quotedMessageProps}
              removeQuotedMessage={() => {
                void this.replyToMessage(undefined);
              }}
              textarea={this.compositionBoxRef}
            />
          )}
        </div>

        {shouldRenderGroupSettings && (
          <div
            className={classNames(
              'conversation-item__options-pane',
              showOptionsPane && 'show'
            )}
          >
            <SessionRightPanelWithDetails {...groupSettingsProps} />
          </div>
        )}
      </SessionTheme>
    );
  }

  public renderHeader() {
    const headerProps = this.getHeaderProps();
    return <ConversationHeaderWithDetails {...headerProps} />;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~ GETTER METHODS ~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public async loadInitialMessages() {
    // Grabs the initial set of messages and adds them to our conversation model.
    // After the inital fetch, all new messages are automatically added from onNewMessage
    // in the conversation model.
    // The only time we need to call getMessages() is to grab more messages on scroll.
    const { conversationKey, initialFetchComplete } = this.state;
    const conversationModel = window.ConversationController.getOrThrow(
      conversationKey
    );

    if (initialFetchComplete) {
      return;
    }

    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      {
        limit: Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT,
        MessageCollection: window.Whisper.MessageCollection,
      }
    );

    const messages = messageSet.models.reverse();
    const messageFetchTimestamp = Date.now();

    this.setState({ messages, messageFetchTimestamp }, () => {
      // Add new messages to conversation collection
      conversationModel.messageCollection = messageSet;
    });
  }

  public async getMessages(
    numMessages?: number,
    fetchInterval = Constants.CONVERSATION.MESSAGE_FETCH_INTERVAL
  ) {
    const { conversationKey, messageFetchTimestamp } = this.state;

    const timestamp = getTimestamp();

    // If we have pulled messages in the last interval, don't bother rescanning
    // This avoids getting messages on every re-render.
    const timeBuffer = timestamp - messageFetchTimestamp;
    if (timeBuffer < fetchInterval) {
      return { newTopMessage: undefined, previousTopMessage: undefined };
    }

    let msgCount =
      numMessages ||
      Number(Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) +
        this.state.unreadCount;
    msgCount =
      msgCount > Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
        ? Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
        : msgCount;

    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      { limit: msgCount, MessageCollection: window.Whisper.MessageCollection }
    );

    // Set first member of series here.
    const messageModels = messageSet.models.reverse();
    const messages = [];
    let previousSender;
    for (let i = 0; i < messageModels.length; i++) {
      // Handle firstMessageOfSeries for conditional avatar rendering
      let firstMessageOfSeries = true;
      if (i > 0 && previousSender === messageModels[i].authorPhoneNumber) {
        firstMessageOfSeries = false;
      }

      messages.push({ ...messageModels[i], firstMessageOfSeries });
      previousSender = messageModels[i].authorPhoneNumber;
    }

    const previousTopMessage = this.state.messages[0]?.id;
    const newTopMessage = messages[0]?.id;

    this.setState({ messages, messageFetchTimestamp: timestamp });

    return { newTopMessage, previousTopMessage };
  }

  public getHeaderProps() {
    const { conversationKey } = this.state;
    const conversation = window.ConversationController.getOrThrow(
      conversationKey
    );
    const expireTimer = conversation.get('expireTimer');
    const expirationSettingName = expireTimer
      ? window.Whisper.ExpirationTimerOptions.getName(expireTimer || 0)
      : null;

    const members = conversation.get('members') || [];

    const headerProps = {
      i18n: window.i18n,
      id: conversation.id,
      name: conversation.getName(),
      phoneNumber: conversation.getNumber(),
      profileName: conversation.getProfileName(),
      avatarPath: conversation.getAvatarPath(),
      isVerified: conversation.isVerified(),
      isMe: conversation.isMe(),
      isClosable: conversation.isClosable(),
      isBlocked: conversation.isBlocked(),
      isGroup: !conversation.isPrivate(),
      isPrivate: conversation.isPrivate(),
      isOnline: conversation.isOnline(),
      isPublic: conversation.isPublic(),
      isRss: conversation.isRss(),
      amMod: conversation.isModerator(
        window.storage.get('primaryDevicePubKey')
      ),
      members,
      subscriberCount: conversation.get('subscriberCount'),
      selectedMessages: this.state.selectedMessages,
      isKickedFromGroup: conversation.get('isKickedFromGroup'),
      expirationSettingName,
      showBackButton: Boolean(this.state.infoViewState),
      timerOptions: window.Whisper.ExpirationTimerOptions.map((item: any) => ({
        name: item.getName(),
        value: item.get('seconds'),
      })),
      hasNickname: !!conversation.getNickname(),

      onSetDisappearingMessages: (seconds: any) =>
        conversation.updateExpirationTimer(seconds),
      onDeleteMessages: () => null,
      onDeleteSelectedMessages: async () => {
        await this.deleteSelectedMessages();
      },
      onCloseOverlay: () => {
        this.setState({ selectedMessages: [] });
        conversation.resetMessageSelection();
      },
      onDeleteContact: () => conversation.deleteContact(),
      onResetSession: () => {
        conversation.endSession();
      },

      onShowSafetyNumber: () => {
        this.setState({ infoViewState: 'safetyNumber' });
      },

      onGoBack: () => {
        this.setState({ infoViewState: undefined });
      },

      onUpdateGroupName: () => {
        conversation.onUpdateGroupName();
      },

      onBlockUser: () => {
        conversation.block();
      },
      onUnblockUser: () => {
        conversation.unblock();
      },
      onCopyPublicKey: () => {
        conversation.copyPublicKey();
      },
      onLeaveGroup: () => {
        window.Whisper.events.trigger('leaveGroup', conversation);
      },
      onInviteContacts: () => {
        window.Whisper.events.trigger('inviteContacts', conversation);
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
          this.toggleGroupSettingsPane();
        }
      },
    };

    return headerProps;
  }

  public getMessagesListProps() {
    const { conversationKey } = this.state;
    const conversation = window.ConversationController.getOrThrow(
      conversationKey
    );
    const conversationModel = window.ConversationController.getOrThrow(
      conversationKey
    );

    return {
      selectedMessages: this.state.selectedMessages,
      conversationKey: this.state.conversationKey,
      messages: this.state.messages,
      resetSelection: this.resetSelection,
      initialFetchComplete: this.state.initialFetchComplete,
      quotedMessageTimestamp: this.state.quotedMessageTimestamp,
      conversationModel: conversationModel,
      conversation: conversation,
      selectMessage: this.selectMessage,
      getMessages: this.getMessages,
      replyToMessage: this.replyToMessage,
      doneInitialScroll: this.state.doneInitialScroll,
    };
  }

  public getGroupSettingsProps() {
    const { conversationKey } = this.state;
    const conversation = window.ConversationController.getOrThrow(
      conversationKey
    );

    const ourPK = window.textsecure.storage.user.getNumber();
    const members = conversation.get('members') || [];
    const isAdmin = conversation.isMediumGroup()
      ? true
      : conversation.get('groupAdmins')?.includes(ourPK);

    return {
      id: conversation.id,
      name: conversation.getName(),
      memberCount: members.length,
      phoneNumber: conversation.getNumber(),
      profileName: conversation.getProfileName(),
      description: '', // TODO VINCE: ENSURE DESCRIPTION IS SET
      avatarPath: conversation.getAvatarPath(),
      amMod: conversation.isModerator(),
      isKickedFromGroup: conversation.attributes.isKickedFromGroup,
      isGroup: !conversation.isPrivate(),
      isPublic: conversation.isPublic(),
      isAdmin,
      isRss: conversation.isRss(),
      isBlocked: conversation.isBlocked(),

      timerOptions: window.Whisper.ExpirationTimerOptions.map((item: any) => ({
        name: item.getName(),
        value: item.get('seconds'),
      })),

      onSetDisappearingMessages: (seconds: any) => {
        if (seconds > 0) {
          void conversation.updateExpirationTimer(seconds);
        } else {
          void conversation.updateExpirationTimer(null);
        }
      },

      onGoBack: () => {
        this.toggleGroupSettingsPane();
      },

      onUpdateGroupName: () => {
        window.Whisper.events.trigger('updateGroupName', conversation);
      },
      onUpdateGroupMembers: () => {
        window.Whisper.events.trigger('updateGroupMembers', conversation);
      },
      onInviteContacts: () => {
        window.Whisper.events.trigger('inviteContacts', conversation);
      },
      onLeaveGroup: () => {
        window.Whisper.events.trigger('leaveGroup', conversation);
      },

      onShowLightBox: (lightBoxOptions = {}) => {
        conversation.showChannelLightbox(lightBoxOptions);
      },
    };
  }

  public toggleGroupSettingsPane() {
    const { showOptionsPane } = this.state;
    this.setState({ showOptionsPane: !showOptionsPane });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~ MESSAGE HANDLING ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public updateSendingProgress(value: number, status: -1 | 0 | 1 | 2) {
    // If you're sending a new message, reset previous value to zero
    const prevSendingProgress = status === 1 ? 0 : this.state.sendingProgress;

    this.setState({
      sendingProgress: value,
      prevSendingProgress,
      sendingProgressStatus: status,
    });
  }

  public resetSendingProgress() {
    this.setState({
      sendingProgress: 0,
      prevSendingProgress: 0,
      sendingProgressStatus: 0,
    });
  }

  public onMessageSending() {
    // Set sending state 5% to show message sending
    const initialValue = 5;
    this.updateSendingProgress(initialValue, 1);
    if (this.state.quotedMessageTimestamp) {
      this.setState({
        quotedMessageTimestamp: undefined,
        quotedMessageProps: undefined,
      });
    }
  }

  public onMessageSuccess() {
    this.updateSendingProgress(100, 2);
  }

  public onMessageFailure() {
    this.updateSendingProgress(100, -1);
  }

  public async deleteSelectedMessages() {
    // Get message objects
    const selectedMessages = this.state.messages.filter(message =>
      this.state.selectedMessages.find(
        selectedMessage => selectedMessage === message.id
      )
    );

    const { conversationKey } = this.state;
    const conversationModel = window.ConversationController.getOrThrow(
      conversationKey
    );

    const multiple = selectedMessages.length > 1;

    const isPublic = conversationModel.isPublic();

    // In future, we may be able to unsend private messages also
    // isServerDeletable also defined in ConversationHeader.tsx for
    // future reference
    const isServerDeletable = isPublic;

    const warningMessage = (() => {
      if (isPublic) {
        return multiple
          ? window.i18n('deleteMultiplePublicWarning')
          : window.i18n('deletePublicWarning');
      }
      return multiple
        ? window.i18n('deleteMultipleWarning')
        : window.i18n('deleteWarning');
    })();

    const doDelete = async () => {
      let toDeleteLocally;

      // VINCE TOOD: MARK TO-DELETE MESSAGES AS READ

      if (isPublic) {
        // Get our Moderator status
        const ourDevicePubkey = await UserUtil.getCurrentDevicePubKey();
        if (!ourDevicePubkey) {
          return;
        }
        const ourPrimaryPubkey = (
          await MultiDeviceProtocol.getPrimaryDevice(ourDevicePubkey)
        ).key;
        const isModerator = conversationModel.isModerator(ourPrimaryPubkey);
        const isAllOurs = selectedMessages.every(
          message =>
            message.propsForMessage.authorPhoneNumber === message.OUR_NUMBER
        );

        if (!isAllOurs && !isModerator) {
          window.pushToast({
            title: window.i18n('messageDeletionForbidden'),
            type: 'error',
            id: 'messageDeletionForbidden',
          });

          this.setState({ selectedMessages: [] });
          return;
        }

        toDeleteLocally = await conversationModel.deletePublicMessages(
          selectedMessages
        );
        if (toDeleteLocally.length === 0) {
          // Message failed to delete from server, show error?
          return;
        }
      } else {
        selectedMessages.forEach(m =>
          conversationModel.messageCollection.remove(m.id)
        );
        toDeleteLocally = selectedMessages;
      }

      await Promise.all(
        toDeleteLocally.map(async (message: any) => {
          await window.Signal.Data.removeMessage(message.id, {
            Message: window.Whisper.Message,
          });
          message.trigger('unload');
        })
      );

      // Update view and trigger update
      this.setState({ selectedMessages: [] }, () => {
        conversationModel.trigger('change', conversationModel);
      });
    };

    // Only show a warning when at least one messages was successfully
    // saved in on the server
    if (!selectedMessages.some(m => !m.hasErrors())) {
      await doDelete();
      return;
    }

    // If removable from server, we "Unsend" - otherwise "Delete"
    const pluralSuffix = multiple ? 's' : '';
    const title = window.i18n(
      isServerDeletable
        ? `deleteMessage${pluralSuffix}ForEveryone`
        : `deleteMessage${pluralSuffix}`
    );

    const okText = window.i18n(
      isServerDeletable ? 'deleteForEveryone' : 'delete'
    );

    window.confirmationDialog({
      title,
      message: warningMessage,
      okText,
      okTheme: 'danger',
      resolve: doDelete,
    });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ MESSAGE SELECTION ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public selectMessage(messageId: string) {
    const selectedMessages = this.state.selectedMessages.includes(messageId)
      ? // Add to array if not selected. Else remove.
        this.state.selectedMessages.filter(id => id !== messageId)
      : [...this.state.selectedMessages, messageId];

    this.setState({ selectedMessages });
  }

  public resetSelection() {
    this.setState({ selectedMessages: [] });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ MICROPHONE METHODS ~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private onLoadVoiceNoteView() {
    this.setState({
      showRecordingView: true,
      selectedMessages: [],
    });
  }

  private onExitVoiceNoteView() {
    this.setState({
      showRecordingView: false,
    });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~ MESSAGE QUOTE ~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private async replyToMessage(quotedMessageTimestamp?: number) {
    if (!_.isEqual(this.state.quotedMessageTimestamp, quotedMessageTimestamp)) {
      const { conversationKey } = this.state;
      const conversationModel = window.ConversationController.getOrThrow(
        conversationKey
      );

      const conversation = this.props.conversations.conversationLookup[
        conversationKey
      ];
      let quotedMessageProps = null;
      if (quotedMessageTimestamp) {
        const quotedMessageModel = conversationModel.getMessagesWithTimestamp(
          conversation.id,
          quotedMessageTimestamp
        );
        if (quotedMessageModel && quotedMessageModel.length === 1) {
          quotedMessageProps = await conversationModel.makeQuote(
            quotedMessageModel[0]
          );
        }
      }
      this.setState({ quotedMessageTimestamp, quotedMessageProps }, () => {
        this.compositionBoxRef.current?.focus();
      });
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~ KEYBOARD NAVIGATION ~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private onKeyDown(event: any) {
    // const messageContainer = this.messageContainerRef.current;
    // if (!messageContainer) {
    //   return;
    // }
    // const selectionMode = !!this.state.selectedMessages.length;
    // const recordingMode = this.state.showRecordingView;
    // const pageHeight = messageContainer.clientHeight;
    // const arrowScrollPx = 50;
    // const pageScrollPx = pageHeight * 0.8;
    // if (event.key === 'Escape') {
    //   // EXIT MEDIA VIEW
    //   if (recordingMode) {
    //     // EXIT RECORDING VIEW
    //   }
    //   // EXIT WHAT ELSE?
    // }
    // switch (event.key) {
    //   case 'Escape':
    //     if (selectionMode) {
    //       this.resetSelection();
    //     }
    //     break;
    //   // Scrolling
    //   case 'ArrowUp':
    //     messageContainer.scrollBy(0, -arrowScrollPx);
    //     break;
    //   case 'ArrowDown':
    //     messageContainer.scrollBy(0, arrowScrollPx);
    //     break;
    //   case 'PageUp':
    //     messageContainer.scrollBy(0, -pageScrollPx);
    //     break;
    //   case 'PageDown':
    //     messageContainer.scrollBy(0, pageScrollPx);
    //     break;
    //   default:
    // }
  }
}
