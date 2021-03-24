// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import { AttachmentType } from '../types/Attachment';
import { GroupV2PendingMemberType } from '../model-types.d';
import { MediaItemType } from '../components/LightboxGallery';
import { MessageType } from '../state/ducks/conversations';
import { ConversationModel } from '../models/conversations';
import { MessageModel } from '../models/messages';
import { assert } from '../util/assert';

type GetLinkPreviewImageResult = {
  data: ArrayBuffer;
  size: number;
  contentType: string;
  width?: number;
  height?: number;
  blurHash: string;
};

type GetLinkPreviewResult = {
  title: string;
  url: string;
  image?: GetLinkPreviewImageResult;
  description: string | null;
  date: number | null;
};

type AttachmentOptions = {
  messageId: string;
  attachment: AttachmentType;
};

const FIVE_MINUTES = 1000 * 60 * 5;
const LINK_PREVIEW_TIMEOUT = 60 * 1000;

window.Whisper = window.Whisper || {};

const { Whisper } = window;
const { Message, MIME, VisualAttachment, Attachment } = window.Signal.Types;

const {
  copyIntoTempDirectory,
  deleteDraftFile,
  deleteTempFile,
  getAbsoluteAttachmentPath,
  getAbsoluteDraftPath,
  getAbsoluteTempPath,
  openFileInFolder,
  readAttachmentData,
  readDraftData,
  saveAttachmentToDisk,
  upgradeMessageSchema,
  writeNewDraftData,
} = window.Signal.Migrations;

const {
  getOlderMessagesByConversation,
  getMessageMetricsForConversation,
  getMessageById,
  getMessagesBySentAt,
  getNewerMessagesByConversation,
} = window.Signal.Data;

Whisper.ExpiredToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('expiredWarning') };
  },
});

Whisper.BlockedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('unblockToSend') };
  },
});

Whisper.BlockedGroupToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('unblockGroupToSend') };
  },
});

Whisper.LeftGroupToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('youLeftTheGroup') };
  },
});

Whisper.InvalidConversationToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('invalidConversation') };
  },
});

Whisper.OriginalNotFoundToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('originalMessageNotFound') };
  },
});

Whisper.OriginalNoLongerAvailableToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('originalMessageNotAvailable') };
  },
});

Whisper.FoundButNotLoadedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('messageFoundButNotLoaded') };
  },
});

Whisper.VoiceNoteLimit = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('voiceNoteLimit') };
  },
});

Whisper.VoiceNoteMustBeOnlyAttachmentToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('voiceNoteMustBeOnlyAttachment') };
  },
});

Whisper.ConversationArchivedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('conversationArchived') };
  },
});

Whisper.ConversationUnarchivedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('conversationReturnedToInbox') };
  },
});

Whisper.ConversationMarkedUnreadToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('conversationMarkedUnread') };
  },
});

Whisper.TapToViewExpiredIncomingToast = Whisper.ToastView.extend({
  render_attributes() {
    return {
      toastMessage: window.i18n(
        'Message--tap-to-view--incoming--expired-toast'
      ),
    };
  },
});

Whisper.TapToViewExpiredOutgoingToast = Whisper.ToastView.extend({
  render_attributes() {
    return {
      toastMessage: window.i18n(
        'Message--tap-to-view--outgoing--expired-toast'
      ),
    };
  },
});

Whisper.FileSavedToast = Whisper.ToastView.extend({
  className: 'toast toast-clickable',
  initialize(options: any) {
    if (!options.fullPath) {
      throw new Error('FileSavedToast: name option was not provided!');
    }
    this.fullPath = options.fullPath;
    this.timeout = 10000;

    if (window.getInteractionMode() === 'keyboard') {
      setTimeout(() => {
        this.$el.focus();
      }, 1);
    }
  },
  events: {
    click: 'onClick',
    keydown: 'onKeydown',
  },
  onClick() {
    openFileInFolder(this.fullPath);
    this.close();
  },
  onKeydown(event: any) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    openFileInFolder(this.fullPath);
    this.close();
  },
  render_attributes() {
    return { toastMessage: window.i18n('attachmentSaved') };
  },
});

Whisper.ReactionFailedToast = Whisper.ToastView.extend({
  className: 'toast toast-clickable',
  initialize() {
    this.timeout = 4000;

    if (window.getInteractionMode() === 'keyboard') {
      setTimeout(() => {
        this.$el.focus();
      }, 1);
    }
  },
  events: {
    click: 'onClick',
    keydown: 'onKeydown',
  },
  onClick() {
    this.close();
  },
  onKeydown(event: any) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.close();
  },
  render_attributes() {
    return { toastMessage: window.i18n('Reactions--error') };
  },
});

Whisper.GroupLinkCopiedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('GroupLinkManagement--clipboard') };
  },
});

Whisper.PinnedConversationsFullToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('pinnedConversationsFull') };
  },
});

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

Whisper.MessageBodyTooLongToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('messageBodyTooLong') };
  },
});

Whisper.FileSizeToast = Whisper.ToastView.extend({
  template: () => $('#file-size-modal').html(),
  render_attributes() {
    return {
      'file-size-warning': window.i18n('fileSizeWarning'),
      limit: this.model.limit,
      units: this.model.units,
    };
  },
});

Whisper.UnableToLoadToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('unableToLoadAttachment') };
  },
});

Whisper.DangerousFileTypeToast = Whisper.ToastView.extend({
  template: () => window.i18n('dangerousFileType'),
});

Whisper.OneNonImageAtATimeToast = Whisper.ToastView.extend({
  template: () => window.i18n('oneNonImageAtATimeToast'),
});

Whisper.CannotMixImageAndNonImageAttachmentsToast = Whisper.ToastView.extend({
  template: () => window.i18n('cannotMixImageAndNonImageAttachments'),
});

Whisper.MaxAttachmentsToast = Whisper.ToastView.extend({
  template: () => window.i18n('maximumAttachments'),
});

Whisper.AlreadyGroupMemberToast = Whisper.ToastView.extend({
  template: () => window.i18n('GroupV2--join--already-in-group'),
});

Whisper.AlreadyRequestedToJoinToast = Whisper.ToastView.extend({
  template: () => window.i18n('GroupV2--join--already-awaiting-approval'),
});

Whisper.ConversationLoadingScreen = Whisper.View.extend({
  template: () => $('#conversation-loading-screen').html(),
  className: 'conversation-loading-screen',
});

