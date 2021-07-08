import React from 'react';

import classNames from 'classnames';

import { SessionCompositionBox, StagedAttachmentType } from './SessionCompositionBox';

import { Constants } from '../../../session';
import _ from 'lodash';
import { AttachmentUtil, GoogleChrome } from '../../../util';
import {
  ConversationHeaderNonReduxProps,
  ConversationHeaderWithDetails,
} from '../../conversation/ConversationHeader';
import { SessionRightPanelWithDetails } from './SessionRightPanel';
import { SessionTheme } from '../../../state/ducks/SessionTheme';
import { DefaultTheme } from 'styled-components';
import { SessionMessagesList } from './SessionMessagesList';
import { LightboxGallery, MediaItemType } from '../../LightboxGallery';
import { Message } from '../../conversation/media-gallery/types/Message';

import { AttachmentType, AttachmentTypeWithPath, save } from '../../../types/Attachment';
import { ToastUtils, UserUtils } from '../../../session/utils';
import * as MIME from '../../../types/MIME';
import { SessionFileDropzone } from './SessionFileDropzone';
import {
  ConversationType,
  PropsForMessage,
  SortedMessageModelProps,
} from '../../../state/ducks/conversations';
import { MessageView } from '../../MainViewController';
import { pushUnblockToSend } from '../../../session/utils/Toast';
import { MessageDetail } from '../../conversation/MessageDetail';
import { getConversationController } from '../../../session/conversations';
import { getMessageById, getPubkeysInPublicConversation } from '../../../data/data';
import autoBind from 'auto-bind';
import { getDecryptedMediaUrl } from '../../../session/crypto/DecryptedAttachmentsManager';
import { deleteOpenGroupMessages } from '../../../interactions/conversationInteractions';
import { ConversationTypeEnum } from '../../../models/conversation';
import { updateMentionsMembers } from '../../../state/ducks/mentionsInput';
import { sendDataExtractionNotification } from '../../../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';

import { SessionButtonColor } from '../SessionButton';
interface State {
  unreadCount: number;
  selectedMessages: Array<string>;

  showOverlay: boolean;
  showRecordingView: boolean;
  showOptionsPane: boolean;

  // if set, the `More Info` of a message screen is shown on top of the conversation.
  messageDetailShowProps?: any; // FIXME set the type for this

  stagedAttachments: Array<StagedAttachmentType>;
  isDraggingFile: boolean;

  // quoted message
  quotedMessageTimestamp?: number;
  quotedMessageProps?: any;

  // lightbox options
  lightBoxOptions?: LightBoxOptions;
}

export interface LightBoxOptions {
  media: Array<MediaItemType>;
  attachment: AttachmentTypeWithPath;
}

interface Props {
  ourNumber: string;
  selectedConversationKey: string;
  selectedConversation?: ConversationType;
  theme: DefaultTheme;
  messagesProps: Array<SortedMessageModelProps>;
  actions: any;
}

export class SessionConversation extends React.Component<Props, State> {
  private readonly compositionBoxRef: React.RefObject<HTMLDivElement>;
  private readonly messageContainerRef: React.RefObject<HTMLDivElement>;
  private dragCounter: number;
  private publicMembersRefreshTimeout?: NodeJS.Timeout;
  private readonly updateMemberList: () => any;

  constructor(props: any) {
    super(props);

    const unreadCount = this.props.selectedConversation?.unreadCount || 0;
    this.state = {
      unreadCount,
      selectedMessages: [],
      showOverlay: false,
      showRecordingView: false,
      showOptionsPane: false,
      stagedAttachments: [],
      isDraggingFile: false,
    };
    this.compositionBoxRef = React.createRef();
    this.messageContainerRef = React.createRef();
    this.dragCounter = 0;
    this.updateMemberList = _.debounce(this.updateMemberListBouncy.bind(this), 1000);

    autoBind(this);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      selectedConversationKey: newConversationKey,
      selectedConversation: newConversation,
    } = this.props;
    const { selectedConversationKey: oldConversationKey } = prevProps;

