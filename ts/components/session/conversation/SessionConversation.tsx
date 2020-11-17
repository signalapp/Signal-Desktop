// tslint:disable: no-backbone-get-set-outside-model

import React from 'react';

import classNames from 'classnames';

import {
  SessionCompositionBox,
  StagedAttachmentType,
} from './SessionCompositionBox';

import { Constants } from '../../../session';
import { SessionKeyVerification } from '../SessionKeyVerification';
import _ from 'lodash';
import { AttachmentUtil, GoogleChrome, UserUtil } from '../../../util';
import { MultiDeviceProtocol } from '../../../session/protocols';
import { ConversationHeaderWithDetails } from '../../conversation/ConversationHeader';
import { SessionRightPanelWithDetails } from './SessionRightPanel';
import { SessionTheme } from '../../../state/ducks/SessionTheme';
import { DefaultTheme } from 'styled-components';
import { SessionConversationMessagesList } from './SessionConversationMessagesList';
import { LightboxGallery, MediaItemType } from '../../LightboxGallery';
import { Message } from '../../conversation/media-gallery/types/Message';

import { AttachmentType, save } from '../../../types/Attachment';
import { ToastUtils } from '../../../session/utils';
import * as MIME from '../../../types/MIME';
import { SessionFileDropzone } from './SessionFileDropzone';
import { ConversationType } from '../../../state/ducks/conversations';
import { MessageView } from '../../MainViewController';
import { getMessageById } from '../../../../js/modules/data';
import { pushUnblockToSend } from '../../../session/utils/Toast';

interface State {
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
  selectedMessages: Array<string>;
  isScrolledToBottom: boolean;
  displayScrollToBottomButton: boolean;

  showOverlay: boolean;
  showRecordingView: boolean;
  showOptionsPane: boolean;

  // For displaying `More Info` on messages, and `Safety Number`, etc.
  infoViewState?: 'safetyNumber' | 'messageDetails';

  stagedAttachments: Array<StagedAttachmentType>;
  isDraggingFile: boolean;

  // quoted message
  quotedMessageTimestamp?: number;
  quotedMessageProps?: any;

  // lightbox options
  lightBoxOptions?: any;
}

interface Props {
  conversationKey: string;
  conversation: ConversationType;
  theme: DefaultTheme;
  messages: Array<any>;
  actions: any;
}

export class SessionConversation extends React.Component<Props, State> {
  private readonly compositionBoxRef: React.RefObject<HTMLDivElement>;
  private readonly messageContainerRef: React.RefObject<HTMLDivElement>;
  private dragCounter: number;

  constructor(props: any) {
    super(props);

    const { conversationKey } = this.props;

    const conversationModel = window.ConversationController.get(
      conversationKey
    );

    const unreadCount = conversationModel?.get('unreadCount') || 0;
    this.state = {
      messageProgressVisible: false,
      sendingProgress: 0,
      prevSendingProgress: 0,
      sendingProgressStatus: 0,
      unreadCount,
      selectedMessages: [],
      isScrolledToBottom: !unreadCount,
      displayScrollToBottomButton: false,
      showOverlay: false,
      showRecordingView: false,
      showOptionsPane: false,
      infoViewState: undefined,
      stagedAttachments: [],
      isDraggingFile: false,
    };
    this.compositionBoxRef = React.createRef();
    this.messageContainerRef = React.createRef();
    this.dragCounter = 0;

    // Group settings panel
    this.toggleRightPanel = this.toggleRightPanel.bind(this);
    this.getRightPanelProps = this.getRightPanelProps.bind(this);

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
    this.onClickAttachment = this.onClickAttachment.bind(this);
    this.downloadAttachment = this.downloadAttachment.bind(this);

    // Keyboard navigation
    this.onKeyDown = this.onKeyDown.bind(this);

    this.renderLightBox = this.renderLightBox.bind(this);

    // attachments
    this.clearAttachments = this.clearAttachments.bind(this);
    this.addAttachments = this.addAttachments.bind(this);
    this.removeAttachment = this.removeAttachment.bind(this);
    this.onChoseAttachments = this.onChoseAttachments.bind(this);
    this.handleDragIn = this.handleDragIn.bind(this);
    this.handleDragOut = this.handleDragOut.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      conversationKey: newConversationKey,
      conversation: newConversation,
    } = this.props;
    const { conversationKey: oldConversationKey } = prevProps;