Whisper.ConversationView = Whisper.View.extend({
  className() {
    return ['conversation', this.model.get('type')].join(' ');
  },
  id() {
    return `conversation-${this.model.cid}`;
  },
  template: () => $('#conversation').html(),
  render_attributes() {
    return {
      'send-message': window.i18n('sendMessage'),
    };
  },
  initialize(options: any) {
    // Events on Conversation model
    this.listenTo(this.model, 'destroy', this.stopListening);
    this.listenTo(this.model, 'change:verified', this.onVerifiedChange);
    this.listenTo(this.model, 'newmessage', this.addMessage);
    this.listenTo(this.model, 'opened', this.onOpened);
    this.listenTo(this.model, 'backgrounded', this.resetEmojiResults);
    this.listenTo(this.model, 'scroll-to-message', this.scrollToMessage);
    this.listenTo(this.model, 'unload', (reason: any) =>
      this.unload(`model trigger - ${reason}`)
    );
    this.listenTo(this.model, 'focus-composer', this.focusMessageField);
    this.listenTo(this.model, 'open-all-media', this.showAllMedia);
    this.listenTo(this.model, 'begin-recording', this.captureAudio);
    this.listenTo(this.model, 'attach-file', this.onChooseAttachment);
    this.listenTo(this.model, 'escape-pressed', this.resetPanel);
    this.listenTo(this.model, 'show-message-details', this.showMessageDetail);
    this.listenTo(this.model, 'show-contact-modal', this.showContactModal);
    this.listenTo(this.model, 'toggle-reply', (messageId: any) => {
      const target = this.quote || !messageId ? null : messageId;
      this.setQuoteMessage(target);
    });
    this.listenTo(
      this.model,
      'save-attachment',
      this.downloadAttachmentWrapper
    );
    this.listenTo(this.model, 'delete-message', this.deleteMessage);
    this.listenTo(this.model, 'remove-link-review', this.removeLinkPreview);
    this.listenTo(
      this.model,
      'remove-all-draft-attachments',
      this.clearAttachments
    );

    // Events on Message models - we still listen to these here because they
    //   can be emitted by the non-reduxified MessageDetail pane
    this.listenTo(
      this.model.messageCollection,
      'show-identity',
      this.showSafetyNumber
    );
    this.listenTo(this.model.messageCollection, 'force-send', this.forceSend);

    this.lazyUpdateVerified = window._.debounce(
      this.model.updateVerified.bind(this.model),
      1000 // one second
    );
    this.model.throttledGetProfiles =
      this.model.throttledGetProfiles ||
      window._.throttle(this.model.getProfiles.bind(this.model), FIVE_MINUTES);
    this.model.throttledUpdateSharedGroups =
      this.model.throttledUpdateSharedGroups ||
      window._.throttle(
        this.model.updateSharedGroups.bind(this.model),
        FIVE_MINUTES
      );
    this.model.throttledFetchLatestGroupV2Data =
      this.model.throttledFetchLatestGroupV2Data ||
      window._.throttle(
        this.model.fetchLatestGroupV2Data.bind(this.model),
        FIVE_MINUTES
      );
    this.model.throttledMaybeMigrateV1Group =
      this.model.throttledMaybeMigrateV1Group ||
      window._.throttle(
        this.model.maybeMigrateV1Group.bind(this.model),
        FIVE_MINUTES
      );

    this.debouncedMaybeGrabLinkPreview = window._.debounce(
      this.maybeGrabLinkPreview.bind(this),
      200
    );
    this.debouncedSaveDraft = window._.debounce(this.saveDraft.bind(this), 200);

    this.render();

    this.loadingScreen = new Whisper.ConversationLoadingScreen();
    this.loadingScreen.render();
    this.loadingScreen.$el.prependTo(this.$('.discussion-container'));

    this.window = options.window;
    const attachmentListEl = $(
      '<div class="module-composition-area__attachment-list"></div>'
    );

    this.attachmentListView = new Whisper.ReactWrapperView({
      el: attachmentListEl,
      Component: window.Signal.Components.AttachmentList,
      props: this.getPropsForAttachmentList(),
    });

    this.setupHeader();
    this.setupTimeline();
    this.setupCompositionArea({ attachmentListEl: attachmentListEl[0] });

    this.linkPreviewAbortController = null;
  },

  events: {
    'click .capture-audio .microphone': 'captureAudio',
    'change input.file-input': 'onChoseAttachment',

    dragover: 'onDragOver',
    dragleave: 'onDragLeave',
    drop: 'onDrop',
    paste: 'onPaste',
  },

  getMuteExpirationLabel() {
    const muteExpiresAt = this.model.get('muteExpiresAt');
    if (!this.model.isMuted()) {
      return;
    }

    const today = window.moment(Date.now());
    const expires = window.moment(muteExpiresAt);

    if (today.isSame(expires, 'day')) {
      // eslint-disable-next-line consistent-return
      return expires.format('hh:mm A');
    }

    // eslint-disable-next-line consistent-return
    return expires.format('M/D/YY, hh:mm A');
  },

  setPin(value: boolean) {
    if (value) {
      const pinnedConversationIds = window.storage.get<Array<string>>(
        'pinnedConversationIds',
        []
      );

      if (pinnedConversationIds.length >= 4) {
        this.showToast(Whisper.PinnedConversationsFullToast);
        return;
      }
      this.model.pin();
    } else {
      this.model.unpin();
    }
  },

  setupHeader() {
    this.titleView = new Whisper.ReactWrapperView({
      className: 'title-wrapper',
      JSX: window.Signal.State.Roots.createConversationHeader(
        window.reduxStore,
        {
          id: this.model.id,

          onShowContactModal: this.showContactModal.bind(this),
          onSetDisappearingMessages: (seconds: number) =>
            this.setDisappearingMessages(seconds),
          onDeleteMessages: () => this.destroyMessages(),
          onResetSession: () => this.endSession(),
          onSearchInConversation: () => {
            const { searchInConversation } = window.reduxActions.search;
            const name = this.model.isMe()
              ? window.i18n('noteToSelf')
              : this.model.getTitle();
            searchInConversation(this.model.id, name);
          },
          onSetMuteNotifications: (ms: number) => this.setMuteNotifications(ms),
          onSetPin: this.setPin.bind(this),
          // These are view only and don't update the Conversation model, so they
          //   need a manual update call.
          onOutgoingAudioCallInConversation: async () => {
            window.log.info(
              'onOutgoingAudioCallInConversation: about to start an audio call'
            );

            const isVideoCall = false;

            if (await this.isCallSafe()) {
              window.log.info(
                'onOutgoingAudioCallInConversation: call is deemed "safe". Making call'
              );
              await window.Signal.Services.calling.startCallingLobby(
                this.model.id,
                isVideoCall
              );
              window.log.info(
                'onOutgoingAudioCallInConversation: started the call'
              );
            } else {
              window.log.info(
                'onOutgoingAudioCallInConversation: call is deemed "unsafe". Stopping'
              );
            }
          },

          onOutgoingVideoCallInConversation: async () => {
            window.log.info(
              'onOutgoingVideoCallInConversation: about to start a video call'
            );
            const isVideoCall = true;

            if (await this.isCallSafe()) {
              window.log.info(
                'onOutgoingVideoCallInConversation: call is deemed "safe". Making call'
              );
              await window.Signal.Services.calling.startCallingLobby(
                this.model.id,
                isVideoCall
              );
              window.log.info(
                'onOutgoingVideoCallInConversation: started the call'
              );
            } else {
              window.log.info(
                'onOutgoingVideoCallInConversation: call is deemed "unsafe". Stopping'
              );
            }
          },

          onShowConversationDetails: () => {
            this.showConversationDetails();
          },
          onShowSafetyNumber: () => {
            this.showSafetyNumber();
          },
          onShowAllMedia: () => {
            this.showAllMedia();
          },
          onShowGroupMembers: async () => {
            await this.showMembers();
          },
          onGoBack: () => {
            this.resetPanel();
          },

          onArchive: () => {
            this.model.setArchived(true);
            this.model.trigger('unload', 'archive');

            Whisper.ToastView.show(
              Whisper.ConversationArchivedToast,
              document.body
            );
          },
          onMarkUnread: () => {
            this.model.setMarkedUnread(true);

            Whisper.ToastView.show(
              Whisper.ConversationMarkedUnreadToast,
              document.body
            );
          },
          onMoveToInbox: () => {
            this.model.setArchived(false);

            Whisper.ToastView.show(
              Whisper.ConversationUnarchivedToast,
              document.body
            );
          },
        }
      ),
    });
    this.$('.conversation-header').append(this.titleView.el);
    window.reduxActions.conversations.setSelectedConversationHeaderTitle();
  },

  setupCompositionArea({ attachmentListEl }: any) {
    const compositionApi = { current: null };
    this.compositionApi = compositionApi;

    const micCellEl = $(`
        <div class="capture-audio">
          <button class="microphone"></button>
        </div>
      `)[0];

    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

    const props = {
      id: this.model.id,
      compositionApi,
      onClickAddPack: () => this.showStickerManager(),
      onPickSticker: (packId: string, stickerId: number) =>
        this.sendStickerMessage({ packId, stickerId }),
      onSubmit: (
        message: any,
        mentions: typeof window.Whisper.BodyRangesType
      ) => this.sendMessage(message, mentions),
      onEditorStateChange: (
        msg: string,
        bodyRanges: Array<typeof window.Whisper.BodyRangeType>,
        caretLocation: number
      ) => this.onEditorStateChange(msg, bodyRanges, caretLocation),
      onTextTooLong: () => this.showToast(Whisper.MessageBodyTooLongToast),
      onChooseAttachment: this.onChooseAttachment.bind(this),
      getQuotedMessage: () => this.model.get('quotedMessageId'),
      clearQuotedMessage: () => this.setQuoteMessage(null),
      micCellEl,
      attachmentListEl,
      onAccept: () => {
        this.longRunningTaskWrapper({
          name: 'onAccept',
          task: this.model.syncMessageRequestResponse.bind(
            this.model,
            messageRequestEnum.ACCEPT
          ),
        });
      },
      onBlock: () => {
        this.longRunningTaskWrapper({
          name: 'onBlock',
          task: this.model.syncMessageRequestResponse.bind(
            this.model,
            messageRequestEnum.BLOCK
          ),
        });
      },
      onUnblock: () => {
        this.longRunningTaskWrapper({
          name: 'onUnblock',
          task: this.model.syncMessageRequestResponse.bind(
            this.model,
            messageRequestEnum.ACCEPT
          ),
        });
      },
      onDelete: () => {
        this.longRunningTaskWrapper({
          name: 'onDelete',
          task: this.model.syncMessageRequestResponse.bind(
            this.model,
            messageRequestEnum.DELETE
          ),
        });
      },
      onBlockAndDelete: () => {
        this.longRunningTaskWrapper({
          name: 'onBlockAndDelete',
          task: this.model.syncMessageRequestResponse.bind(
            this.model,
            messageRequestEnum.BLOCK_AND_DELETE
          ),
        });
      },
      onStartGroupMigration: () => this.startMigrationToGV2(),
      onCancelJoinRequest: async () => {
        await window.showConfirmationDialog({
          message: window.i18n(
            'GroupV2--join--cancel-request-to-join--confirmation'
          ),
          okText: window.i18n('GroupV2--join--cancel-request-to-join--yes'),
          cancelText: window.i18n('GroupV2--join--cancel-request-to-join--no'),
          resolve: () => {
            this.longRunningTaskWrapper({
              name: 'onCancelJoinRequest',
              task: async () => this.model.cancelJoinRequest(),
            });
          },
        });
      },
    };

    this.compositionAreaView = new Whisper.ReactWrapperView({
      className: 'composition-area-wrapper',
      JSX: window.Signal.State.Roots.createCompositionArea(
        window.reduxStore,
        props
      ),
    });

    // Finally, add it to the DOM
    this.$('.composition-area-placeholder').append(this.compositionAreaView.el);
  },

  async longRunningTaskWrapper<T>({
    name,
    task,
  }: {
    name: string;
    task: () => Promise<T>;
  }): Promise<T> {
    const idForLogging = this.model.idForLogging();
    return window.Signal.Util.longRunningTaskWrapper({
      name,
      idForLogging,
      task,
    });
  },

  getMessageActions() {
    const reactToMessage = (messageId: any, reaction: any) => {
      this.sendReactionMessage(messageId, reaction);
    };
    const replyToMessage = (messageId: any) => {
      this.setQuoteMessage(messageId);
    };
    const retrySend = (messageId: any) => {
      this.retrySend(messageId);
    };
    const deleteMessage = (messageId: any) => {
      this.deleteMessage(messageId);
    };
    const deleteMessageForEveryone = (messageId: string) => {
      this.deleteMessageForEveryone(messageId);
    };
    const showMessageDetail = (messageId: any) => {
      this.showMessageDetail(messageId);
    };
    const showContactModal = (contactId: string) => {
      this.showContactModal(contactId);
    };
    const openConversation = (conversationId: any, messageId: any) => {
      this.openConversation(conversationId, messageId);
    };
    const showContactDetail = (options: any) => {
      this.showContactDetail(options);
    };
    const kickOffAttachmentDownload = async (options: any) => {
      if (!this.model.messageCollection) {
        throw new Error('Message collection does not exist');
      }
      const message = this.model.messageCollection.get(options.messageId);
      await message.queueAttachmentDownloads();
    };
    const markAttachmentAsCorrupted = (options: AttachmentOptions) => {
      if (!this.model.messageCollection) {
        throw new Error('Message collection does not exist');
      }
      const message: MessageModel = this.model.messageCollection.get(
        options.messageId
      );
      assert(message, 'Message not found');
      message.markAttachmentAsCorrupted(options.attachment);
    };
    const showVisualAttachment = (options: any) => {
      this.showLightbox(options);
    };
    const downloadAttachment = (options: any) => {
      this.downloadAttachment(options);
    };
    const displayTapToViewMessage = (messageId: any) =>
      this.displayTapToViewMessage(messageId);
    const showIdentity = (conversationId: any) => {
      this.showSafetyNumber(conversationId);
    };
    const openLink = (url: any) => {
      this.navigateTo(url);
    };
    const downloadNewVersion = () => {
      this.downloadNewVersion();
    };
    const showExpiredIncomingTapToViewToast = () => {
      this.showToast(Whisper.TapToViewExpiredIncomingToast);
    };
    const showExpiredOutgoingTapToViewToast = () => {
      this.showToast(Whisper.TapToViewExpiredOutgoingToast);
    };

    return {
      deleteMessage,
      deleteMessageForEveryone,
      displayTapToViewMessage,
      downloadAttachment,
      downloadNewVersion,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      openConversation,
      openLink,
      reactToMessage,
      replyToMessage,
      retrySend,
      showContactDetail,
      showContactModal,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showIdentity,
      showMessageDetail,
      showVisualAttachment,
    };
  },

  setupTimeline() {
    const { id } = this.model;

    const contactSupport = () => {
      const baseUrl =
        'https://support.signal.org/hc/LOCALE/requests/new?desktop&chat_refreshed';
      const locale = window.getLocale();
      const supportLocale = window.Signal.Util.mapToSupportLocale(locale);
      const url = baseUrl.replace('LOCALE', supportLocale);

      this.navigateTo(url);
    };

    const scrollToQuotedMessage = async (options: any) => {
      const { authorId, sentAt } = options;

      const conversationId = this.model.id;
      const messages = await getMessagesBySentAt(sentAt, {
        MessageCollection: Whisper.MessageCollection,
      });
      const message = messages.find(
        item =>
          item.get('conversationId') === conversationId &&
          authorId &&
          item.getContactId() === authorId
      );

      if (!message) {
        this.showToast(Whisper.OriginalNotFoundToast);
        return;
      }

      this.scrollToMessage(message.id);
    };

    const loadOlderMessages = async (oldestMessageId: any) => {
      const {
        messagesAdded,
        setMessagesLoading,
        repairOldestMessage,
      } = window.reduxActions.conversations;
      const conversationId = this.model.id;

      setMessagesLoading(conversationId, true);
      const finish = this.setInProgressFetch();

      try {
        const message = await getMessageById(oldestMessageId, {
          Message: Whisper.Message,
        });
        if (!message) {
          throw new Error(
            `loadOlderMessages: failed to load message ${oldestMessageId}`
          );
        }

        const receivedAt = message.get('received_at');
        const sentAt = message.get('sent_at');
        const models = await getOlderMessagesByConversation(conversationId, {
          receivedAt,
          sentAt,
          messageId: oldestMessageId,
          limit: 30,
          MessageCollection: Whisper.MessageCollection,
        });

        if (models.length < 1) {
          window.log.warn(
            'loadOlderMessages: requested, but loaded no messages'
          );
          repairOldestMessage(conversationId);
          return;
        }

        const cleaned = await this.cleanModels(models);
        this.model.messageCollection.add(cleaned);

        const isNewMessage = false;
        messagesAdded(
          id,
          models.map(model => model.getReduxData()),
          isNewMessage,
          window.isActive()
        );
      } catch (error) {
        setMessagesLoading(conversationId, true);
        throw error;
      } finally {
        finish();
      }
    };
    const loadNewerMessages = async (newestMessageId: any) => {
      const {
        messagesAdded,
        setMessagesLoading,
        repairNewestMessage,
      } = window.reduxActions.conversations;
      const conversationId = this.model.id;

      setMessagesLoading(conversationId, true);
      const finish = this.setInProgressFetch();

      try {
        const message = await getMessageById(newestMessageId, {
          Message: Whisper.Message,
        });
        if (!message) {
          throw new Error(
            `loadNewerMessages: failed to load message ${newestMessageId}`
          );
        }

        const receivedAt = message.get('received_at');
        const sentAt = message.get('sent_at');
        const models = await getNewerMessagesByConversation(this.model.id, {
          receivedAt,
          sentAt,
          limit: 30,
          MessageCollection: Whisper.MessageCollection,
        });

        if (models.length < 1) {
          window.log.warn(
            'loadNewerMessages: requested, but loaded no messages'
          );
          repairNewestMessage(conversationId);
          return;
        }

        const cleaned = await this.cleanModels(models);
        this.model.messageCollection.add(cleaned);

        const isNewMessage = false;
        messagesAdded(
          id,
          models.map(model => model.getReduxData()),
          isNewMessage,
          window.isActive()
        );
      } catch (error) {
        setMessagesLoading(conversationId, false);
        throw error;
      } finally {
        finish();
      }
    };
    const markMessageRead = async (messageId: any) => {
      if (!window.isActive()) {
        return;
      }

      const message = await getMessageById(messageId, {
        Message: Whisper.Message,
      });
      if (!message) {
        throw new Error(`markMessageRead: failed to load message ${messageId}`);
      }

      await this.model.markRead(message.get('received_at'));
    };

    this.timelineView = new Whisper.ReactWrapperView({
      className: 'timeline-wrapper',
      JSX: window.Signal.State.Roots.createTimeline(window.reduxStore, {
        id,

        ...this.getMessageActions(),

        contactSupport,
        loadNewerMessages,
        loadNewestMessages: this.loadNewestMessages.bind(this),
        loadAndScroll: this.loadAndScroll.bind(this),
        loadOlderMessages,
        markMessageRead,
        scrollToQuotedMessage,
        updateSharedGroups: this.model.throttledUpdateSharedGroups,
      }),
    });

    this.$('.timeline-placeholder').append(this.timelineView.el);
  },

  showToast(ToastView: any, options: any) {
    const toast = new ToastView(options);

    const lightboxEl = $('.module-lightbox');
    if (lightboxEl.length > 0) {
      toast.$el.appendTo(lightboxEl);
    } else {
      toast.$el.appendTo(this.$el);
    }

    toast.render();
  },

  async cleanModels(collection: any) {
    const result = collection
      .filter((message: any) => Boolean(message.id))
      .map((message: any) =>
        window.MessageController.register(message.id, message)
      );

    const eliminated = collection.length - result.length;
    if (eliminated > 0) {
      window.log.warn(
        `cleanModels: Eliminated ${eliminated} messages without an id`
      );
    }

    for (let max = result.length, i = 0; i < max; i += 1) {
      const message = result[i];
      const { attributes } = message;
      const { schemaVersion } = attributes;

      if (schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY) {
        // Yep, we really do want to wait for each of these
        // eslint-disable-next-line no-await-in-loop
        const upgradedMessage = await upgradeMessageSchema(attributes);
        message.set(upgradedMessage);
        // eslint-disable-next-line no-await-in-loop
        await window.Signal.Data.saveMessage(upgradedMessage, {
          Message: Whisper.Message,
        });
      }
    }

    return result;
  },

  async scrollToMessage(messageId: any) {
    const message = await getMessageById(messageId, {
      Message: Whisper.Message,
    });
    if (!message) {
      throw new Error(`scrollToMessage: failed to load message ${messageId}`);
    }

    if (this.model.messageCollection.get(messageId)) {
      const { scrollToMessage } = window.reduxActions.conversations;
      scrollToMessage(this.model.id, messageId);
      return;
    }

    this.loadAndScroll(messageId);
  },

  setInProgressFetch() {
    let resolvePromise: any;
    this.model.inProgressFetch = new Promise(resolve => {
      resolvePromise = resolve;
    });

    const finish = () => {
      resolvePromise();
      this.model.inProgressFinish = null;
    };

    return finish;
  },

  async loadAndScroll(messageId: any, options: any) {
    const { disableScroll } = options || {};
    const {
      messagesReset,
      setMessagesLoading,
    } = window.reduxActions.conversations;
    const conversationId = this.model.id;

    setMessagesLoading(conversationId, true);
    const finish = this.setInProgressFetch();

    try {
      const message = await getMessageById(messageId, {
        Message: Whisper.Message,
      });
      if (!message) {
        throw new Error(
          `loadMoreAndScroll: failed to load message ${messageId}`
        );
      }

      const receivedAt = message.get('received_at');
      const sentAt = message.get('sent_at');
      const older = await getOlderMessagesByConversation(conversationId, {
        limit: 30,
        receivedAt,
        sentAt,
        messageId,
        MessageCollection: Whisper.MessageCollection,
      });
      const newer = await getNewerMessagesByConversation(conversationId, {
        limit: 30,
        receivedAt,
        sentAt,
        MessageCollection: Whisper.MessageCollection,
      });
      const metrics = await getMessageMetricsForConversation(conversationId);

      const all = [...older.models, message, ...newer.models];

      const cleaned = await this.cleanModels(all);
      this.model.messageCollection.reset(cleaned);
      const scrollToMessageId = disableScroll ? undefined : messageId;

      messagesReset(
        conversationId,
        cleaned.map((model: any) => model.getReduxData()),
        metrics,
        scrollToMessageId
      );
    } catch (error) {
      setMessagesLoading(conversationId, false);
      throw error;
    } finally {
      finish();
    }
  },

  async loadNewestMessages(newestMessageId: any, setFocus: any) {
    const {
      messagesReset,
      setMessagesLoading,
    } = window.reduxActions.conversations;
    const conversationId = this.model.id;

    setMessagesLoading(conversationId, true);
    const finish = this.setInProgressFetch();

    try {
      let scrollToLatestUnread = true;

      if (newestMessageId) {
        const newestInMemoryMessage = await getMessageById(newestMessageId, {
          Message: Whisper.Message,
        });
        if (!newestInMemoryMessage) {
          window.log.warn(
            `loadNewestMessages: did not find message ${newestMessageId}`
          );
        }

        // If newest in-memory message is unread, scrolling down would mean going to
        //   the very bottom, not the oldest unread.
        if (newestInMemoryMessage.isUnread()) {
          scrollToLatestUnread = false;
        }
      }

      const metrics = await getMessageMetricsForConversation(conversationId);

      if (scrollToLatestUnread && metrics.oldestUnread) {
        this.loadAndScroll(metrics.oldestUnread.id, {
          disableScroll: !setFocus,
        });
        return;
      }

      const messages = await getOlderMessagesByConversation(conversationId, {
        limit: 30,
        MessageCollection: Whisper.MessageCollection,
      });

      const cleaned = await this.cleanModels(messages);
      this.model.messageCollection.reset(cleaned);
      const scrollToMessageId =
        setFocus && metrics.newest ? metrics.newest.id : undefined;

      // Because our `getOlderMessages` fetch above didn't specify a receivedAt, we got
      //   the most recent 30 messages in the conversation. If it has a conflict with
      //   metrics, fetched a bit before, that's likely a race condition. So we tell our
      //   reducer to trust the message set we just fetched for determining if we have
      //   the newest message loaded.
      const unboundedFetch = true;
      messagesReset(
        conversationId,
        cleaned.map((model: any) => model.getReduxData()),
        metrics,
        scrollToMessageId,
        unboundedFetch
      );
    } catch (error) {
      setMessagesLoading(conversationId, false);
      throw error;
    } finally {
      finish();
    }
  },

  async startMigrationToGV2(): Promise<void> {
    const logId = this.model.idForLogging();

    if (!this.model.isGroupV1()) {
      throw new Error(
        `startMigrationToGV2/${logId}: Cannot start, not a GroupV1 group`
      );
    }

    const onClose = () => {
      if (this.migrationDialog) {
        this.migrationDialog.remove();
        this.migrationDialog = undefined;
      }
    };
    onClose();

    const migrate = () => {
      onClose();

      this.longRunningTaskWrapper({
        name: 'initiateMigrationToGroupV2',
        task: () => window.Signal.Groups.initiateMigrationToGroupV2(this.model),
      });
    };

    // Note: this call will throw if, after generating member lists, we are no longer a
    //   member or are in the pending member list.
    const {
      droppedGV2MemberIds,
      pendingMembersV2,
    } = await this.longRunningTaskWrapper({
      name: 'getGroupMigrationMembers',
      task: () => window.Signal.Groups.getGroupMigrationMembers(this.model),
    });

    const invitedMemberIds = pendingMembersV2.map(
      (item: GroupV2PendingMemberType) => item.conversationId
    );

    this.migrationDialog = new Whisper.ReactWrapperView({
      className: 'group-v1-migration-wrapper',
      JSX: window.Signal.State.Roots.createGroupV1MigrationModal(
        window.reduxStore,
        {
          areWeInvited: false,
          droppedMemberIds: droppedGV2MemberIds,
          hasMigrated: false,
          invitedMemberIds,
          migrate,
          onClose,
        }
      ),
    });
  },

  onChooseAttachment() {
    this.$('input.file-input').click();
  },
  async onChoseAttachment() {
    const fileField = this.$('input.file-input');
    const files = fileField.prop('files');

    for (let i = 0, max = files.length; i < max; i += 1) {
      const file = files[i];
      // eslint-disable-next-line no-await-in-loop
      await this.maybeAddAttachment(file);
      this.toggleMicrophone();
    }

    fileField.val(null);
  },

  unload(reason: any) {
    window.log.info(
      'unloading conversation',
      this.model.idForLogging(),
      'due to:',
      reason
    );

    const { conversationUnloaded } = window.reduxActions.conversations;
    if (conversationUnloaded) {
      conversationUnloaded(this.model.id);
    }

    if (this.model.get('draftChanged')) {
      if (this.model.hasDraft()) {
        this.model.set({
          draftChanged: false,
          draftTimestamp: Date.now(),
          timestamp: Date.now(),
        });
      } else {
        this.model.set({
          draftChanged: false,
          draftTimestamp: null,
        });
      }

      // We don't wait here; we need to take down the view
      this.saveModel();

      this.model.updateLastMessage();
    }

    this.titleView.remove();
    this.timelineView.remove();
    this.compositionAreaView.remove();

    if (this.attachmentListView) {
      this.attachmentListView.remove();
    }
    if (this.captionEditorView) {
      this.captionEditorView.remove();
    }
    if (this.contactModalView) {
      this.contactModalView.remove();
    }
    if (this.stickerButtonView) {
      this.stickerButtonView.remove();
    }
    if (this.stickerPreviewModalView) {
      this.stickerPreviewModalView.remove();
    }
    if (this.captureAudioView) {
      this.captureAudioView.remove();
    }
    if (this.banner) {
      this.banner.remove();
    }
    if (this.lastSeenIndicator) {
      this.lastSeenIndicator.remove();
    }
    if (this.scrollDownButton) {
      this.scrollDownButton.remove();
    }
    if (this.quoteView) {
      this.quoteView.remove();
    }
    if (this.lightboxView) {
      this.lightboxView.remove();
    }
    if (this.lightboxGalleryView) {
      this.lightboxGalleryView.remove();
    }
    if (this.panels && this.panels.length) {
      for (let i = 0, max = this.panels.length; i < max; i += 1) {
        const panel = this.panels[i];
        panel.remove();
      }
      window.reduxActions.conversations.setSelectedConversationPanelDepth(0);
    }

    this.remove();

    this.model.messageCollection.reset([]);
  },

  navigateTo(url: any) {
    window.location = url;
  },

  downloadNewVersion() {
    (window as any).location = 'https://signal.org/download';
  },

  onDragOver(e: any) {
    if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    this.$el.addClass('dropoff');
  },

  onDragLeave(e: any) {
    if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
  },

  async onDrop(e: any) {
    if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const { files } = e.originalEvent.dataTransfer;
    for (let i = 0, max = files.length; i < max; i += 1) {
      const file = files[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.maybeAddAttachment(file);
      } catch (error) {
        window.log.error(
          'ConversationView/onDrop: Failed to add attachment:',
          error && error.stack ? error.stack : error
        );
      }
    }
  },

  onPaste(e: any) {
    const { items } = e.originalEvent.clipboardData;
    let imgBlob = null;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type.split('/')[0] === 'image') {
        imgBlob = items[i].getAsFile();
      }
    }
    if (imgBlob !== null) {
      const file = imgBlob;
      this.maybeAddAttachment(file);

      e.stopPropagation();
      e.preventDefault();
    }
  },

  getPropsForAttachmentList() {
    const draftAttachments = this.model.get('draftAttachments') || [];

    return {
      // In conversation model/redux
      attachments: draftAttachments.map((attachment: any) => {
        let url = '';
        if (attachment.screenshotPath) {
          url = getAbsoluteDraftPath(attachment.screenshotPath);
        } else if (attachment.path) {
          url = getAbsoluteDraftPath(attachment.path);
        } else {
          window.log.warn(
            'getPropsForAttachmentList: Attachment was missing both screenshotPath and path fields'
          );
        }

        return {
          ...attachment,
          url,
        };
      }),
      // Passed in from ConversationView
      onAddAttachment: this.onChooseAttachment.bind(this),
      onClickAttachment: this.onClickAttachment.bind(this),
      onCloseAttachment: this.onCloseAttachment.bind(this),
      onClose: this.clearAttachments.bind(this),
    };
  },

  onClickAttachment(attachment: any) {
    const getProps = () => ({
      url: attachment.url,
      caption: attachment.caption,
      attachment,
      onSave,
    });

    const onSave = (caption: any) => {
      this.model.set({
        draftAttachments: this.model
          .get('draftAttachments')
          .map((item: any) => {
            if (
              (item.path && item.path === attachment.path) ||
              (item.screenshotPath &&
                item.screenshotPath === attachment.screenshotPath)
            ) {
              return {
                ...attachment,
                caption,
              };
            }

            return item;
          }),
        draftChanged: true,
      });

      this.captionEditorView.remove();
      window.Signal.Backbone.Views.Lightbox.hide();

      this.updateAttachmentsView();
      this.saveModel();
    };

    this.captionEditorView = new Whisper.ReactWrapperView({
      className: 'attachment-list-wrapper',
      Component: window.Signal.Components.CaptionEditor,
      props: getProps(),
      onClose: () => window.Signal.Backbone.Views.Lightbox.hide(),
    });
    window.Signal.Backbone.Views.Lightbox.show(this.captionEditorView.el);
  },

  async deleteDraftAttachment(attachment: any) {
    if (attachment.screenshotPath) {
      await deleteDraftFile(attachment.screenshotPath);
    }
    if (attachment.path) {
      await deleteDraftFile(attachment.path);
    }
  },

  async saveModel() {
    window.Signal.Data.updateConversation(this.model.attributes);
  },

  async addAttachment(attachment: any) {
    const onDisk = await this.writeDraftAttachment(attachment);

    const draftAttachments = this.model.get('draftAttachments') || [];
    this.model.set({
      draftAttachments: [...draftAttachments, onDisk],
      draftChanged: true,
    });
    this.updateAttachmentsView();

    await this.saveModel();
  },

  async onCloseAttachment(attachment: any) {
    const draftAttachments = this.model.get('draftAttachments') || [];

    this.model.set({
      draftAttachments: window._.reject(
        draftAttachments,
        item => item.path === attachment.path
      ),
      draftChanged: true,
    });

    this.updateAttachmentsView();

    await this.saveModel();
    await this.deleteDraftAttachment(attachment);
  },

  async clearAttachments() {
    this.voiceNoteAttachment = null;

    const draftAttachments = this.model.get('draftAttachments') || [];
    this.model.set({
      draftAttachments: [],
      draftChanged: true,
    });

    this.updateAttachmentsView();

    // We're fine doing this all at once; at most it should be 32 attachments
    await Promise.all([
      this.saveModel(),
      Promise.all(
        draftAttachments.map((attachment: any) =>
          this.deleteDraftAttachment(attachment)
        )
      ),
    ]);
  },

  hasFiles() {
    const draftAttachments = this.model.get('draftAttachments') || [];
    return draftAttachments.length > 0;
  },

  async getFiles() {
    if (this.voiceNoteAttachment) {
      // We don't need to pull these off disk; we return them as-is
      return [this.voiceNoteAttachment];
    }

    const draftAttachments = this.model.get('draftAttachments') || [];
    const files = window._.compact(
      await Promise.all(
        draftAttachments.map((attachment: any) => this.getFile(attachment))
      )
    );
    return files;
  },

  async getFile(attachment: any) {
    if (!attachment) {
      return Promise.resolve();
    }

    const data = await readDraftData(attachment.path);
    if (data.byteLength !== attachment.size) {
      window.log.error(
        `Attachment size from disk ${data.byteLength} did not match attachment size ${attachment.size}`
      );
      return null;
    }

    return {
      ...window._.pick(attachment, [
        'contentType',
        'fileName',
        'size',
        'caption',
        'blurHash',
      ]),
      data,
    };
  },

  arrayBufferFromFile(file: any): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const FR = new FileReader();
      FR.onload = (e: any) => {
        resolve(e.target.result);
      };
      FR.onerror = reject;
      FR.onabort = reject;
      FR.readAsArrayBuffer(file);
    });
  },

  showFileSizeError({ limit, units, u }: any) {
    const toast = new Whisper.FileSizeToast({
      model: { limit, units: units[u] },
    });
    toast.$el.insertAfter(this.$el);
    toast.render();
  },

  updateAttachmentsView() {
    this.attachmentListView.update(this.getPropsForAttachmentList());
    this.toggleMicrophone();
    if (this.hasFiles()) {
      this.removeLinkPreview();
    }
  },

  async writeDraftAttachment(attachment: any) {
    let toWrite = attachment;

    if (toWrite.data) {
      const path = await writeNewDraftData(toWrite.data);
      toWrite = {
        ...window._.omit(toWrite, ['data']),
        path,
      };
    }
    if (toWrite.screenshotData) {
      const screenshotPath = await writeNewDraftData(toWrite.screenshotData);
      toWrite = {
        ...window._.omit(toWrite, ['screenshotData']),
        screenshotPath,
      };
    }

    return toWrite;
  },

  async maybeAddAttachment(file: any) {
    if (!file) {
      return;
    }

    const MB = 1000 * 1024;
    if (file.size > 100 * MB) {
      this.showFileSizeError({ limit: 100, units: ['MB'], u: 0 });
      return;
    }

    if (window.Signal.Util.isFileDangerous(file.name)) {
      this.showToast(Whisper.DangerousFileTypeToast);
      return;
    }

    const draftAttachments = this.model.get('draftAttachments') || [];
    if (draftAttachments.length >= 32) {
      this.showToast(Whisper.MaxAttachmentsToast);
      return;
    }

    const haveNonImage = window._.any(
      draftAttachments,
      (attachment: any) => !MIME.isImage(attachment.contentType)
    );
    // You can't add another attachment if you already have a non-image staged
    if (haveNonImage) {
      this.showToast(Whisper.OneNonImageAtATimeToast);
      return;
    }

    // You can't add a non-image attachment if you already have attachments staged
    if (!MIME.isImage(file.type) && draftAttachments.length > 0) {
      this.showToast(Whisper.CannotMixImageAndNonImageAttachmentsToast);
      return;
    }

    let attachment;

    try {
      if (window.Signal.Util.GoogleChrome.isImageTypeSupported(file.type)) {
        attachment = await this.handleImageAttachment(file);
      } else if (
        window.Signal.Util.GoogleChrome.isVideoTypeSupported(file.type)
      ) {
        attachment = await this.handleVideoAttachment(file);
      } else {
        const data = await this.arrayBufferFromFile(file);
        attachment = {
          data,
          size: data.byteLength,
          contentType: file.type,
          fileName: file.name,
        };
      }
    } catch (e) {
      window.log.error(
        `Was unable to generate thumbnail for file type ${file.type}`,
        e && e.stack ? e.stack : e
      );
      const data = await this.arrayBufferFromFile(file);
      attachment = {
        data,
        size: data.byteLength,
        contentType: file.type,
        fileName: file.name,
      };
    }

    try {
      if (!this.isSizeOkay(attachment)) {
        return;
      }
    } catch (error) {
      window.log.error(
        'Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );

      this.showToast(Whisper.UnableToLoadToast);
      return;
    }

    try {
      await this.addAttachment(attachment);
    } catch (error) {
      window.log.error(
        'Error saving draft attachment:',
        error && error.stack ? error.stack : error
      );

      this.showToast(Whisper.UnableToLoadToast);
    }
  },

  isSizeOkay(attachment: any) {
    const limitKb = window.Signal.Types.Attachment.getUploadSizeLimitKb(
      attachment.contentType
    );
    // this needs to be cast properly
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if ((attachment.data.byteLength / 1024).toFixed(4) >= limitKb) {
      const units = ['kB', 'MB', 'GB'];
      let u = -1;
      let limit = limitKb * 1000;
      do {
        limit /= 1000;
        u += 1;
      } while (limit >= 1000 && u < units.length - 1);
      this.showFileSizeError({ limit, units, u });
      return false;
    }

    return true;
  },

  async handleVideoAttachment(file: any) {
    const objectUrl = URL.createObjectURL(file);
    if (!objectUrl) {
      throw new Error('Failed to create object url for video!');
    }
    try {
      const screenshotContentType = 'image/png';
      const screenshotBlob = await VisualAttachment.makeVideoScreenshot({
        objectUrl,
        contentType: screenshotContentType,
        logger: window.log,
      });
      const screenshotData = await VisualAttachment.blobToArrayBuffer(
        screenshotBlob
      );
      const data = await this.arrayBufferFromFile(file);

      return {
        fileName: file.name,
        screenshotContentType,
        screenshotData,
        screenshotSize: screenshotData.byteLength,
        contentType: file.type,
        data,
        size: data.byteLength,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },

  async handleImageAttachment(file: any) {
    const blurHash = await window.imageToBlurHash(file);
    if (MIME.isJPEG(file.type)) {
      const rotatedDataUrl = await window.autoOrientImage(file);
      const rotatedBlob = window.dataURLToBlobSync(rotatedDataUrl);
      const { contentType, file: resizedBlob, fileName } = await this.autoScale(
        {
          contentType: file.type,
          fileName: file.name,
          file: rotatedBlob,
        }
      );
      const data = await await VisualAttachment.blobToArrayBuffer(resizedBlob);

      return {
        fileName: fileName || file.name,
        contentType,
        data,
        size: data.byteLength,
        blurHash,
      };
    }

    const { contentType, file: resizedBlob, fileName } = await this.autoScale({
      contentType: file.type,
      fileName: file.name,
      file,
    });
    const data = await await VisualAttachment.blobToArrayBuffer(resizedBlob);
    return {
      fileName: fileName || file.name,
      contentType,
      data,
      size: data.byteLength,
      blurHash,
    };
  },

  autoScale(attachment: any) {
    const { contentType, file, fileName } = attachment;
    if (contentType.split('/')[0] !== 'image' || contentType === 'image/tiff') {
      // nothing to do
      return Promise.resolve(attachment);
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.onload = () => {
        URL.revokeObjectURL(url);

        const maxSize = 6000 * 1024;
        const maxHeight = 4096;
        const maxWidth = 4096;
        if (
          img.naturalWidth <= maxWidth &&
          img.naturalHeight <= maxHeight &&
          file.size <= maxSize
        ) {
          resolve(attachment);
          return;
        }

        const gifMaxSize = 25000 * 1024;
        if (file.type === 'image/gif' && file.size <= gifMaxSize) {
          resolve(attachment);
          return;
        }

        if (file.type === 'image/gif') {
          reject(new Error('GIF is too large'));
          return;
        }

        const targetContentType = 'image/jpeg';
        const canvas = window.loadImage.scale(img, {
          canvas: true,
          maxWidth,
          maxHeight,
        });

        let quality = 0.95;
        let i = 4;
        let blob;
        do {
          i -= 1;
          blob = window.dataURLToBlobSync(
            canvas.toDataURL(targetContentType, quality)
          );
          quality = (quality * maxSize) / blob.size;
          // NOTE: During testing with a large image, we observed the
          // `quality` value being > 1. Should we clamp it to [0.5, 1.0]?
          // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Syntax
          if (quality < 0.5) {
            quality = 0.5;
          }
        } while (i > 0 && blob.size > maxSize);

        resolve({
          ...attachment,
          fileName: this.fixExtension(fileName, targetContentType),
          contentType: targetContentType,
          file: blob,
        });
      };
      img.onerror = (
        _event: unknown,
        _source: unknown,
        _lineno: unknown,
        _colno: unknown,
        error: Error = new Error('Failed to load image for auto-scaling')
      ) => {
        URL.revokeObjectURL(url);
        reject(error);
      };
      img.src = url;
    });
  },

  getFileName(fileName: any) {
    if (!fileName) {
      return '';
    }

    if (!fileName.includes('.')) {
      return fileName;
    }

    return fileName.split('.').slice(0, -1).join('.');
  },

  getType(contentType: any) {
    if (!contentType) {
      return '';
    }

    if (!contentType.includes('/')) {
      return contentType;
    }

    return contentType.split('/')[1];
  },

  fixExtension(fileName: any, contentType: any) {
    const extension = this.getType(contentType);
    const name = this.getFileName(fileName);
    return `${name}.${extension}`;
  },

  markAllAsVerifiedDefault(unverified: any) {
    return Promise.all(
      unverified.map((contact: any) => {
        if (contact.isUnverified()) {
          return contact.setVerifiedDefault();
        }

        return null;
      })
    );
  },

  markAllAsApproved(untrusted: any) {
    return Promise.all(untrusted.map((contact: any) => contact.setApproved()));
  },

  openSafetyNumberScreens(unverified: any) {
    if (unverified.length === 1) {
      this.showSafetyNumber(unverified.at(0).id);
      return;
    }

    this.showMembers(null, unverified, { needVerify: true });
  },

  onVerifiedChange() {
    if (this.model.isUnverified()) {
      const unverified = this.model.getUnverified();
      let message;
      if (!unverified.length) {
        return;
      }
      if (unverified.length > 1) {
        message = window.i18n('multipleNoLongerVerified');
      } else {
        message = window.i18n('noLongerVerified', [
          unverified.at(0).getTitle(),
        ]);
      }

      // Need to re-add, since unverified set may have changed
      if (this.banner) {
        this.banner.remove();
        this.banner = null;
      }

      this.banner = new Whisper.BannerView({
        message,
        onDismiss: () => {
          this.markAllAsVerifiedDefault(unverified);
        },
        onClick: () => {
          this.openSafetyNumberScreens(unverified);
        },
      });

      const container = this.$('.discussion-container');
      container.append(this.banner.el);
    } else if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }
  },

  toggleMicrophone() {
    this.compositionApi.current.setShowMic(!this.hasFiles());
  },

  captureAudio(e: any) {
    if (e) {
      e.preventDefault();
    }

    if (this.compositionApi.current.isDirty()) {
      return;
    }

    if (this.hasFiles()) {
      this.showToast(Whisper.VoiceNoteMustBeOnlyAttachmentToast);
      return;
    }

    this.showToast(Whisper.VoiceNoteLimit);

    // Note - clicking anywhere will close the audio capture panel, due to
    //   the onClick handler in InboxView, which calls its closeRecording method.

    if (this.captureAudioView) {
      this.captureAudioView.remove();
      this.captureAudioView = null;
    }

    this.captureAudioView = new Whisper.RecorderView();

    const view = this.captureAudioView;
    view.render();
    view.on('send', this.handleAudioCapture.bind(this));
    view.on('confirm', this.handleAudioConfirm.bind(this));
    view.on('closed', this.endCaptureAudio.bind(this));
    view.$el.appendTo(this.$('.capture-audio'));
    view.$('.finish').focus();
    this.compositionApi.current.setMicActive(true);

    this.disableMessageField();
    this.$('.microphone').hide();
  },
  handleAudioConfirm(blob: any, lostFocus: any) {
    window.showConfirmationDialog({
      confirmStyle: 'negative',
      cancelText: window.i18n('discard'),
      message: lostFocus
        ? window.i18n('voiceRecordingInterruptedBlur')
        : window.i18n('voiceRecordingInterruptedMax'),
      okText: window.i18n('sendAnyway'),
      resolve: async () => {
        await this.handleAudioCapture(blob);
      },
    });
  },
  async handleAudioCapture(blob: any) {
    if (this.hasFiles()) {
      throw new Error('A voice note cannot be sent with other attachments');
    }

    const data = await this.arrayBufferFromFile(blob);

    // These aren't persisted to disk; they are meant to be sent immediately
    this.voiceNoteAttachment = {
      contentType: blob.type,
      data,
      size: data.byteLength,
      flags: window.textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
    };

    // Note: The RecorderView removes itself on send
    this.captureAudioView = null;

    this.sendMessage();
  },
  endCaptureAudio() {
    this.enableMessageField();
    this.$('.microphone').show();

    // Note: The RecorderView removes itself on close
    this.captureAudioView = null;

    this.compositionApi.current.setMicActive(false);
  },

  async onOpened(messageId: any) {
    if (messageId) {
      const message = await getMessageById(messageId, {
        Message: Whisper.Message,
      });

      if (message) {
        this.loadAndScroll(messageId);
        return;
      }

      window.log.warn(`onOpened: Did not find message ${messageId}`);
    }

    this.loadNewestMessages();
    this.model.updateLastMessage();

    this.focusMessageField();

    const quotedMessageId = this.model.get('quotedMessageId');
    if (quotedMessageId) {
      this.setQuoteMessage(quotedMessageId);
    }

    this.model.throttledFetchLatestGroupV2Data();
    this.model.throttledMaybeMigrateV1Group();

    const statusPromise = this.model.throttledGetProfiles();
    // eslint-disable-next-line more/no-then
    this.statusFetch = statusPromise.then(() =>
      // eslint-disable-next-line more/no-then
      this.model.updateVerified().then(() => {
        this.onVerifiedChange();
        this.statusFetch = null;
      })
    );
  },

  async retrySend(messageId: any) {
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(`retrySend: Did not find message for id ${messageId}`);
    }
    await message.retrySend();
  },

  async showAllMedia() {
    // We fetch more documents than media as they don’t require to be loaded
    // into memory right away. Revisit this once we have infinite scrolling:
    const DEFAULT_MEDIA_FETCH_COUNT = 50;
    const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;

    const conversationId = this.model.get('id');

    const getProps = async () => {
      const rawMedia = await window.Signal.Data.getMessagesWithVisualMediaAttachments(
        conversationId,
        {
          limit: DEFAULT_MEDIA_FETCH_COUNT,
        }
      );
      const rawDocuments = await window.Signal.Data.getMessagesWithFileAttachments(
        conversationId,
        {
          limit: DEFAULT_DOCUMENTS_FETCH_COUNT,
        }
      );

      // First we upgrade these messages to ensure that they have thumbnails
      for (let max = rawMedia.length, i = 0; i < max; i += 1) {
        const message = rawMedia[i];
        const { schemaVersion } = message;

        if (schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY) {
          // Yep, we really do want to wait for each of these
          // eslint-disable-next-line no-await-in-loop
          rawMedia[i] = await upgradeMessageSchema(message);
          // eslint-disable-next-line no-await-in-loop
          await window.Signal.Data.saveMessage(rawMedia[i], {
            Message: Whisper.Message,
          });
        }
      }

      const media = window._.flatten(
        rawMedia.map(message => {
          const { attachments } = message;
          return (attachments || [])
            .filter(
              (attachment: any) =>
                attachment.thumbnail && !attachment.pending && !attachment.error
            )
            .map((attachment: any, index: any) => {
              const { thumbnail } = attachment;

              return {
                objectURL: getAbsoluteAttachmentPath(attachment.path),
                thumbnailObjectUrl: thumbnail
                  ? getAbsoluteAttachmentPath(thumbnail.path)
                  : null,
                contentType: attachment.contentType,
                index,
                attachment,
                message,
              };
            });
        })
      );

      // Unlike visual media, only one non-image attachment is supported
      const documents = rawDocuments
        .filter(message =>
          Boolean(message.attachments && message.attachments.length)
        )
        .map(message => {
          const attachments = message.attachments || [];
          const attachment = attachments[0];
          return {
            contentType: attachment.contentType,
            index: 0,
            attachment,
            message,
          };
        });

      const saveAttachment = async ({ attachment, message }: any = {}) => {
        const timestamp = message.sent_at;
        const fullPath = await window.Signal.Types.Attachment.save({
          attachment,
          readAttachmentData,
          saveAttachmentToDisk,
          timestamp,
        });

        if (fullPath) {
          this.showToast(Whisper.FileSavedToast, { fullPath });
        }
      };

      const onItemClick = async ({ message, attachment, type }: any) => {
        switch (type) {
          case 'documents': {
            saveAttachment({ message, attachment });
            break;
          }

          case 'media': {
            const selectedIndex = media.findIndex(
              mediaMessage => mediaMessage.attachment.path === attachment.path
            );
            this.lightboxGalleryView = new Whisper.ReactWrapperView({
              className: 'lightbox-wrapper',
              Component: window.Signal.Components.LightboxGallery,
              props: {
                media,
                onSave: saveAttachment,
                selectedIndex,
              },
              onClose: () => window.Signal.Backbone.Views.Lightbox.hide(),
            });
            window.Signal.Backbone.Views.Lightbox.show(
              this.lightboxGalleryView.el
            );
            break;
          }

          default:
            throw new TypeError(`Unknown attachment type: '${type}'`);
        }
      };

      return {
        documents,
        media,
        onItemClick,
      };
    };

    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      Component: window.Signal.Components.MediaGallery,
      props: await getProps(),
      onClose: () => {
        this.stopListening(this.model.messageCollection, 'remove', update);
      },
    });
    view.headerTitle = window.i18n('allMedia');

    const update = async () => {
      view.update(await getProps());
    };

    this.listenTo(this.model.messageCollection, 'remove', update);

    this.listenBack(view);
  },

  focusMessageField() {
    if (this.panels && this.panels.length) {
      return;
    }

    const { compositionApi } = this;

    if (compositionApi && compositionApi.current) {
      compositionApi.current.focusInput();
    }
  },

  disableMessageField() {
    this.compositionApi.current.setDisabled(true);
  },

  enableMessageField() {
    this.compositionApi.current.setDisabled(false);
  },

  resetEmojiResults() {
    this.compositionApi.current.resetEmojiResults(false);
  },

  async addMessage(message: any) {
    // This is debounced, so it won't hit the database too often.
    this.lazyUpdateVerified();

    // We do this here because we don't want convo.messageCollection to have
    //   anything in it unless it has an associated view. This is so, when we
    //   fetch on open, it's clean.
    this.model.addIncomingMessage(message);
  },

  async showMembers(_e: any, providedMembers: any, options: any = {}) {
    window._.defaults(options, { needVerify: false });

    let model = providedMembers || this.model.contactCollection;

    if (!providedMembers && this.model.isGroupV2()) {
      model = new Whisper.GroupConversationCollection(
        this.model.get('membersV2').map(({ conversationId, role }: any) => ({
          conversation: window.ConversationController.get(conversationId),
          isAdmin:
            role === window.textsecure.protobuf.Member.Role.ADMINISTRATOR,
        }))
      );
    }

    const view = new Whisper.GroupMemberList({
      model,
      // we pass this in to allow nested panels
      listenBack: this.listenBack.bind(this),
      needVerify: options.needVerify,
      conversation: this.model,
    });

    this.listenBack(view);
  },

  forceSend({ contactId, messageId }: any) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contact = window.ConversationController.get(contactId)!;
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(`forceSend: Did not find message for id ${messageId}`);
    }

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('identityKeyErrorOnSend', {
        name1: contact.getTitle(),
        name2: contact.getTitle(),
      }),
      okText: window.i18n('sendAnyway'),
      resolve: async () => {
        await contact.updateVerified();

        if (contact.isUnverified()) {
          await contact.setVerifiedDefault();
        }

        const untrusted = await contact.isUntrusted();
        if (untrusted) {
          contact.setApproved();
        }

        message.resend(contact.getSendTarget());
      },
    });
  },

  showSafetyNumber(id: any) {
    let conversation;

    if (!id && this.model.isPrivate()) {
      // eslint-disable-next-line prefer-destructuring
      conversation = this.model;
    } else {
      conversation = window.ConversationController.get(id);
    }
    if (conversation) {
      const view = new Whisper.KeyVerificationPanelView({
        model: conversation,
      });
      this.listenBack(view);
    }
  },

  downloadAttachmentWrapper(messageId: any) {
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(
        `downloadAttachmentWrapper: Did not find message for id ${messageId}`
      );
    }

    const { attachments, sent_at: timestamp } = message.attributes;
    if (!attachments || attachments.length < 1) {
      return;
    }

    const attachment = attachments[0];
    const { fileName } = attachment;

    const isDangerous = window.Signal.Util.isFileDangerous(fileName || '');

    this.downloadAttachment({ attachment, timestamp, isDangerous });
  },

  async downloadAttachment({ attachment, timestamp, isDangerous }: any) {
    if (isDangerous) {
      this.showToast(Whisper.DangerousFileTypeToast);
      return;
    }

    const fullPath = await window.Signal.Types.Attachment.save({
      attachment,
      readAttachmentData,
      saveAttachmentToDisk,
      timestamp,
    });

    if (fullPath) {
      this.showToast(Whisper.FileSavedToast, { fullPath });
    }
  },

  async displayTapToViewMessage(messageId: any) {
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(
        `displayTapToViewMessage: Did not find message for id ${messageId}`
      );
    }

    if (!message.isTapToView()) {
      throw new Error(
        `displayTapToViewMessage: Message ${message.idForLogging()} is not a tap to view message`
      );
    }

    if (message.isErased()) {
      throw new Error(
        `displayTapToViewMessage: Message ${message.idForLogging()} is already erased`
      );
    }

    const firstAttachment = message.get('attachments')[0];
    if (!firstAttachment || !firstAttachment.path) {
      throw new Error(
        `displayTapToViewMessage: Message ${message.idForLogging()} had no first attachment with path`
      );
    }

    const absolutePath = getAbsoluteAttachmentPath(firstAttachment.path);
    const tempPath = await copyIntoTempDirectory(absolutePath);
    const tempAttachment = {
      ...firstAttachment,
      path: tempPath,
    };

    await message.markViewed();

    const closeLightbox = async () => {
      if (!this.lightboxView) {
        return;
      }

      const { lightboxView } = this;
      this.lightboxView = null;

      this.stopListening(message);
      window.Signal.Backbone.Views.Lightbox.hide();
      lightboxView.remove();

      await deleteTempFile(tempPath);
    };
    this.listenTo(message, 'expired', closeLightbox);
    this.listenTo(message, 'change', () => {
      if (this.lightBoxView) {
        this.lightBoxView.update(getProps());
      }
    });

    const getProps = () => {
      const { path, contentType } = tempAttachment;

      return {
        objectURL: getAbsoluteTempPath(path),
        contentType,
        onSave: null, // important so download button is omitted
        isViewOnce: true,
      };
    };
    this.lightboxView = new Whisper.ReactWrapperView({
      className: 'lightbox-wrapper',
      Component: window.Signal.Components.Lightbox,
      props: getProps(),
      onClose: closeLightbox,
    });

    window.Signal.Backbone.Views.Lightbox.show(this.lightboxView.el);
  },

  deleteMessage(messageId: any) {
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(
        `deleteMessage: Did not find message for id ${messageId}`
      );
    }

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('deleteWarning'),
      okText: window.i18n('delete'),
      resolve: () => {
        window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
        message.trigger('unload');
        this.model.messageCollection.remove(message.id);
        if (message.isOutgoing()) {
          this.model.decrementSentMessageCount();
        } else {
          this.model.decrementMessageCount();
        }
        this.resetPanel();
      },
    });
  },

  deleteMessageForEveryone(messageId: string) {
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(
        `deleteMessageForEveryone: Did not find message for id ${messageId}`
      );
    }

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('deleteForEveryoneWarning'),
      okText: window.i18n('delete'),
      resolve: async () => {
        await this.model.sendDeleteForEveryoneMessage(message.get('sent_at'));
        this.resetPanel();
      },
    });
  },

  showStickerPackPreview(packId: any, packKey: any) {
    window.Signal.Stickers.downloadEphemeralPack(packId, packKey);

    const props = {
      packId,
      onClose: async () => {
        this.stickerPreviewModalView.remove();
        this.stickerPreviewModalView = null;
        await window.Signal.Stickers.removeEphemeralPack(packId);
      },
    };

    this.stickerPreviewModalView = new Whisper.ReactWrapperView({
      className: 'sticker-preview-modal-wrapper',
      JSX: window.Signal.State.Roots.createStickerPreviewModal(
        window.reduxStore,
        props
      ),
    });
  },

  // TODO: DESKTOP-1133 (DRY up these lightboxes)
  showLightboxForMedia(selectedMediaItem: any, media: Array<any> = []) {
    const onSave = async (options: any = {}) => {
      const fullPath = await window.Signal.Types.Attachment.save({
        attachment: options.attachment,
        index: options.index + 1,
        readAttachmentData,
        saveAttachmentToDisk,
        timestamp: options.message.get('sent_at'),
      });

      if (fullPath) {
        this.showToast(Whisper.FileSavedToast, { fullPath });
      }
    };

    const selectedIndex = media.findIndex(
      mediaItem =>
        mediaItem.attachment.path === selectedMediaItem.attachment.path
    );

    this.lightboxGalleryView = new Whisper.ReactWrapperView({
      className: 'lightbox-wrapper',
      Component: window.Signal.Components.LightboxGallery,
      props: {
        media,
        onSave,
        selectedIndex,
      },
      onClose: () => window.Signal.Backbone.Views.Lightbox.hide(),
    });

    window.Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
  },

  showLightbox({
    attachment,
    messageId,
  }: {
    attachment: typeof Attachment;
    messageId: string;
    showSingle?: boolean;
  }) {
    const message = this.model.messageCollection.get(messageId);
    if (!message) {
      throw new Error(`showLightbox: did not find message for id ${messageId}`);
    }
    const sticker = message.get('sticker');
    if (sticker) {
      const { packId, packKey } = sticker;
      this.showStickerPackPreview(packId, packKey);
      return;
    }

    const { contentType, path } = attachment;

    if (
      !window.Signal.Util.GoogleChrome.isImageTypeSupported(contentType) &&
      !window.Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)
    ) {
      this.downloadAttachment({ attachment, message });
      return;
    }

    const attachments = message.get('attachments') || [];

    const media = attachments
      .filter((item: any) => item.thumbnail && !item.pending && !item.error)
      .map((item: any, index: any) => ({
        objectURL: getAbsoluteAttachmentPath(item.path),
        path: item.path,
        contentType: item.contentType,
        index,
        message,
        attachment: item,
      }));

    if (media.length === 1) {
      const props = {
        objectURL: getAbsoluteAttachmentPath(path),
        contentType,
        caption: attachment.caption,
        onSave: () => {
          const timestamp = message.get('sent_at');
          this.downloadAttachment({ attachment, timestamp, message });
        },
      };
      this.lightboxView = new Whisper.ReactWrapperView({
        className: 'lightbox-wrapper',
        Component: window.Signal.Components.Lightbox,
        props,
        onClose: () => {
          window.Signal.Backbone.Views.Lightbox.hide();
          this.stopListening(message);
        },
      });
      this.listenTo(message, 'expired', () => this.lightboxView.remove());
      window.Signal.Backbone.Views.Lightbox.show(this.lightboxView.el);
      return;
    }

    const selectedIndex = window._.findIndex(
      media,
      (item: any) => attachment.path === item.path
    );

    const onSave = async (options: any = {}) => {
      const fullPath = await window.Signal.Types.Attachment.save({
        attachment: options.attachment,
        index: options.index + 1,
        readAttachmentData,
        saveAttachmentToDisk,
        timestamp: options.message.get('sent_at'),
      });

      if (fullPath) {
        this.showToast(Whisper.FileSavedToast, { fullPath });
      }
    };

    const props = {
      media,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
      onSave,
    };
    this.lightboxGalleryView = new Whisper.ReactWrapperView({
      className: 'lightbox-wrapper',
      Component: window.Signal.Components.LightboxGallery,
      props,
      onClose: () => {
        window.Signal.Backbone.Views.Lightbox.hide();
        this.stopListening(message);
      },
    });
    this.listenTo(message, 'expired', () => this.lightboxGalleryView.remove());
    window.Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
  },

  showContactModal(contactId: string) {
    if (this.contactModalView) {
      this.contactModalView.remove();
      this.contactModalView = null;
    }

    this.previousFocus = document.activeElement;

    const hideContactModal = () => {
      if (this.contactModalView) {
        this.contactModalView.remove();
        this.contactModalView = null;
        if (this.previousFocus && this.previousFocus.focus) {
          this.previousFocus.focus();
          this.previousFocus = null;
        }
      }
    };

    this.contactModalView = new Whisper.ReactWrapperView({
      JSX: window.Signal.State.Roots.createContactModal(window.reduxStore, {
        contactId,
        currentConversationId: this.model.id,
        onClose: hideContactModal,
        openConversation: (conversationId: string) => {
          hideContactModal();
          this.openConversation(conversationId);
        },
        removeMember: (conversationId: string) => {
          hideContactModal();
          this.model.removeFromGroupV2(conversationId);
        },
        showSafetyNumber: (conversationId: string) => {
          hideContactModal();
          this.showSafetyNumber(conversationId);
        },
        toggleAdmin: (conversationId: string) => {
          hideContactModal();

          const isAdmin = this.model.isAdmin(conversationId);
          const conversationModel = window.ConversationController.get(
            conversationId
          );

          if (!conversationModel) {
            window.log.info(
              'conversation_view/toggleAdmin: Could not find conversation to toggle admin privileges'
            );
            return;
          }

          window.showConfirmationDialog({
            cancelText: window.i18n('cancel'),
            message: isAdmin
              ? window.i18n('ContactModal--rm-admin-info', [
                  conversationModel.getTitle(),
                ])
              : window.i18n('ContactModal--make-admin-info', [
                  conversationModel.getTitle(),
                ]),
            okText: isAdmin
              ? window.i18n('ContactModal--rm-admin')
              : window.i18n('ContactModal--make-admin'),
            resolve: () => this.model.toggleAdmin(conversationId),
          });
        },
      }),
    });

    this.contactModalView.render();
  },

  showGroupLinkManagement() {
    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createGroupLinkManagement(
        window.reduxStore,
        {
          accessEnum: window.textsecure.protobuf.AccessControl.AccessRequired,
          changeHasGroupLink: this.changeHasGroupLink.bind(this),
          conversationId: this.model.id,
          copyGroupLink: this.copyGroupLink.bind(this),
          generateNewGroupLink: this.generateNewGroupLink.bind(this),
          setAccessControlAddFromInviteLinkSetting: this.setAccessControlAddFromInviteLinkSetting.bind(
            this
          ),
        }
      ),
    });
    view.headerTitle = window.i18n('ConversationDetails--group-link');

    this.listenBack(view);
    view.render();
  },

  showGroupV2Permissions() {
    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createGroupV2Permissions(
        window.reduxStore,
        {
          accessEnum: window.textsecure.protobuf.AccessControl.AccessRequired,
          conversationId: this.model.id,
          setAccessControlAttributesSetting: this.setAccessControlAttributesSetting.bind(
            this
          ),
          setAccessControlMembersSetting: this.setAccessControlMembersSetting.bind(
            this
          ),
        }
      ),
    });
    view.headerTitle = window.i18n('permissions');

    this.listenBack(view);
    view.render();
  },

  showPendingInvites() {
    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createPendingInvites(window.reduxStore, {
        conversationId: this.model.id,
        ourConversationId: window.ConversationController.getOurConversationId(),
        approvePendingMembership: (conversationId: string) => {
          this.model.approvePendingMembershipFromGroupV2(conversationId);
        },
        revokePendingMemberships: conversationIds => {
          this.model.revokePendingMembershipsFromGroupV2(conversationIds);
        },
      }),
    });
    view.headerTitle = window.i18n('ConversationDetails--requests-and-invites');

    this.listenBack(view);
    view.render();
  },

  showConversationDetails() {
    const conversation: ConversationModel = this.model;

    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

    // these methods are used in more than one place and should probably be
    // dried up and hoisted to methods on ConversationView

    const onDelete = () => {
      this.longRunningTaskWrapper({
        name: 'onDelete',
        task: this.model.syncMessageRequestResponse.bind(
          this.model,
          messageRequestEnum.DELETE
        ),
      });
    };

    const onBlockAndDelete = () => {
      this.longRunningTaskWrapper({
        name: 'onBlockAndDelete',
        task: this.model.syncMessageRequestResponse.bind(
          this.model,
          messageRequestEnum.BLOCK_AND_DELETE
        ),
      });
    };

    const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

    const hasGroupLink = Boolean(
      conversation.get('groupInviteLinkPassword') &&
        conversation.get('accessControl')?.addFromInviteLink !==
          ACCESS_ENUM.UNSATISFIABLE
    );

    const props = {
      addMembers: conversation.addMembersV2.bind(conversation),
      conversationId: conversation.get('id'),
      hasGroupLink,
      loadRecentMediaItems: this.loadRecentMediaItems.bind(this),
      setDisappearingMessages: this.setDisappearingMessages.bind(this),
      showAllMedia: this.showAllMedia.bind(this),
      showContactModal: this.showContactModal.bind(this),
      showGroupLinkManagement: this.showGroupLinkManagement.bind(this),
      showGroupV2Permissions: this.showGroupV2Permissions.bind(this),
      showPendingInvites: this.showPendingInvites.bind(this),
      showLightboxForMedia: this.showLightboxForMedia.bind(this),
      updateGroupAttributes: conversation.updateGroupAttributesV2.bind(
        conversation
      ),
      onDelete,
      onBlockAndDelete,
    };

    const view = new Whisper.ReactWrapperView({
      className: 'conversation-details-pane panel',
      JSX: window.Signal.State.Roots.createConversationDetails(
        window.reduxStore,
        props
      ),
    });
    view.headerTitle = '';

    this.listenBack(view);
    view.render();
  },

  showMessageDetail(messageId: any) {
    const { model }: { model: ConversationModel } = this;
    const message = model.messageCollection?.get(messageId);
    if (!message) {
      throw new Error(
        `showMessageDetail: Did not find message for id ${messageId}`
      );
    }

    if (!message.isNormalBubble()) {
      return;
    }

    const getProps = () => ({
      ...message.getPropsForMessageDetail(),
      ...this.getMessageActions(),
    });

    const onClose = () => {
      this.stopListening(message, 'change', update);
      this.resetPanel();
    };

    const view = new Whisper.ReactWrapperView({
      className: 'panel message-detail-wrapper',
      JSX: window.Signal.State.Roots.createMessageDetail(
        window.reduxStore,
        getProps()
      ),
      onClose,
    });

    const update = () => view.update(getProps());
    this.listenTo(message, 'change', update);
    this.listenTo(message, 'expired', onClose);
    // We could listen to all involved contacts, but we'll call that overkill

    this.listenBack(view);
    view.render();
  },

  showStickerManager() {
    const view = new Whisper.ReactWrapperView({
      className: ['sticker-manager-wrapper', 'panel'].join(' '),
      JSX: window.Signal.State.Roots.createStickerManager(window.reduxStore),
      onClose: () => {
        this.resetPanel();
      },
    });

    this.listenBack(view);
    view.render();
  },

  showContactDetail({ contact, signalAccount }: any) {
    const view = new Whisper.ReactWrapperView({
      Component: window.Signal.Components.ContactDetail,
      className: 'contact-detail-pane panel',
      props: {
        contact,
        hasSignalAccount: Boolean(signalAccount),
        onSendMessage: () => {
          if (signalAccount) {
            this.openConversation(signalAccount);
          }
        },
      },
      onClose: () => {
        this.resetPanel();
      },
    });

    this.listenBack(view);
  },

  async openConversation(number: any) {
    window.Whisper.events.trigger('showConversation', number);
  },

  listenBack(view: any) {
    this.panels = this.panels || [];

    if (this.panels.length === 0) {
      this.previousFocus = document.activeElement;
    }

    this.panels.unshift(view);
    view.$el.insertAfter(this.$('.panel').last());
    view.$el.one('animationend', () => {
      view.$el.addClass('panel--static');
    });

    window.reduxActions.conversations.setSelectedConversationPanelDepth(
      this.panels.length
    );
    window.reduxActions.conversations.setSelectedConversationHeaderTitle(
      view.headerTitle
    );
  },
  resetPanel() {
    if (!this.panels || !this.panels.length) {
      return;
    }

    const view = this.panels.shift();

    if (
      this.panels.length === 0 &&
      this.previousFocus &&
      this.previousFocus.focus
    ) {
      this.previousFocus.focus();
      this.previousFocus = null;
    }

    if (this.panels.length > 0) {
      this.panels[0].$el.fadeIn(250);
    }

    view.$el.addClass('panel--remove').one('transitionend', () => {
      view.remove();

      if (this.panels.length === 0) {
        // Make sure poppers are positioned properly
        window.dispatchEvent(new Event('resize'));
      }
    });

    window.reduxActions.conversations.setSelectedConversationPanelDepth(
      this.panels.length
    );
    window.reduxActions.conversations.setSelectedConversationHeaderTitle(
      this.panels[0]?.headerTitle
    );
  },

  endSession() {
    this.model.endSession();
  },

  async loadRecentMediaItems(limit: number): Promise<void> {
    const messages: Array<MessageType> = await window.Signal.Data.getMessagesWithVisualMediaAttachments(
      this.model.id,
      {
        limit,
      }
    );

    const loadedRecentMediaItems = messages
      .filter(message => message.attachments !== undefined)
      .reduce(
        (acc, message) => [
          ...acc,
          ...message.attachments.map(
            (attachment: AttachmentType, index: number): MediaItemType => {
              const { thumbnail } = attachment;

              return {
                objectURL: getAbsoluteAttachmentPath(attachment.path || ''),
                thumbnailObjectUrl: thumbnail
                  ? getAbsoluteAttachmentPath(thumbnail.path)
                  : '',
                contentType: attachment.contentType,
                index,
                attachment,
                // this message is a valid structure, but doesn't work with ts
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                message: message as any,
              };
            }
          ),
        ],
        [] as Array<MediaItemType>
      );

    window.reduxActions.conversations.setRecentMediaItems(
      this.model.id,
      loadedRecentMediaItems
    );
  },

  async setDisappearingMessages(seconds: any) {
    const valueToSet = seconds > 0 ? seconds : null;

    await this.longRunningTaskWrapper({
      name: 'updateExpirationTimer',
      task: async () => this.model.updateExpirationTimer(valueToSet),
    });
  },

  async changeHasGroupLink(value: boolean) {
    await this.longRunningTaskWrapper({
      name: 'toggleGroupLink',
      task: async () => this.model.toggleGroupLink(value),
    });
  },

  async copyGroupLink(groupLink: string) {
    await navigator.clipboard.writeText(groupLink);
    this.showToast(Whisper.GroupLinkCopiedToast);
  },

  async generateNewGroupLink() {
    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('GroupLinkManagement--confirm-reset'),
      okText: window.i18n('GroupLinkManagement--reset'),
      resolve: async () => {
        await this.longRunningTaskWrapper({
          name: 'refreshGroupLink',
          task: async () => this.model.refreshGroupLink(),
        });
      },
    });
  },

  async setAccessControlAddFromInviteLinkSetting(value: boolean) {
    await this.longRunningTaskWrapper({
      name: 'updateAccessControlAddFromInviteLink',
      task: async () => this.model.updateAccessControlAddFromInviteLink(value),
    });
  },

  async setAccessControlAttributesSetting(value: number) {
    await this.longRunningTaskWrapper({
      name: 'updateAccessControlAttributes',
      task: async () => this.model.updateAccessControlAttributes(value),
    });
  },

  async setAccessControlMembersSetting(value: number) {
    await this.longRunningTaskWrapper({
      name: 'updateAccessControlMembers',
      task: async () => this.model.updateAccessControlMembers(value),
    });
  },

  setMuteNotifications(ms: number) {
    const muteExpiresAt = ms > 0 ? Date.now() + ms : undefined;

    if (muteExpiresAt) {
      // we use a timeoutId here so that we can reference the mute that was
      // potentially set in the ConversationController. Specifically for a
      // scenario where a conversation is already muted and we boot up the app,
      // a timeout will be already set. But if we change the mute to a later
      // date a new timeout would need to be set and the old one cleared. With
      // this ID we can reference the existing timeout.
      const timeoutId = this.model.getMuteTimeoutId();
      window.Signal.Services.removeTimeout(timeoutId);
      window.Signal.Services.onTimeout(
        muteExpiresAt,
        () => {
          this.setMuteNotifications(0);
        },
        timeoutId
      );
    }

    this.model.set({ muteExpiresAt });
    this.saveModel();
  },

  async destroyMessages() {
    window.showConfirmationDialog({
      message: window.i18n('deleteConversationConfirmation'),
      okText: window.i18n('delete'),
      resolve: () => {
        this.longRunningTaskWrapper({
          name: 'destroymessages',
          task: async () => {
            this.model.trigger('unload', 'delete messages');
            await this.model.destroyMessages();
            this.model.updateLastMessage();
          },
        });
      },
      reject: () => {
        window.log.info('destroyMessages: User canceled delete');
      },
    });
  },

  async isCallSafe() {
    const contacts = await this.getUntrustedContacts();
    if (contacts && contacts.length) {
      const callAnyway = await this.showSendAnywayDialog(
        contacts,
        window.i18n('callAnyway')
      );
      if (!callAnyway) {
        window.log.info(
          'Safety number change dialog not accepted, new call not allowed.'
        );
        return false;
      }
    }

    return true;
  },

  showSendAnywayDialog(contacts: any, confirmText: any) {
    return new Promise(resolve => {
      const dialog = new Whisper.SafetyNumberChangeDialogView({
        confirmText,
        contacts,
        reject: () => {
          resolve(false);
        },
        resolve: () => {
          resolve(true);
        },
      });

      this.$el.prepend(dialog.el);
    });
  },

  async sendReactionMessage(messageId: any, reaction: any) {
    const messageModel = messageId
      ? await getMessageById(messageId, {
          Message: Whisper.Message,
        })
      : null;

    try {
      await this.model.sendReactionMessage(reaction, {
        targetAuthorUuid: messageModel.getSourceUuid(),
        targetTimestamp: messageModel.get('sent_at'),
      });
    } catch (error) {
      window.log.error('Error sending reaction', error, messageId, reaction);
      this.showToast(Whisper.ReactionFailedToast);
    }
  },

  async sendStickerMessage(options: any = {}) {
    try {
      const contacts = await this.getUntrustedContacts(options);

      if (contacts && contacts.length) {
        const sendAnyway = await this.showSendAnywayDialog(contacts);
        if (sendAnyway) {
          this.sendStickerMessage({ ...options, force: true });
        }

        return;
      }

      const mandatoryProfileSharingEnabled = window.Signal.RemoteConfig.isEnabled(
        'desktop.mandatoryProfileSharing'
      );
      if (mandatoryProfileSharingEnabled && !this.model.get('profileSharing')) {
        this.model.set({ profileSharing: true });
      }

      if (this.showInvalidMessageToast()) {
        return;
      }

      const { packId, stickerId } = options;
      this.model.sendStickerMessage(packId, stickerId);
    } catch (error) {
      window.log.error(
        'clickSend error:',
        error && error.stack ? error.stack : error
      );
    }
  },

  async getUntrustedContacts(options: any = {}) {
    // This will go to the trust store for the latest identity key information,
    //   and may result in the display of a new banner for this conversation.
    await this.model.updateVerified();
    const unverifiedContacts = this.model.getUnverified();

    if (options.force) {
      if (unverifiedContacts.length) {
        await this.markAllAsVerifiedDefault(unverifiedContacts);
        // We only want force to break us through one layer of checks
        // eslint-disable-next-line no-param-reassign
        options.force = false;
      }
    } else if (unverifiedContacts.length) {
      return unverifiedContacts;
    }

    const untrustedContacts = this.model.getUntrusted();

    if (options.force) {
      if (untrustedContacts.length) {
        await this.markAllAsApproved(untrustedContacts);
      }
    } else if (untrustedContacts.length) {
      return untrustedContacts;
    }

    return null;
  },

  async setQuoteMessage(messageId: null | string) {
    const model: MessageModel | undefined = messageId
      ? await getMessageById(messageId, {
          Message: Whisper.Message,
        })
      : null;

    if (model && !model.canReply()) {
      return;
    }

    if (model && !model.isNormalBubble()) {
      return;
    }

    this.quote = null;
    this.quotedMessage = null;
    this.quoteHolder = null;

    const existing = this.model.get('quotedMessageId');
    if (existing !== messageId) {
      this.model.set({
        quotedMessageId: messageId,
        draftChanged: true,
      });

      await this.saveModel();
    }

    if (this.quoteView) {
      this.quoteView.remove();
      this.quoteView = null;
    }

    if (model) {
      const message = window.MessageController.register(model.id, model);
      this.quotedMessage = message;

      if (message) {
        this.quote = await this.model.makeQuote(this.quotedMessage);

        this.enableMessageField();
        this.focusMessageField();
      }
    }

    this.renderQuotedMessage();
  },

  renderQuotedMessage() {
    if (this.quoteView) {
      this.quoteView.remove();
      this.quoteView = null;
    }
    if (!this.quotedMessage) {
      return;
    }

    const message = new Whisper.Message({
      conversationId: this.model.id,
      quote: this.quote,
    } as any);
    message.quotedMessage = this.quotedMessage;
    this.quoteHolder = message;

    const props = message.getPropsForQuote();

    this.listenTo(message, 'scroll-to-message', () => {
      this.scrollToMessage(message.quotedMessage.id);
    });

    const contact = this.quotedMessage.getContact();
    if (contact) {
      this.listenTo(contact, 'change', this.renderQuotedMesage);
    }

    this.quoteView = new Whisper.ReactWrapperView({
      className: 'quote-wrapper',
      Component: window.Signal.Components.Quote,
      elCallback: (el: any) =>
        this.$(this.compositionApi.current.attSlotRef.current).prepend(el),
      props: {
        ...props,
        withContentAbove: true,
        onClose: () => {
          // This can't be the normal 'onClose' because that is always run when this
          //   view is removed from the DOM, and would clear the draft quote.
          this.setQuoteMessage(null);
        },
      },
    });
  },

  showInvalidMessageToast(messageText?: string): boolean {
    let ToastView;

    if (window.reduxStore.getState().expiration.hasExpired) {
      ToastView = Whisper.ExpiredToast;
    }
    if (!this.model.isValid()) {
      ToastView = Whisper.InvalidConversationToast;
    }
    if (
      this.model.isPrivate() &&
      (window.storage.isBlocked(this.model.get('e164')) ||
        window.storage.isUuidBlocked(this.model.get('uuid')))
    ) {
      ToastView = Whisper.BlockedToast;
    }
    if (
      !this.model.isPrivate() &&
      window.storage.isGroupBlocked(this.model.get('groupId'))
    ) {
      ToastView = Whisper.BlockedGroupToast;
    }
    if (!this.model.isPrivate() && this.model.get('left')) {
      ToastView = Whisper.LeftGroupToast;
    }
    if (messageText && messageText.length > MAX_MESSAGE_BODY_LENGTH) {
      ToastView = Whisper.MessageBodyTooLongToast;
    }

    if (ToastView) {
      this.showToast(ToastView);
      return true;
    }

    return false;
  },

  async sendMessage(message = '', mentions = [], options = {}) {
    this.sendStart = Date.now();

    try {
      const contacts = await this.getUntrustedContacts(options);
      this.disableMessageField();

      if (contacts && contacts.length) {
        const sendAnyway = await this.showSendAnywayDialog(contacts);
        if (sendAnyway) {
          this.sendMessage(message, mentions, { force: true });
          return;
        }

        this.enableMessageField();
        return;
      }
    } catch (error) {
      this.enableMessageField();
      window.log.error(
        'sendMessage error:',
        error && error.stack ? error.stack : error
      );
      return;
    }

    this.model.clearTypingTimers();

    if (this.showInvalidMessageToast(message)) {
      this.enableMessageField();
      return;
    }

    try {
      if (!message.length && !this.hasFiles() && !this.voiceNoteAttachment) {
        return;
      }

      const mandatoryProfileSharingEnabled = window.Signal.RemoteConfig.isEnabled(
        'desktop.mandatoryProfileSharing'
      );
      if (mandatoryProfileSharingEnabled && !this.model.get('profileSharing')) {
        this.model.set({ profileSharing: true });
      }

      const attachments = await this.getFiles();
      const sendDelta = Date.now() - this.sendStart;
      window.log.info('Send pre-checks took', sendDelta, 'milliseconds');

      this.model.sendMessage(
        message,
        attachments,
        this.quote,
        this.getLinkPreview(),
        undefined, // sticker
        mentions
      );

      this.compositionApi.current.reset();
      this.model.setMarkedUnread(false);
      this.setQuoteMessage(null);
      this.resetLinkPreview();
      this.clearAttachments();
    } catch (error) {
      window.log.error(
        'Error pulling attached files before send',
        error && error.stack ? error.stack : error
      );
    } finally {
      this.enableMessageField();
    }
  },

  onEditorStateChange(
    messageText: string,
    bodyRanges: Array<typeof window.Whisper.BodyRangeType>,
    caretLocation?: number
  ) {
    this.maybeBumpTyping(messageText);
    this.debouncedSaveDraft(messageText, bodyRanges);
    this.debouncedMaybeGrabLinkPreview(messageText, caretLocation);
  },

  async saveDraft(
    messageText: any,
    bodyRanges: Array<typeof window.Whisper.BodyRangeType>
  ) {
    const trimmed =
      messageText && messageText.length > 0 ? messageText.trim() : '';

    if (this.model.get('draft') && (!messageText || trimmed.length === 0)) {
      this.model.set({
        draft: null,
        draftChanged: true,
        draftBodyRanges: [],
      });
      await this.saveModel();

      return;
    }

    if (messageText !== this.model.get('draft')) {
      this.model.set({
        draft: messageText,
        draftChanged: true,
        draftBodyRanges: bodyRanges,
      });
      await this.saveModel();
    }
  },

  maybeGrabLinkPreview(message: string, caretLocation?: number) {
    // Don't generate link previews if user has turned them off
    if (!window.storage.get('linkPreviews', false)) {
      return;
    }
    // Do nothing if we're offline
    if (!window.textsecure.messaging) {
      return;
    }
    // If we have attachments, don't add link preview
    if (this.hasFiles()) {
      return;
    }
    // If we're behind a user-configured proxy, we don't support link previews
    if (window.isBehindProxy()) {
      return;
    }

    if (!message) {
      this.resetLinkPreview();
      return;
    }
    if (this.disableLinkPreviews) {
      return;
    }

    const links = window.Signal.LinkPreviews.findLinks(message, caretLocation);
    const { currentlyMatchedLink } = this;
    if (links.includes(currentlyMatchedLink)) {
      return;
    }

    this.currentlyMatchedLink = null;
    this.excludedPreviewUrls = this.excludedPreviewUrls || [];

    const link = links.find(
      item =>
        window.Signal.LinkPreviews.isLinkSafeToPreview(item) &&
        !this.excludedPreviewUrls.includes(item)
    );
    if (!link) {
      this.removeLinkPreview();
      return;
    }

    this.addLinkPreview(link);
  },

  resetLinkPreview() {
    this.disableLinkPreviews = false;
    this.excludedPreviewUrls = [];
    this.removeLinkPreview();
  },

  removeLinkPreview() {
    (this.preview || []).forEach((item: any) => {
      if (item.url) {
        URL.revokeObjectURL(item.url);
      }
    });
    this.preview = null;
    this.currentlyMatchedLink = null;
    this.linkPreviewAbortController?.abort();
    this.linkPreviewAbortController = null;
    this.renderLinkPreview();
  },

  async getStickerPackPreview(
    url: string,
    abortSignal: any
  ): Promise<null | GetLinkPreviewResult> {
    const isPackDownloaded = (pack: any) =>
      pack && (pack.status === 'downloaded' || pack.status === 'installed');
    const isPackValid = (pack: any) =>
      pack &&
      (pack.status === 'ephemeral' ||
        pack.status === 'downloaded' ||
        pack.status === 'installed');

    const dataFromLink = window.Signal.Stickers.getDataFromLink(url);
    if (!dataFromLink) {
      return null;
    }
    const { id, key } = dataFromLink;

    try {
      const keyBytes = window.Signal.Crypto.bytesFromHexString(key);
      const keyBase64 = window.Signal.Crypto.arrayBufferToBase64(keyBytes);

      const existing = window.Signal.Stickers.getStickerPack(id);
      if (!isPackDownloaded(existing)) {
        await window.Signal.Stickers.downloadEphemeralPack(id, keyBase64);
      }

      if (abortSignal.aborted) {
        return null;
      }

      const pack = window.Signal.Stickers.getStickerPack(id);

      if (!isPackValid(pack)) {
        return null;
      }
      if (pack.key !== keyBase64) {
        return null;
      }

      const { title, coverStickerId } = pack;
      const sticker = pack.stickers[coverStickerId];
      const data =
        pack.status === 'ephemeral'
          ? await window.Signal.Migrations.readTempData(sticker.path)
          : await window.Signal.Migrations.readStickerData(sticker.path);

      if (abortSignal.aborted) {
        return null;
      }

      return {
        title,
        url,
        image: {
          ...sticker,
          data,
          size: data.byteLength,
          contentType: 'image/webp',
        },
        description: null,
        date: null,
      };
    } catch (error) {
      window.log.error(
        'getStickerPackPreview error:',
        error && error.stack ? error.stack : error
      );
      return null;
    } finally {
      if (id) {
        await window.Signal.Stickers.removeEphemeralPack(id);
      }
    }
  },

  async getGroupPreview(
    url: string,
    abortSignal: any
  ): Promise<null | GetLinkPreviewResult> {
    let urlObject;
    try {
      urlObject = new URL(url);
    } catch (err) {
      return null;
    }

    const { hash } = urlObject;
    if (!hash) {
      return null;
    }
    const groupData = hash.slice(1);

    const {
      inviteLinkPassword,
      masterKey,
    } = window.Signal.Groups.parseGroupLink(groupData);

    const fields = window.Signal.Groups.deriveGroupFields(
      window.Signal.Crypto.base64ToArrayBuffer(masterKey)
    );
    const id = window.Signal.Crypto.arrayBufferToBase64(fields.id);
    const logId = `groupv2(${id})`;
    const secretParams = window.Signal.Crypto.arrayBufferToBase64(
      fields.secretParams
    );

    window.log.info(`getGroupPreview/${logId}: Fetching pre-join state`);
    const result = await window.Signal.Groups.getPreJoinGroupInfo(
      inviteLinkPassword,
      masterKey
    );

    if (abortSignal.aborted) {
      return null;
    }

    const title =
      window.Signal.Groups.decryptGroupTitle(result.title, secretParams) ||
      window.i18n('unknownGroup');
    const description =
      result.memberCount === 1 || result.memberCount === undefined
        ? window.i18n('GroupV2--join--member-count--single')
        : window.i18n('GroupV2--join--member-count--multiple', {
            count: result.memberCount.toString(),
          });
    let image: undefined | GetLinkPreviewImageResult;

    if (result.avatar) {
      try {
        const data = await window.Signal.Groups.decryptGroupAvatar(
          result.avatar,
          secretParams
        );
        image = {
          data,
          size: data.byteLength,
          contentType: 'image/jpeg',
          blurHash: await window.imageToBlurHash(
            new Blob([data], {
              type: 'image/jpeg',
            })
          ),
        };
      } catch (error) {
        const errorString = error && error.stack ? error.stack : error;
        window.log.error(
          `getGroupPreview/${logId}: Failed to fetch avatar ${errorString}`
        );
      }
    }

    if (abortSignal.aborted) {
      return null;
    }

    return {
      title,
      description,
      url,
      image,
      date: null,
    };
  },

  async getPreview(
    url: string,
    abortSignal: any
  ): Promise<null | GetLinkPreviewResult> {
    if (window.Signal.LinkPreviews.isStickerPack(url)) {
      return this.getStickerPackPreview(url, abortSignal);
    }
    if (window.Signal.LinkPreviews.isGroupLink(url)) {
      return this.getGroupPreview(url, abortSignal);
    }

    // This is already checked elsewhere, but we want to be extra-careful.
    if (!window.Signal.LinkPreviews.isLinkSafeToPreview(url)) {
      return null;
    }

    const linkPreviewMetadata = await window.textsecure.messaging.fetchLinkPreviewMetadata(
      url,
      abortSignal
    );
    if (!linkPreviewMetadata) {
      return null;
    }
    const { title, imageHref, description, date } = linkPreviewMetadata;

    let image;
    if (
      !abortSignal.aborted &&
      imageHref &&
      window.Signal.LinkPreviews.isLinkSafeToPreview(imageHref)
    ) {
      let objectUrl: void | string;
      try {
        const fullSizeImage = await window.textsecure.messaging.fetchLinkPreviewImage(
          imageHref,
          abortSignal
        );
        if (!fullSizeImage) {
          throw new Error('Failed to fetch link preview image');
        }

        // Ensure that this file is either small enough or is resized to meet our
        //   requirements for attachments
        const withBlob = await this.autoScale({
          contentType: fullSizeImage.contentType,
          file: new Blob([fullSizeImage.data], {
            type: fullSizeImage.contentType,
          }),
        });

        const data = await this.arrayBufferFromFile(withBlob.file);
        objectUrl = URL.createObjectURL(withBlob.file);

        const blurHash = await window.imageToBlurHash(withBlob.file);

        const dimensions = await VisualAttachment.getImageDimensions({
          objectUrl,
          logger: window.log,
        });

        image = {
          data,
          size: data.byteLength,
          ...dimensions,
          contentType: withBlob.file.type,
          blurHash,
        };
      } catch (error) {
        // We still want to show the preview if we failed to get an image
        window.log.error(
          'getPreview failed to get image for link preview:',
          error.message
        );
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    }

    return {
      title,
      url,
      image,
      description,
      date,
    };
  },

  async addLinkPreview(url: string) {
    if (this.currentlyMatchedLink === url) {
      window.log.warn(
        'addLinkPreview should not be called with the same URL like this'
      );
      return;
    }

    (this.preview || []).forEach((item: any) => {
      if (item.url) {
        URL.revokeObjectURL(item.url);
      }
    });
    this.preview = null;

    // Cancel other in-flight link preview requests.
    if (this.linkPreviewAbortController) {
      window.log.info(
        'addLinkPreview: canceling another in-flight link preview request'
      );
      this.linkPreviewAbortController.abort();
    }

    const thisRequestAbortController = new AbortController();
    this.linkPreviewAbortController = thisRequestAbortController;

    const timeout = setTimeout(() => {
      thisRequestAbortController.abort();
    }, LINK_PREVIEW_TIMEOUT);

    this.currentlyMatchedLink = url;
    this.renderLinkPreview();

    try {
      const result = await this.getPreview(
        url,
        thisRequestAbortController.signal
      );

      if (!result) {
        window.log.info(
          'addLinkPreview: failed to load preview (not necessarily a problem)'
        );

        // This helps us disambiguate between two kinds of failure:
        //
        // 1. We failed to fetch the preview because of (1) a network failure (2) an
        //    invalid response (3) a timeout
        // 2. We failed to fetch the preview because we aborted the request because the
        //    user changed the link (e.g., by continuing to type the URL)
        const failedToFetch = this.currentlyMatchedLink === url;
        if (failedToFetch) {
          this.excludedPreviewUrls.push(url);
          this.removeLinkPreview();
        }
        return;
      }

      if (result.image) {
        const blob = new Blob([result.image.data], {
          type: result.image.contentType,
        });
        result.image.url = URL.createObjectURL(blob);
      } else if (!result.title) {
        // A link preview isn't worth showing unless we have either a title or an image
        this.removeLinkPreview();
        return;
      }

      this.preview = [result];
      this.renderLinkPreview();
    } catch (error) {
      window.log.error(
        'Problem loading link preview, disabling.',
        error && error.stack ? error.stack : error
      );
      this.disableLinkPreviews = true;
      this.removeLinkPreview();
    } finally {
      clearTimeout(timeout);
    }
  },

  renderLinkPreview() {
    if (this.previewView) {
      this.previewView.remove();
      this.previewView = null;
    }
    if (!this.currentlyMatchedLink) {
      return;
    }

    const first = (this.preview && this.preview[0]) || null;
    const props = {
      ...first,
      domain: first && window.Signal.LinkPreviews.getDomain(first.url),
      isLoaded: Boolean(first),
      onClose: () => {
        this.disableLinkPreviews = true;
        this.removeLinkPreview();
      },
    };

    this.previewView = new Whisper.ReactWrapperView({
      className: 'preview-wrapper',
      Component: window.Signal.Components.StagedLinkPreview,
      elCallback: (el: any) =>
        this.$(this.compositionApi.current.attSlotRef.current).prepend(el),
      props,
    });
  },

  getLinkPreview() {
    // Don't generate link previews if user has turned them off
    if (!window.storage.get('linkPreviews', false)) {
      return [];
    }

    if (!this.preview) {
      return [];
    }

    return this.preview.map((item: any) => {
      if (item.image) {
        // We eliminate the ObjectURL here, unneeded for send or save
        return {
          ...item,
          image: window._.omit(item.image, 'url'),
        };
      }

      return item;
    });
  },

  // Called whenever the user changes the message composition field. But only
  //   fires if there's content in the message field after the change.
  maybeBumpTyping(messageText: any) {
    if (messageText.length) {
      this.model.throttledBumpTyping();
    }
  },
});