    // if the convo is valid, and it changed, register for drag events
    if (newConversationKey && newConversation && newConversationKey !== oldConversationKey) {
      // Pause thread to wait for rendering to complete
      setTimeout(() => {
        const div = this.messageContainerRef.current;
        div?.addEventListener('dragenter', this.handleDragIn);
        div?.addEventListener('dragleave', this.handleDragOut);
        div?.addEventListener('dragover', this.handleDrag);
        div?.addEventListener('drop', this.handleDrop);
      }, 100);

      // if the conversation changed, we have to stop our refresh of member list
      if (this.publicMembersRefreshTimeout) {
        global.clearInterval(this.publicMembersRefreshTimeout);
        this.publicMembersRefreshTimeout = undefined;
      }
      // shown convo changed. reset the list of members quotable
      window?.inboxStore?.dispatch(updateMentionsMembers([]));
      // if the newConversation changed, and is public, start our refresh members list
      if (newConversation.isPublic) {
        // this is a debounced call.
        void this.updateMemberList();
        // run this only once every minute if we don't change the visible conversation.
        // this is a heavy operation (like a few thousands members can be here)
        this.publicMembersRefreshTimeout = global.setInterval(this.updateMemberList, 60000);
      }
    }
    // if we do not have a model, unregister for events
    if (!newConversation) {
      const div = this.messageContainerRef.current;
      div?.removeEventListener('dragenter', this.handleDragIn);
      div?.removeEventListener('dragleave', this.handleDragOut);
      div?.removeEventListener('dragover', this.handleDrag);
      div?.removeEventListener('drop', this.handleDrop);
      if (this.publicMembersRefreshTimeout) {
        global.clearInterval(this.publicMembersRefreshTimeout);
        this.publicMembersRefreshTimeout = undefined;
      }
    }
    if (newConversationKey !== oldConversationKey) {
      void this.loadInitialMessages();
      this.setState({
        showOptionsPane: false,
        selectedMessages: [],
        showOverlay: false,
        showRecordingView: false,
        stagedAttachments: [],
        isDraggingFile: false,
        messageDetailShowProps: undefined,
        quotedMessageProps: undefined,
        quotedMessageTimestamp: undefined,
      });
    }
  }

  public componentWillUnmount() {
    const div = this.messageContainerRef.current;
    div?.removeEventListener('dragenter', this.handleDragIn);
    div?.removeEventListener('dragleave', this.handleDragOut);
    div?.removeEventListener('dragover', this.handleDrag);
    div?.removeEventListener('drop', this.handleDrop);

    if (this.publicMembersRefreshTimeout) {
      global.clearInterval(this.publicMembersRefreshTimeout);
      this.publicMembersRefreshTimeout = undefined;
    }
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
      messageDetailShowProps,
    } = this.state;
    const selectionMode = !!selectedMessages.length;

    const { selectedConversation, selectedConversationKey, messagesProps, actions } = this.props;

    if (!selectedConversation || !messagesProps) {
      // return an empty message view
      return <MessageView />;
    }
    const conversationModel = getConversationController().get(selectedConversationKey);
    // TODO VINCE: OPTIMISE FOR NEW SENDING???
    const sendMessageFn = (
      body: any,
      attachments: any,
      quote: any,
      preview: any,
      groupInvitation: any
    ) => {
      if (!conversationModel) {
        return;
      }
      void conversationModel.sendMessage(body, attachments, quote, preview, groupInvitation);
      if (this.messageContainerRef.current) {
        // force scrolling to bottom on message sent
        // this will mark all messages as read, and reset the conversation unreadCount
        (this.messageContainerRef
          .current as any).scrollTop = this.messageContainerRef.current?.scrollHeight;
      }
    };
    const showMessageDetails = !!messageDetailShowProps;

    const isPublic = selectedConversation.isPublic || false;

    const isPrivate = selectedConversation.type === ConversationTypeEnum.PRIVATE;
    return (
      <SessionTheme theme={this.props.theme}>
        <div className="conversation-header">{this.renderHeader()}</div>
        <div
          // if you change the classname, also update it on onKeyDown
          className={classNames('conversation-content', selectionMode && 'selection-mode')}
          tabIndex={0}
          onKeyDown={this.onKeyDown}
          role="navigation"
        >
          <div className={classNames('conversation-info-panel', showMessageDetails && 'show')}>
            {showMessageDetails && <MessageDetail {...messageDetailShowProps} />}
          </div>

          {lightBoxOptions?.media && this.renderLightBox(lightBoxOptions)}

          <div className="conversation-messages">
            <SessionMessagesList {...this.getMessagesListProps()} />

            {showRecordingView && <div className="conversation-messages__blocking-overlay" />}
            {isDraggingFile && <SessionFileDropzone />}
          </div>

          <SessionCompositionBox
            isBlocked={selectedConversation.isBlocked}
            left={selectedConversation.left}
            isKickedFromGroup={selectedConversation.isKickedFromGroup}
            isPrivate={isPrivate}
            isPublic={isPublic}
            selectedConversationKey={selectedConversationKey}
            selectedConversation={selectedConversation}
            sendMessage={sendMessageFn}
            stagedAttachments={stagedAttachments}
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
            theme={this.props.theme}
          />
        </div>
        <div className={classNames('conversation-item__options-pane', showOptionsPane && 'show')}>
          <SessionRightPanelWithDetails
            {...this.getRightPanelProps()}
            isShowing={showOptionsPane}
          />
        </div>
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
    const { selectedConversation, selectedConversationKey } = this.props;

    if (!selectedConversation) {
      return;
    }
    const conversationModel = getConversationController().get(selectedConversationKey);
    const unreadCount = await conversationModel.getUnreadCount();
    const messagesToFetch = Math.max(
      Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT,
      unreadCount
    );
    this.props.actions.fetchMessagesForConversation({
      conversationKey: selectedConversationKey,
      count: messagesToFetch,
    });
  }

  public getHeaderProps(): ConversationHeaderNonReduxProps {
    console.warn('generating new header props');

    const headerProps = {
      showBackButton: Boolean(this.state.messageDetailShowProps),
      selectionMode: !!this.state.selectedMessages.length,
      onDeleteSelectedMessages: this.deleteSelectedMessages,
      onCloseOverlay: this.resetSelection,
      onAvatarClick: this.toggleRightPanel,

      onGoBack: () => {
        this.setState({
          messageDetailShowProps: undefined,
        });
      },
    };

    return headerProps;
  }

  public getMessagesListProps() {
    const { selectedConversation, selectedConversationKey, ourNumber, messagesProps } = this.props;
    const { quotedMessageTimestamp, selectedMessages } = this.state;

    return {
      selectedMessages,
      ourPrimary: ourNumber,
      conversationKey: selectedConversationKey,
      messagesProps,
      resetSelection: this.resetSelection,
      quotedMessageTimestamp,
      conversation: selectedConversation as ConversationType,
      selectMessage: this.selectMessage,
      deleteMessage: this.deleteMessage,
      replyToMessage: this.replyToMessage,
      showMessageDetails: this.showMessageDetails,
      onClickAttachment: this.onClickAttachment,
      onDownloadAttachment: this.saveAttachment,
      messageContainerRef: this.messageContainerRef,
      onDeleteSelectedMessages: this.deleteSelectedMessages,
    };
  }

  // tslint:disable-next-line: max-func-body-length
  public getRightPanelProps() {
    const { selectedConversationKey } = this.props;
    const conversation = getConversationController().getOrThrow(selectedConversationKey);
    const ourPrimary = window.storage.get('primaryDevicePubKey');

    const members = conversation.get('members') || [];
    const isAdmin = conversation.isMediumGroup()
      ? true
      : conversation.isPublic()
      ? conversation.isAdmin(ourPrimary)
      : false;

    return {
      id: conversation.id,
      name: conversation.getName(),
      memberCount: members.length,
      phoneNumber: conversation.getNumber(),
      profileName: conversation.getProfileName(),
      avatarPath: conversation.getAvatarPath(),
      isKickedFromGroup: Boolean(conversation.get('isKickedFromGroup')),
      left: conversation.get('left'),
      isGroup: !conversation.isPrivate(),
      isPublic: conversation.isPublic(),
      isAdmin,
      isBlocked: conversation.isBlocked(),
      onGoBack: () => {
        this.toggleRightPanel();
      },
      onShowLightBox: (lightBoxOptions?: LightBoxOptions) => {
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
  public async deleteMessagesById(messageIds: Array<string>, askUserForConfirmation: boolean) {
    // Get message objects
    const { selectedConversationKey, selectedConversation, messagesProps } = this.props;

    const conversationModel = getConversationController().getOrThrow(selectedConversationKey);
    if (!selectedConversation) {
      window?.log?.info('No valid selected conversation.');
      return;
    }
    const selectedMessages = messagesProps.filter(message =>
      messageIds.find(selectedMessage => selectedMessage === message.propsForMessage.id)
    );

    const multiple = selectedMessages.length > 1;

    // In future, we may be able to unsend private messages also
    // isServerDeletable also defined in ConversationHeader.tsx for
    // future reference
    const isServerDeletable = selectedConversation.isPublic;

    const warningMessage = (() => {
      if (selectedConversation.isPublic) {
        return multiple
          ? window.i18n('deleteMultiplePublicWarning')
          : window.i18n('deletePublicWarning');
      }
      return multiple ? window.i18n('deleteMultipleWarning') : window.i18n('deleteWarning');
    })();

    const doDelete = async () => {
      let toDeleteLocallyIds: Array<string>;

      if (selectedConversation.isPublic) {
        // Get our Moderator status
        const ourDevicePubkey = UserUtils.getOurPubKeyStrFromCache();
        if (!ourDevicePubkey) {
          return;
        }

        const isAdmin = conversationModel.isAdmin(ourDevicePubkey);
        const isAllOurs = selectedMessages.every(
          message => ourDevicePubkey === message.propsForMessage.authorPhoneNumber
        );

        if (!isAllOurs && !isAdmin) {
          ToastUtils.pushMessageDeleteForbidden();

          this.setState({ selectedMessages: [] });
          return;
        }

        toDeleteLocallyIds = await deleteOpenGroupMessages(selectedMessages, conversationModel);
        if (toDeleteLocallyIds.length === 0) {
          // Message failed to delete from server, show error?
          return;
        }
      } else {
        toDeleteLocallyIds = selectedMessages.map(pro => pro.propsForMessage.id);
      }

      await Promise.all(
        toDeleteLocallyIds.map(async msgId => {
          await conversationModel.removeMessage(msgId);
        })
      );

      // Update view and trigger update
      this.setState({ selectedMessages: [] }, ToastUtils.pushDeleted);
    };

    let title = '';

    // Note:  keep that i18n logic separated so the scripts in tools/ find the usage of those
    if (isServerDeletable) {
      if (multiple) {
        title = window.i18n('deleteMessagesForEveryone');
      } else {
        title = window.i18n('deleteMessageForEveryone');
      }
    } else {
      if (multiple) {
        title = window.i18n('deleteMessages');
      } else {
        title = window.i18n('deleteMessage');
      }
    }

    const okText = window.i18n(isServerDeletable ? 'deleteForEveryone' : 'delete');

    if (askUserForConfirmation) {
      const onClickClose = () => {
        this.props.actions.updateConfirmModal(null);
      };

      this.props.actions.updateConfirmModal({
        title,
        message: warningMessage,
        okText,
        okTheme: SessionButtonColor.Danger,
        onClickOk: doDelete,
        onClickClose,
        closeAfterClick: true,
      });
    } else {
      void doDelete();
    }
  }

  public async deleteSelectedMessages() {
    await this.deleteMessagesById(this.state.selectedMessages, true);
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

  public deleteMessage(messageId: string) {
    this.setState({ selectedMessages: [messageId] }, this.deleteSelectedMessages);
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
    if (this.props.selectedConversation?.isBlocked) {
      pushUnblockToSend();
      return;
    }
    if (!_.isEqual(this.state.quotedMessageTimestamp, quotedMessageTimestamp)) {
      const { messagesProps, selectedConversationKey } = this.props;
      const conversationModel = getConversationController().getOrThrow(selectedConversationKey);

      let quotedMessageProps = null;
      if (quotedMessageTimestamp) {
        const quotedMessage = messagesProps.find(
          m =>
            m.propsForMessage.timestamp === quotedMessageTimestamp ||
            m.propsForMessage.serverTimestamp === quotedMessageTimestamp
        );

        if (quotedMessage) {
          const quotedMessageModel = await getMessageById(quotedMessage.propsForMessage.id);
          if (quotedMessageModel) {
            quotedMessageProps = await conversationModel.makeQuote(quotedMessageModel);
          }
        }
      }
      this.setState({ quotedMessageTimestamp, quotedMessageProps }, () => {
        this.compositionBoxRef.current?.focus();
      });
    }
  }

  private showMessageDetails(messageProps: any) {
    messageProps.onDeleteMessage = async (id: string) => {
      await this.deleteMessagesById([id], false);
      this.setState({ messageDetailShowProps: undefined });
    };

    this.setState({
      messageDetailShowProps: messageProps,
      showOptionsPane: false,
    });
  }

  private onClickAttachment(attachment: AttachmentTypeWithPath, propsForMessage: PropsForMessage) {
    let index = -1;
    const media = (propsForMessage.attachments || []).map(attachmentForMedia => {
      index++;
      const messageTimestamp =
        propsForMessage.timestamp || propsForMessage.serverTimestamp || propsForMessage.receivedAt;

      return {
        index: _.clone(index),
        objectURL: attachmentForMedia.url || undefined,
        contentType: attachmentForMedia.contentType,
        attachment: attachmentForMedia,
        messageSender: propsForMessage.authorPhoneNumber,
        messageTimestamp,
        messageId: propsForMessage.id,
      };
    });
    const lightBoxOptions: LightBoxOptions = {
      media: media as any,
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
    if (event.target.classList.contains('conversation-content')) {
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
      if (newAttachments.some(a => a.isVoiceMessage) && stagedAttachments.length > 0) {
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

  private renderLightBox({ media, attachment }: LightBoxOptions) {
    const selectedIndex =
      media.length > 1
        ? media.findIndex(mediaMessage => mediaMessage.attachment.path === attachment.path)
        : 0;
    console.warn('renderLightBox', { media, attachment });
    return (
      <LightboxGallery
        media={media}
        close={() => {
          this.setState({ lightBoxOptions: undefined });
        }}
        selectedIndex={selectedIndex}
        onSave={this.saveAttachment}
      />
    );
  }

  // THIS DOES NOT DOWNLOAD ANYTHING! it just saves it where the user wants
  private async saveAttachment({
    attachment,
    messageTimestamp,
    messageSender,
  }: {
    attachment: AttachmentType;
    messageTimestamp: number;
    messageSender: string;
  }) {
    const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
    attachment.url = await getDecryptedMediaUrl(attachment.url, attachment.contentType);
    save({
      attachment,
      document,
      getAbsolutePath: getAbsoluteAttachmentPath,
      timestamp: messageTimestamp,
    });

    await sendDataExtractionNotification(
      this.props.selectedConversationKey,
      messageSender,
      messageTimestamp
    );
  }

  private async onChoseAttachments(attachmentsFileList: Array<File>) {
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
            fileSize: null,
            screenshot: null,
            thumbnail: null,
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
            fileSize: null,
            screenshot: null,
            thumbnail: null,
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
          fileSize: null,
          screenshot: null,
          thumbnail: null,
        },
      ]);
    };

    let blob = null;

    try {
      blob = await AttachmentUtil.autoScale({
        contentType,
        file,
      });

      if (blob.file.size >= Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES) {
        ToastUtils.pushFileSizeErrorAsByte(Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES);
        return;
      }
    } catch (error) {
      window?.log?.error(
        'Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );

      ToastUtils.pushLoadAttachmentFailure(error?.message);
      return;
    }

    try {
      if (GoogleChrome.isImageTypeSupported(contentType)) {
        // this does not add the preview to the message outgoing
        // this is just for us, for the list of attachments we are sending
        // the files are scaled down under getFiles()

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
            fileSize: null,
            screenshot: null,
            thumbnail: null,
          },
        ]);
      }
    } catch (e) {
      window?.log?.error(
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
          fileSize: null,
          screenshot: null,
          thumbnail: null,
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
      void this.onChoseAttachments(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
      this.dragCounter = 0;
      this.setState({ isDraggingFile: false });
    }
  }

  private async updateMemberListBouncy() {
    const allPubKeys = await getPubkeysInPublicConversation(this.props.selectedConversationKey);

    window?.log?.info(`getPubkeysInPublicConversation returned '${allPubKeys?.length}' members`);

    const allMembers = allPubKeys.map((pubKey: string) => {
      const conv = getConversationController().get(pubKey);
      const profileName = conv?.getProfileName() || 'Anonymous';

      return {
        id: pubKey,
        authorPhoneNumber: pubKey,
        authorProfileName: profileName,
      };
    });

    window.inboxStore?.dispatch(updateMentionsMembers(allMembers));
  }
}