    // if the convo is valid, and it changed, register for drag events
    if (
      newConversationKey &&
      newConversation &&
      newConversationKey !== oldConversationKey
    ) {
      // Pause thread to wait for rendering to complete
      setTimeout(() => {
        const div = this.messageContainerRef.current;
        div?.addEventListener('dragenter', this.handleDragIn);
        div?.addEventListener('dragleave', this.handleDragOut);
        div?.addEventListener('dragover', this.handleDrag);
        div?.addEventListener('drop', this.handleDrop);
      }, 100);
    }
    // if we do not have a model, unregister for events
    if (!newConversation) {
      const div = this.messageContainerRef.current;
      div?.removeEventListener('dragenter', this.handleDragIn);
      div?.removeEventListener('dragleave', this.handleDragOut);
      div?.removeEventListener('dragover', this.handleDrag);
      div?.removeEventListener('drop', this.handleDrop);
    }
    if (newConversationKey !== oldConversationKey) {
      void this.loadInitialMessages();
      this.setState({
        showOptionsPane: false,
        selectedMessages: [],
        // isScrolledToBottom: !this.props.unreadCount,
        displayScrollToBottomButton: false,
        showOverlay: false,
        showRecordingView: false,
        infoViewState: undefined,
        stagedAttachments: [],
        isDraggingFile: false,
      });
    }
  }

  public componentWillUnmount() {
    const div = this.messageContainerRef.current;
    div?.removeEventListener('dragenter', this.handleDragIn);
    div?.removeEventListener('dragleave', this.handleDragOut);
    div?.removeEventListener('dragover', this.handleDrag);
    div?.removeEventListener('drop', this.handleDrop);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~ RENDER METHODS ~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public render() {
    const {
      showRecordingView,
      showOptionsPane,
      quotedMessageProps,
      lightBoxOptions,
      selectedMessages,
      isDraggingFile,
      stagedAttachments,
    } = this.state;
    const selectionMode = !!selectedMessages.length;

    const { conversation, conversationKey, messages } = this.props;
    const conversationModel = window.ConversationController.get(
      conversationKey
    );

    if (!conversationModel || !messages) {
      // return an empty message view
      return <MessageView />;
    }

    const { isRss } = conversation;

    // TODO VINCE: OPTIMISE FOR NEW SENDING???
    const sendMessageFn = conversationModel.sendMessage.bind(conversationModel);

    const shouldRenderRightPanel = !conversationModel.isRss();

    const showSafetyNumber = this.state.infoViewState === 'safetyNumber';
    const showMessageDetails = this.state.infoViewState === 'messageDetails';

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

          {lightBoxOptions?.media && this.renderLightBox(lightBoxOptions)}

          <div className="conversation-messages">
            <SessionConversationMessagesList {...this.getMessagesListProps()} />

            {showRecordingView && (
              <div className="conversation-messages__blocking-overlay" />
            )}
            {isDraggingFile && <SessionFileDropzone />}
          </div>

          {!isRss && (
            // tslint:disable-next-line: use-simple-attributes
            <SessionCompositionBox
              isBlocked={conversation.isBlocked}
              leftGroup={conversation.leftGroup}
              isKickedFromGroup={conversation.isKickedFromGroup}
              isPrivate={conversation.type === 'direct'}
              sendMessage={sendMessageFn}
              stagedAttachments={stagedAttachments}
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
              clearAttachments={this.clearAttachments}
              removeAttachment={this.removeAttachment}
              onChoseAttachments={this.onChoseAttachments}
            />
          )}
        </div>

        {shouldRenderRightPanel && (
          <div
            className={classNames(
              'conversation-item__options-pane',
              showOptionsPane && 'show'
            )}
          >
            <SessionRightPanelWithDetails {...this.getRightPanelProps()} />
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
    const { conversationKey } = this.props;
    const conversationModel = window.ConversationController.get(
      conversationKey
    );
    if (!conversationModel) {
      return;
    }
    const unreadCount = await conversationModel.getUnreadCount();
    const messagesToFetch = Math.max(
      Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT,
      unreadCount
    );
    this.props.actions.fetchMessagesForConversation({
      conversationKey,
      count: messagesToFetch,
    });
  }

  public getHeaderProps() {
    const { conversationKey } = this.props;
    const { selectedMessages, infoViewState } = this.state;
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
      isKickedFromGroup: conversation.get('isKickedFromGroup'),
      expirationSettingName,
      showBackButton: Boolean(infoViewState),
      timerOptions: window.Whisper.ExpirationTimerOptions.map((item: any) => ({
        name: item.getName(),
        value: item.get('seconds'),
      })),
      hasNickname: !!conversation.getNickname(),
      selectionMode: !!selectedMessages.length,

      onSetDisappearingMessages: (seconds: any) =>
        conversation.updateExpirationTimer(seconds),
      onDeleteMessages: () => conversation.deleteMessages(),
      onDeleteSelectedMessages: this.deleteSelectedMessages,
      onCloseOverlay: () => {
        this.setState({ selectedMessages: [] });
      },
      onDeleteContact: () => conversation.deleteContact(),
      onResetSession: () => {
        void conversation.endSession();
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
        if (!conversation.isRss()) {
          this.toggleRightPanel();
        }
      },
    };

    return headerProps;
  }

  public getMessagesListProps() {
    const { conversation, messages, actions } = this.props;
    const { quotedMessageTimestamp, selectedMessages } = this.state;

    return {
      selectedMessages,
      conversationKey: conversation.id,
      messages,
      resetSelection: this.resetSelection,
      quotedMessageTimestamp,
      conversation,
      selectMessage: this.selectMessage,
      fetchMessagesForConversation: actions.fetchMessagesForConversation,
      replyToMessage: this.replyToMessage,
      onClickAttachment: this.onClickAttachment,
      onDownloadAttachment: this.downloadAttachment,
      messageContainerRef: this.messageContainerRef,
      onDeleteSelectedMessages: this.deleteSelectedMessages,
    };
  }

  public getRightPanelProps() {
    const { conversationKey } = this.props;
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
        this.toggleRightPanel();
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
        this.setState({ lightBoxOptions });
      },
    };
  }

  public toggleRightPanel() {
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
    const { conversationKey, messages } = this.props;

    const conversationModel = window.ConversationController.getOrThrow(
      conversationKey
    );
    const selectedMessages = messages.filter(message =>
      this.state.selectedMessages.find(
        selectedMessage => selectedMessage === message.id
      )
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
        const ourNumbers = (await MultiDeviceProtocol.getOurDevices()).map(
          m => m.key
        );
        const isAllOurs = selectedMessages.every(message =>
          ourNumbers.includes(message.attributes.source)
        );

        if (!isAllOurs && !isModerator) {
          ToastUtils.pushMessageDeleteForbidden();

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
        toDeleteLocally = selectedMessages;
      }

      await Promise.all(
        toDeleteLocally.map(async (message: any) => {
          await window.Signal.Data.removeMessage(message.id, {
            Message: window.Whisper.Message,
          });
        })
      );

      // Update view and trigger update
      this.setState({ selectedMessages: [] });
    };

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
    if (this.props.conversation.isBlocked) {
      pushUnblockToSend();
      return;
    }
    if (!_.isEqual(this.state.quotedMessageTimestamp, quotedMessageTimestamp)) {
      const { messages, conversationKey } = this.props;
      const conversationModel = window.ConversationController.getOrThrow(
        conversationKey
      );

      let quotedMessageProps = null;
      if (quotedMessageTimestamp) {
        const quotedMessage = messages.find(
          m => m.attributes.sent_at === quotedMessageTimestamp
        );

        if (quotedMessage) {
          const quotedMessageModel = await getMessageById(quotedMessage.id, {
            Message: window.Whisper.Message,
          });
          if (quotedMessageModel) {
            quotedMessageProps = await conversationModel.makeQuote(
              quotedMessageModel
            );
          }
        }
      }
      this.setState({ quotedMessageTimestamp, quotedMessageProps }, () => {
        this.compositionBoxRef.current?.focus();
      });
    }
  }

  private onClickAttachment(attachment: any, message: any) {
    const lightBoxOptions = {
      media: [
        {
          objectURL: attachment.url,
          contentType: attachment.contentType,
          attachment,
        },
      ],
      attachment,
    };
    this.setState({ lightBoxOptions });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~ KEYBOARD NAVIGATION ~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private onKeyDown(event: any) {
    const messageContainer = this.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    const selectionMode = !!this.state.selectedMessages.length;
    const recordingMode = this.state.showRecordingView;
    const pageHeight = messageContainer.clientHeight;
    const arrowScrollPx = 50;
    const pageScrollPx = pageHeight * 0.8;
    if (event.key === 'Escape') {
      // EXIT MEDIA VIEW
      if (recordingMode) {
        // EXIT RECORDING VIEW
      }
      // EXIT WHAT ELSE?
    }
    switch (event.key) {
      case 'Escape':
        if (selectionMode) {
          this.resetSelection();
        }
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
    }
  }

  private clearAttachments() {
    this.state.stagedAttachments.forEach(attachment => {
      if (attachment.url) {
        URL.revokeObjectURL(attachment.url);
      }
      if (attachment.videoUrl) {
        URL.revokeObjectURL(attachment.videoUrl);
      }
    });
    this.setState({ stagedAttachments: [] });
  }

  private removeAttachment(attachment: AttachmentType) {
    const { stagedAttachments } = this.state;
    const updatedStagedAttachments = (stagedAttachments || []).filter(
      m => m.fileName !== attachment.fileName
    );

    this.setState({ stagedAttachments: updatedStagedAttachments });
  }

  private addAttachments(newAttachments: Array<StagedAttachmentType>) {
    const { stagedAttachments } = this.state;
    let newAttachmentsFiltered: Array<StagedAttachmentType> = [];
    if (newAttachments?.length > 0) {
      if (
        newAttachments.some(a => a.isVoiceMessage) &&
        stagedAttachments.length > 0
      ) {
        throw new Error('A voice note cannot be sent with other attachments');
      }
      // do not add already added attachments
      newAttachmentsFiltered = newAttachments.filter(
        a => !stagedAttachments.some(b => b.file.path === a.file.path)
      );
    }

    this.setState({
      stagedAttachments: [...stagedAttachments, ...newAttachmentsFiltered],
    });
  }

  private renderLightBox({
    media,
    attachment,
  }: {
    media: Array<MediaItemType>;
    attachment: any;
  }) {
    const selectedIndex =
      media.length > 1
        ? media.findIndex(
            (mediaMessage: any) =>
              mediaMessage.attachment.path === attachment.path
          )
        : 0;
    return (
      <LightboxGallery
        media={media}
        close={() => {
          this.setState({ lightBoxOptions: undefined });
        }}
        selectedIndex={selectedIndex}
        onSave={this.downloadAttachment}
      />
    );
  }

  // THIS DOES NOT DOWNLOAD ANYTHING! it just saves it where the user wants
  private downloadAttachment({
    attachment,
    message,
    index,
  }: {
    attachment: AttachmentType;
    message?: Message;
    index?: number;
  }) {
    const { getAbsoluteAttachmentPath } = window.Signal.Migrations;

    save({
      attachment,
      document,
      getAbsolutePath: getAbsoluteAttachmentPath,
      timestamp: message?.received_at || Date.now(),
    });
  }

  private async onChoseAttachments(attachmentsFileList: FileList) {
    if (!attachmentsFileList || attachmentsFileList.length === 0) {
      return;
    }

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < attachmentsFileList.length; i++) {
      await this.maybeAddAttachment(attachmentsFileList[i]);
    }
  }

  // tslint:disable: max-func-body-length cyclomatic-complexity
  private async maybeAddAttachment(file: any) {
    if (!file) {
      return;
    }

    const fileName = file.name;
    const contentType = file.type;

    const { stagedAttachments } = this.state;

    if (window.Signal.Util.isFileDangerous(fileName)) {
      ToastUtils.pushDangerousFileError();
      return;
    }

    if (stagedAttachments.length >= 32) {
      ToastUtils.pushMaximumAttachmentsError();
      return;
    }

    const haveNonImage = _.some(
      stagedAttachments,
      attachment => !MIME.isImage(attachment.contentType)
    );
    // You can't add another attachment if you already have a non-image staged
    if (haveNonImage) {
      ToastUtils.pushMultipleNonImageError();
      return;
    }

    // You can't add a non-image attachment if you already have attachments staged
    if (!MIME.isImage(contentType) && stagedAttachments.length > 0) {
      ToastUtils.pushCannotMixError();
      return;
    }
    const { VisualAttachment } = window.Signal.Types;

    const renderVideoPreview = async () => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const type = 'image/png';

        const thumbnail = await VisualAttachment.makeVideoScreenshot({
          objectUrl,
          contentType: type,
          logger: window.log,
        });
        const data = await VisualAttachment.blobToArrayBuffer(thumbnail);
        const url = window.Signal.Util.arrayBufferToObjectURL({
          data,
          type,
        });
        this.addAttachments([
          {
            file,
            size: file.size,
            fileName,
            contentType,
            videoUrl: objectUrl,
            url,
            isVoiceMessage: false,
          },
        ]);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    const renderImagePreview = async () => {
      if (!MIME.isJPEG(contentType)) {
        const urlImage = URL.createObjectURL(file);
        if (!urlImage) {
          throw new Error('Failed to create object url for image!');
        }
        this.addAttachments([
          {
            file,
            size: file.size,
            fileName,
            contentType,
            url: urlImage,
            isVoiceMessage: false,
          },
        ]);
        return;
      }

      const url = await window.autoOrientImage(file);
      this.addAttachments([
        {
          file,
          size: file.size,
          fileName,
          contentType,
          url,
          isVoiceMessage: false,
        },
      ]);
    };

    try {
      const blob = await AttachmentUtil.autoScale({
        contentType,
        file,
      });
      let limitKb = 10000;
      const blobType =
        file.type === 'image/gif' ? 'gif' : contentType.split('/')[0];

      switch (blobType) {
        case 'image':
          limitKb = 6000;
          break;
        case 'gif':
          limitKb = 10000;
          break;
        case 'audio':
          limitKb = 10000;
          break;
        case 'video':
          limitKb = 10000;
          break;
        default:
          limitKb = 10000;
      }
      // if ((blob.file.size / 1024).toFixed(4) >= limitKb) {
      //   const units = ['kB', 'MB', 'GB'];
      //   let u = -1;
      //   let limit = limitKb * 1000;
      //   do {
      //     limit /= 1000;
      //     u += 1;
      //   } while (limit >= 1000 && u < units.length - 1);
      //   // this.showFileSizeError(limit, units[u]);
      //   return;
      // }
    } catch (error) {
      window.log.error(
        'Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );

      ToastUtils.pushLoadAttachmentFailure();
      return;
    }

    try {
      if (GoogleChrome.isImageTypeSupported(contentType)) {
        await renderImagePreview();
      } else if (GoogleChrome.isVideoTypeSupported(contentType)) {
        await renderVideoPreview();
      } else {
        this.addAttachments([
          {
            file,
            size: file.size,
            contentType,
            fileName,
            url: '',
            isVoiceMessage: false,
          },
        ]);
      }
    } catch (e) {
      window.log.error(
        `Was unable to generate thumbnail for file type ${contentType}`,
        e && e.stack ? e.stack : e
      );
      this.addAttachments([
        {
          file,
          size: file.size,
          contentType,
          fileName,
          isVoiceMessage: false,
          url: '',
        },
      ]);
    }
  }

  private handleDrag(e: any) {
    e.preventDefault();
    e.stopPropagation();
  }

  private handleDragIn(e: any) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      this.setState({ isDraggingFile: true });
    }
  }

  private handleDragOut(e: any) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter--;

    if (this.dragCounter === 0) {
      this.setState({ isDraggingFile: false });
    }
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e?.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void this.onChoseAttachments(e.dataTransfer.files);
      e.dataTransfer.clearData();
      this.dragCounter = 0;
      this.setState({ isDraggingFile: false });
    }
  }
}
