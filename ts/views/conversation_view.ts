// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import { clipboard } from 'electron';
import {
  AttachmentDraftType,
  AttachmentType,
  InMemoryAttachmentDraftType,
  OnDiskAttachmentDraftType,
} from '../types/Attachment';
import { IMAGE_JPEG } from '../types/MIME';
import { ConversationModel } from '../models/conversations';
import {
  GroupV2PendingMemberType,
  MessageModelCollectionType,
  MessageAttributesType,
} from '../model-types.d';
import { LinkPreviewType } from '../types/message/LinkPreviews';
import { MediaItemType } from '../components/LightboxGallery';
import { MessageModel } from '../models/messages';
import { assert } from '../util/assert';
import { maybeParseUrl } from '../util/url';
import { addReportSpamJob } from '../jobs/helpers/addReportSpamJob';
import { reportSpamJobQueue } from '../jobs/reportSpamJobQueue';
import { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import {
  isDirectConversation,
  isGroupV1,
  isMe,
} from '../util/whatTypeOfConversation';
import { findAndFormatContact } from '../util/findAndFormatContact';
import * as Bytes from '../Bytes';
import {
  canReply,
  getAttachmentsForMessage,
  isOutgoing,
  isTapToView,
} from '../state/selectors/message';
import { getMessagesByConversation } from '../state/selectors/conversations';
import { ConversationDetailsMembershipList } from '../components/conversation/conversation-details/ConversationDetailsMembershipList';
import { showSafetyNumberChangeDialog } from '../shims/showSafetyNumberChangeDialog';
import { autoOrientImage } from '../util/autoOrientImage';
import { canvasToBlob } from '../util/canvasToBlob';
import {
  LinkPreviewImage,
  LinkPreviewResult,
  LinkPreviewWithDomain,
} from '../types/LinkPreview';
import * as LinkPreview from '../types/LinkPreview';

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
  loadAttachmentData,
  loadPreviewData,
  loadStickerData,
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

Whisper.CaptchaSolvedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('verificationComplete') };
  },
});

Whisper.CaptchaFailedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('verificationFailed') };
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
  onKeydown(event: KeyboardEvent) {
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
  onKeydown(event: KeyboardEvent) {
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

Whisper.DeleteForEveryoneFailedToast = Whisper.ToastView.extend({
  render_attributes() {
    return { toastMessage: window.i18n('deleteForEveryoneFailed') };
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

const ReportedSpamAndBlockedToast = Whisper.ToastView.extend({
  template: () =>
    window.i18n('MessageRequests--block-and-report-spam-success-toast'),
});

Whisper.ConversationLoadingScreen = Whisper.View.extend({
  template: () => $('#conversation-loading-screen').html(),
  className: 'conversation-loading-screen',
});

Whisper.ConversationView = Whisper.View.extend({
  className() {
    const { model }: { model: ConversationModel } = this;
    return ['conversation', model.get('type')].join(' ');
  },
  id() {
    const { model }: { model: ConversationModel } = this;
    return `conversation-${model.cid}`;
  },
  template: () => $('#conversation').html(),
  render_attributes() {
    return {
      'send-message': window.i18n('sendMessage'),
    };
  },
  initialize() {
    const { model }: { model: ConversationModel } = this;

    // Events on Conversation model
    this.listenTo(this.model, 'destroy', this.stopListening);
    this.listenTo(this.model, 'newmessage', this.lazyUpdateVerified);

    // These are triggered by InboxView
    this.listenTo(this.model, 'opened', this.onOpened);
    this.listenTo(this.model, 'scroll-to-message', this.scrollToMessage);
    this.listenTo(this.model, 'unload', (reason: string) =>
      this.unload(`model trigger - ${reason}`)
    );

    // These are triggered by background.ts for keyboard handling
    this.listenTo(this.model, 'focus-composer', this.focusMessageField);
    this.listenTo(this.model, 'open-all-media', this.showAllMedia);
    this.listenTo(this.model, 'begin-recording', this.captureAudio);
    this.listenTo(this.model, 'attach-file', this.onChooseAttachment);
    this.listenTo(this.model, 'escape-pressed', this.resetPanel);
    this.listenTo(this.model, 'show-message-details', this.showMessageDetail);
    this.listenTo(this.model, 'show-contact-modal', this.showContactModal);
    this.listenTo(
      this.model,
      'toggle-reply',
      (messageId: string | undefined) => {
        const target = this.quote || !messageId ? null : messageId;
        this.setQuoteMessage(target);
      }
    );
    this.listenTo(model, 'save-attachment', this.downloadAttachmentWrapper);
    this.listenTo(model, 'delete-message', this.deleteMessage);
    this.listenTo(model, 'remove-link-review', this.removeLinkPreview);
    this.listenTo(model, 'remove-all-draft-attachments', this.clearAttachments);

    this.lazyUpdateVerified = window._.debounce(
      model.updateVerified.bind(model),
      1000 // one second
    );
    this.model.throttledGetProfiles =
      this.model.throttledGetProfiles ||
      window._.throttle(this.model.getProfiles.bind(this.model), FIVE_MINUTES);

    this.debouncedMaybeGrabLinkPreview = window._.debounce(
      this.maybeGrabLinkPreview.bind(this),
      200
    );
    this.debouncedSaveDraft = window._.debounce(this.saveDraft.bind(this), 200);

    this.render();

    this.loadingScreen = new Whisper.ConversationLoadingScreen();
    this.loadingScreen.render();
    this.loadingScreen.$el.prependTo(this.$('.discussion-container'));

    this.setupHeader();
    this.setupTimeline();
    this.setupCompositionArea();

    this.linkPreviewAbortController = null;
    this.updateAttachmentsView();
  },

  events: {
    'click .capture-audio .microphone': 'captureAudio',
    'change input.file-input': 'onChoseAttachment',

    dragover: 'onDragOver',
    dragleave: 'onDragLeave',
    drop: 'onDrop',
    copy: 'onCopy',
    paste: 'onPaste',
  },

  getMuteExpirationLabel() {
    const { model }: { model: ConversationModel } = this;
    const muteExpiresAt = model.get('muteExpiresAt');
    if (!model.isMuted()) {
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
    const { model }: { model: ConversationModel } = this;

    if (value) {
      const pinnedConversationIds = window.storage.get(
        'pinnedConversationIds',
        new Array<string>()
      );

      if (pinnedConversationIds.length >= 4) {
        this.showToast(Whisper.PinnedConversationsFullToast);
        return;
      }
      model.pin();
    } else {
      model.unpin();
    }
  },

  setupHeader() {
    const { model }: { model: ConversationModel } = this;

    this.titleView = new Whisper.ReactWrapperView({
      className: 'title-wrapper',
      JSX: window.Signal.State.Roots.createConversationHeader(
        window.reduxStore,
        {
          id: model.id,

          onShowContactModal: this.showContactModal.bind(this),
          onSetDisappearingMessages: (seconds: number) =>
            this.setDisappearingMessages(seconds),
          onDeleteMessages: () => this.destroyMessages(),
          onResetSession: () => this.endSession(),
          onSearchInConversation: () => {
            const { searchInConversation } = window.reduxActions.search;
            const name = isMe(model.attributes)
              ? window.i18n('noteToSelf')
              : model.getTitle();
            searchInConversation(model.id, name);
          },
          onSetMuteNotifications: (ms: number) =>
            model.setMuteExpiration(
              ms >= Number.MAX_SAFE_INTEGER ? ms : Date.now() + ms
            ),
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
                model.id,
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
                model.id,
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

          onShowChatColorEditor: () => {
            this.showChatColorEditor();
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
          onShowGroupMembers: () => {
            this.showGV1Members();
          },
          onGoBack: () => {
            this.resetPanel();
          },

          onArchive: () => {
            model.setArchived(true);
            model.trigger('unload', 'archive');

            Whisper.ToastView.show(
              Whisper.ConversationArchivedToast,
              document.body
            );
          },
          onMarkUnread: () => {
            model.setMarkedUnread(true);

            Whisper.ToastView.show(
              Whisper.ConversationMarkedUnreadToast,
              document.body
            );
          },
          onMoveToInbox: () => {
            model.setArchived(false);

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

  setupCompositionArea() {
    window.reduxActions.composer.resetComposer();

    const { model }: { model: ConversationModel } = this;

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
      id: model.id,
      compositionApi,
      onClickAddPack: () => this.showStickerManager(),
      onPickSticker: (packId: string, stickerId: number) =>
        this.sendStickerMessage({ packId, stickerId }),
      onSubmit: (
        message: string,
        mentions: typeof window.Whisper.BodyRangesType
      ) => this.sendMessage(message, mentions),
      onEditorStateChange: (
        msg: string,
        bodyRanges: Array<typeof window.Whisper.BodyRangeType>,
        caretLocation?: number
      ) => this.onEditorStateChange(msg, bodyRanges, caretLocation),
      onTextTooLong: () => this.showToast(Whisper.MessageBodyTooLongToast),
      onChooseAttachment: this.onChooseAttachment.bind(this),
      getQuotedMessage: () => model.get('quotedMessageId'),
      clearQuotedMessage: () => this.setQuoteMessage(null),
      micCellEl,
      onAccept: () => {
        this.syncMessageRequestResponse(
          'onAccept',
          model,
          messageRequestEnum.ACCEPT
        );
      },
      onBlock: () => {
        this.syncMessageRequestResponse(
          'onBlock',
          model,
          messageRequestEnum.BLOCK
        );
      },
      onUnblock: () => {
        this.syncMessageRequestResponse(
          'onUnblock',
          model,
          messageRequestEnum.ACCEPT
        );
      },
      onDelete: () => {
        this.syncMessageRequestResponse(
          'onDelete',
          model,
          messageRequestEnum.DELETE
        );
      },
      onBlockAndReportSpam: () => {
        this.blockAndReportSpam(model);
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
              task: async () => model.cancelJoinRequest(),
            });
          },
        });
      },

      onAddAttachment: this.onChooseAttachment.bind(this),
      onClickAttachment: this.onClickAttachment.bind(this),
      onCloseAttachment: this.onCloseAttachment.bind(this),
      onClearAttachments: this.clearAttachments.bind(this),
      onSelectMediaQuality: (isHQ: boolean) => {
        window.reduxActions.composer.setMediaQualitySetting(isHQ);
      },

      onClickQuotedMessage: (id?: string) => this.scrollToMessage(id),

      onCloseLinkPreview: () => {
        this.disableLinkPreviews = true;
        this.removeLinkPreview();
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
    const { model }: { model: ConversationModel } = this;
    const idForLogging = model.idForLogging();
    return window.Signal.Util.longRunningTaskWrapper({
      name,
      idForLogging,
      task,
    });
  },

  getMessageActions() {
    const reactToMessage = (
      messageId: string,
      reaction: { emoji: string; remove: boolean }
    ) => {
      this.sendReactionMessage(messageId, reaction);
    };
    const replyToMessage = (messageId: string) => {
      this.setQuoteMessage(messageId);
    };
    const retrySend = (messageId: string) => {
      this.retrySend(messageId);
    };
    const deleteMessage = (messageId: string) => {
      this.deleteMessage(messageId);
    };
    const deleteMessageForEveryone = (messageId: string) => {
      this.deleteMessageForEveryone(messageId);
    };
    const showMessageDetail = (messageId: string) => {
      this.showMessageDetail(messageId);
    };
    const showContactModal = (contactId: string) => {
      this.showContactModal(contactId);
    };
    const openConversation = (conversationId: string, messageId: any) => {
      this.openConversation(conversationId, messageId);
    };
    const showContactDetail = (options: any) => {
      this.showContactDetail(options);
    };
    const kickOffAttachmentDownload = async (options: any) => {
      const message = window.MessageController.getById(options.messageId);
      if (!message) {
        throw new Error(
          `kickOffAttachmentDownload: Message ${options.messageId} missing!`
        );
      }
      await message.queueAttachmentDownloads();
    };
    const markAttachmentAsCorrupted = (options: AttachmentOptions) => {
      const message = window.MessageController.getById(options.messageId);
      if (!message) {
        throw new Error(
          `markAttachmentAsCorrupted: Message ${options.messageId} missing!`
        );
      }
      message.markAttachmentAsCorrupted(options.attachment);
    };
    const showVisualAttachment = (options: {
      attachment: typeof Attachment;
      messageId: string;
      showSingle?: boolean;
    }) => {
      this.showLightbox(options);
    };
    const downloadAttachment = (options: any) => {
      this.downloadAttachment(options);
    };
    const displayTapToViewMessage = (messageId: string) =>
      this.displayTapToViewMessage(messageId);
    const showIdentity = (conversationId: string) => {
      this.showSafetyNumber(conversationId);
    };
    const openLink = (url: string) => {
      this.navigateTo(url);
    };
    const downloadNewVersion = () => {
      this.downloadNewVersion();
    };
    const sendAnyway = (contactId: string, messageId: string) => {
      this.forceSend(contactId, messageId);
    };
    const showSafetyNumber = (contactId: string) => {
      this.showSafetyNumber(contactId);
    };
    const showExpiredIncomingTapToViewToast = () => {
      this.showToast(Whisper.TapToViewExpiredIncomingToast);
    };
    const showExpiredOutgoingTapToViewToast = () => {
      this.showToast(Whisper.TapToViewExpiredOutgoingToast);
    };
    const showForwardMessageModal = this.showForwardMessageModal.bind(this);

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
      sendAnyway,
      showContactDetail,
      showContactModal,
      showSafetyNumber,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showForwardMessageModal,
      showIdentity,
      showMessageDetail,
      showVisualAttachment,
    };
  },

  setupTimeline() {
    const { model }: { model: ConversationModel } = this;
    const { id } = model;

    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

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

      const conversationId = model.id;
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

    const loadOlderMessages = async (oldestMessageId: string) => {
      const {
        messagesAdded,
        setMessagesLoading,
        repairOldestMessage,
      } = window.reduxActions.conversations;
      const conversationId = model.id;

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
        const isNewMessage = false;
        messagesAdded(
          id,
          cleaned.map((messageModel: MessageModel) => ({
            ...messageModel.attributes,
          })),
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
    const loadNewerMessages = async (newestMessageId: string) => {
      const {
        messagesAdded,
        setMessagesLoading,
        repairNewestMessage,
      } = window.reduxActions.conversations;
      const conversationId = model.id;

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
        const models = await getNewerMessagesByConversation(model.id, {
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
        const isNewMessage = false;
        messagesAdded(
          id,
          cleaned.map((messageModel: MessageModel) => ({
            ...messageModel.attributes,
          })),
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
    const markMessageRead = async (messageId: string) => {
      if (!window.isActive()) {
        return;
      }

      const message = await getMessageById(messageId, {
        Message: Whisper.Message,
      });
      if (!message) {
        throw new Error(`markMessageRead: failed to load message ${messageId}`);
      }

      await model.markRead(message.get('received_at'));
    };

    const createMessageRequestResponseHandler = (
      name: string,
      enumValue: number
    ): ((conversationId: string) => void) => conversationId => {
      const conversation = window.ConversationController.get(conversationId);
      if (!conversation) {
        assert(
          false,
          `Expected a conversation to be found in ${name}. Doing nothing`
        );
        return;
      }
      this.syncMessageRequestResponse(name, conversation, enumValue);
    };

    this.timelineView = new Whisper.ReactWrapperView({
      className: 'timeline-wrapper',
      JSX: window.Signal.State.Roots.createTimeline(window.reduxStore, {
        id,

        ...this.getMessageActions(),

        acknowledgeGroupMemberNameCollisions: (
          groupNameCollisions: Readonly<GroupNameCollisionsWithIdsByTitle>
        ): void => {
          model.acknowledgeGroupMemberNameCollisions(groupNameCollisions);
        },
        contactSupport,
        loadNewerMessages,
        loadNewestMessages: this.loadNewestMessages.bind(this),
        loadAndScroll: this.loadAndScroll.bind(this),
        loadOlderMessages,
        markMessageRead,
        onBlock: createMessageRequestResponseHandler(
          'onBlock',
          messageRequestEnum.BLOCK
        ),
        onBlockAndReportSpam: (conversationId: string) => {
          const conversation = window.ConversationController.get(
            conversationId
          );
          if (!conversation) {
            assert(
              false,
              'Expected a conversation to be found in onBlockAndReportSpam. Doing nothing'
            );
            return;
          }
          this.blockAndReportSpam(conversation);
        },
        onDelete: createMessageRequestResponseHandler(
          'onDelete',
          messageRequestEnum.DELETE
        ),
        onUnblock: createMessageRequestResponseHandler(
          'onUnblock',
          messageRequestEnum.ACCEPT
        ),
        onShowContactModal: this.showContactModal.bind(this),
        removeMember: (conversationId: string) => {
          this.longRunningTaskWrapper({
            name: 'removeMember',
            task: () => model.removeFromGroupV2(conversationId),
          });
        },
        scrollToQuotedMessage,
        unblurAvatar: () => {
          model.unblurAvatar();
        },
        updateSharedGroups: model.throttledUpdateSharedGroups,
      }),
    });

    this.$('.timeline-placeholder').append(this.timelineView.el);
  },

  showToast(
    ToastView: typeof window.Whisper.ToastView,
    options: any,
    element: Element
  ) {
    const toast = new ToastView(options);

    if (element) {
      toast.$el.appendTo(element);
    } else {
      const lightboxEl = $('.module-lightbox');
      if (lightboxEl.length > 0) {
        toast.$el.appendTo(lightboxEl);
      } else {
        toast.$el.appendTo(this.$el);
      }
    }

    toast.render();
  },

  async cleanModels(
    collection: MessageModelCollectionType | Array<MessageModel>
  ): Promise<Array<MessageModel>> {
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

  async scrollToMessage(messageId: string) {
    const { model }: { model: ConversationModel } = this;
    const message = await getMessageById(messageId, {
      Message: Whisper.Message,
    });
    if (!message) {
      throw new Error(`scrollToMessage: failed to load message ${messageId}`);
    }

    const state = window.reduxStore.getState();

    let isInMemory = true;

    if (!window.MessageController.getById(messageId)) {
      isInMemory = false;
    }

    // Message might be in memory, but not in the redux anymore because
    // we call `messageReset()` in `loadAndScroll()`.
    const messagesByConversation = getMessagesByConversation(state)[model.id];
    if (!messagesByConversation?.messageIds.includes(messageId)) {
      isInMemory = false;
    }

    if (isInMemory) {
      const { scrollToMessage } = window.reduxActions.conversations;
      scrollToMessage(model.id, messageId);
      return;
    }

    this.loadAndScroll(messageId);
  },

  setInProgressFetch() {
    const { model }: { model: ConversationModel } = this;
    let resolvePromise: (value?: unknown) => void;
    model.inProgressFetch = new Promise(resolve => {
      resolvePromise = resolve;
    });

    const finish = () => {
      resolvePromise();
      this.model.inProgressFetch = null;
    };

    return finish;
  },

  async loadAndScroll(
    messageId: string,
    options?: { disableScroll?: boolean }
  ) {
    const { model }: { model: ConversationModel } = this;
    const {
      messagesReset,
      setMessagesLoading,
    } = window.reduxActions.conversations;
    const conversationId = model.id;

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

      const cleaned: Array<MessageModel> = await this.cleanModels(all);
      const scrollToMessageId =
        options && options.disableScroll ? undefined : messageId;

      messagesReset(
        conversationId,
        cleaned.map((messageModel: MessageModel) => ({
          ...messageModel.attributes,
        })),
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

  async loadNewestMessages(
    newestMessageId: string | undefined,
    setFocus: boolean | undefined
  ): Promise<void> {
    const {
      messagesReset,
      setMessagesLoading,
    } = window.reduxActions.conversations;
    const { model }: { model: ConversationModel } = this;

    const conversationId = model.id;

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
        if (newestInMemoryMessage && newestInMemoryMessage.isUnread()) {
          scrollToLatestUnread = false;
        }
      }

      const metrics = await getMessageMetricsForConversation(conversationId);

      // If this is a message request that has not yet been accepted, we always show the
      //   oldest messages, to ensure that the ConversationHero is shown. We don't want to
      //   scroll directly to the oldest message, because that could scroll the hero off
      //   the screen.
      if (!newestMessageId && !model.getAccepted() && metrics.oldest) {
        this.loadAndScroll(metrics.oldest.id, { disableScroll: true });
        return;
      }

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

      const cleaned: Array<MessageModel> = await this.cleanModels(messages);
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
        cleaned.map((messageModel: MessageModel) => ({
          ...messageModel.attributes,
        })),
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
    const { model }: { model: ConversationModel } = this;
    const logId = model.idForLogging();

    if (!isGroupV1(model.attributes)) {
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
        task: () => window.Signal.Groups.initiateMigrationToGroupV2(model),
      });
    };

    // Note: this call will throw if, after generating member lists, we are no longer a
    //   member or are in the pending member list.
    const {
      droppedGV2MemberIds,
      pendingMembersV2,
    } = await this.longRunningTaskWrapper({
      name: 'getGroupMigrationMembers',
      task: () => window.Signal.Groups.getGroupMigrationMembers(model),
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

  unload(reason: string) {
    const { model }: { model: ConversationModel } = this;
    window.log.info(
      'unloading conversation',
      model.idForLogging(),
      'due to:',
      reason
    );

    const { conversationUnloaded } = window.reduxActions.conversations;
    if (conversationUnloaded) {
      conversationUnloaded(model.id);
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

      model.updateLastMessage();
    }

    this.titleView.remove();
    this.timelineView.remove();
    this.compositionAreaView.remove();

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
    if (this.lastSeenIndicator) {
      this.lastSeenIndicator.remove();
    }
    if (this.scrollDownButton) {
      this.scrollDownButton.remove();
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

  onCopy(e: any) {
    const selection = window.getSelection();
    if (selection) {
      clipboard.writeText(selection.toString());
      e.stopPropagation();
      e.preventDefault();
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

  syncMessageRequestResponse(
    name: string,
    model: ConversationModel,
    messageRequestType: number
  ): Promise<void> {
    return this.longRunningTaskWrapper({
      name,
      task: model.syncMessageRequestResponse.bind(model, messageRequestType),
    });
  },

  blockAndReportSpam(model: ConversationModel): Promise<void> {
    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

    return this.longRunningTaskWrapper({
      name: 'blockAndReportSpam',
      task: async () => {
        await Promise.all([
          model.syncMessageRequestResponse(messageRequestEnum.BLOCK),
          addReportSpamJob({
            conversation: model.format(),
            getMessageServerGuidsForSpam:
              window.Signal.Data.getMessageServerGuidsForSpam,
            jobQueue: reportSpamJobQueue,
          }),
        ]);
        this.showToast(ReportedSpamAndBlockedToast);
      },
    });
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

  async deleteDraftAttachment(attachment: AttachmentType) {
    if (attachment.screenshotPath) {
      await deleteDraftFile(attachment.screenshotPath);
    }
    if (attachment.path) {
      await deleteDraftFile(attachment.path);
    }
  },

  async saveModel() {
    const { model }: { model: ConversationModel } = this;
    window.Signal.Data.updateConversation(model.attributes);
  },

  async addAttachment(attachment: InMemoryAttachmentDraftType) {
    const { model }: { model: ConversationModel } = this;
    const onDisk = await this.writeDraftAttachment(attachment);

    const draftAttachments = model.get('draftAttachments') || [];
    this.model.set({
      draftAttachments: [...draftAttachments, onDisk],
    });
    this.updateAttachmentsView();

    await this.saveModel();
  },

  resolveOnDiskAttachment(
    attachment: OnDiskAttachmentDraftType
  ): AttachmentDraftType {
    let url = '';
    if (attachment.screenshotPath) {
      url = getAbsoluteDraftPath(attachment.screenshotPath);
    } else if (attachment.path) {
      url = getAbsoluteDraftPath(attachment.path);
    } else {
      window.log.warn(
        'resolveOnDiskAttachment: Attachment was missing both screenshotPath and path fields'
      );
    }

    return {
      ...attachment,
      url,
    };
  },

  async onCloseAttachment(attachment: any) {
    const { model }: { model: ConversationModel } = this;
    const draftAttachments = model.get('draftAttachments') || [];

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
    const { model }: { model: ConversationModel } = this;
    this.voiceNoteAttachment = null;

    const draftAttachments = model.get('draftAttachments') || [];
    this.model.set({
      draftAttachments: [],
      draftChanged: true,
    });

    this.updateAttachmentsView();

    // We're fine doing this all at once; at most it should be 32 attachments
    await Promise.all([
      this.saveModel(),
      Promise.all(
        draftAttachments.map(attachment =>
          this.deleteDraftAttachment(attachment)
        )
      ),
    ]);
  },

  hasFiles() {
    const { model }: { model: ConversationModel } = this;
    const draftAttachments = model.get('draftAttachments') || [];
    return draftAttachments.length > 0;
  },

  async getFiles() {
    const { model }: { model: ConversationModel } = this;
    if (this.voiceNoteAttachment) {
      // We don't need to pull these off disk; we return them as-is
      return [this.voiceNoteAttachment];
    }

    const draftAttachments = model.get('draftAttachments') || [];
    const files = window._.compact(
      await Promise.all(
        draftAttachments.map(attachment => this.getFile(attachment))
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

  arrayBufferFromFile(file: Blob): Promise<ArrayBuffer> {
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
    const draftAttachments = this.model.get('draftAttachments') || [];
    window.reduxActions.composer.replaceAttachments(
      draftAttachments.map((att: AttachmentType) =>
        this.resolveOnDiskAttachment(att)
      )
    );
    this.toggleMicrophone();
    if (this.hasFiles()) {
      this.removeLinkPreview();
    }
  },

  async writeDraftAttachment(
    attachment: InMemoryAttachmentDraftType
  ): Promise<OnDiskAttachmentDraftType> {
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

    const { model }: { model: ConversationModel } = this;

    const draftAttachments = model.get('draftAttachments') || [];
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

    let attachment: InMemoryAttachmentDraftType;

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

  async handleVideoAttachment(file: any): Promise<InMemoryAttachmentDraftType> {
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

  async handleImageAttachment(file: any): Promise<InMemoryAttachmentDraftType> {
    const blurHash = await window.imageToBlurHash(file);
    if (MIME.isJPEG(file.type)) {
      const rotatedBlob = await autoOrientImage(file);
      const { contentType, file: resizedBlob, fileName } = await this.autoScale(
        {
          contentType: file.type,
          fileName: file.name,
          file: rotatedBlob,
        }
      );
      const data = await VisualAttachment.blobToArrayBuffer(resizedBlob);

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
    const data = await VisualAttachment.blobToArrayBuffer(resizedBlob);
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
      img.onload = async () => {
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

        const targetContentType = IMAGE_JPEG;
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
          // We want to do these operations in serial.
          // eslint-disable-next-line no-await-in-loop
          blob = await canvasToBlob(canvas, targetContentType, quality);
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

  getFileName(fileName?: string) {
    if (!fileName) {
      return '';
    }

    if (!fileName.includes('.')) {
      return fileName;
    }

    return fileName.split('.').slice(0, -1).join('.');
  },

  getType(contentType?: string) {
    if (!contentType) {
      return '';
    }

    if (!contentType.includes('/')) {
      return contentType;
    }

    return contentType.split('/')[1];
  },

  fixExtension(fileName: string, contentType: string) {
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

  toggleMicrophone() {
    this.compositionApi.current.setShowMic(!this.hasFiles());
  },

  captureAudio(e?: Event) {
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
  handleAudioConfirm(blob: Blob, lostFocus?: boolean) {
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
  async handleAudioCapture(blob: Blob) {
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

  async onOpened(messageId: string) {
    const { model }: { model: ConversationModel } = this;

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

    const { retryPlaceholders } = window.Signal.Services;
    if (retryPlaceholders) {
      await retryPlaceholders.findByConversationAndMarkOpened(model.id);
    }

    this.loadNewestMessages();
    model.updateLastMessage();

    this.focusMessageField();

    const quotedMessageId = model.get('quotedMessageId');
    if (quotedMessageId) {
      this.setQuoteMessage(quotedMessageId);
    }

    model.fetchLatestGroupV2Data();
    assert(
      model.throttledMaybeMigrateV1Group !== undefined,
      'Conversation model should be initialized'
    );
    model.throttledMaybeMigrateV1Group();
    assert(
      model.throttledFetchSMSOnlyUUID !== undefined,
      'Conversation model should be initialized'
    );
    model.throttledFetchSMSOnlyUUID();

    const statusPromise = this.model.throttledGetProfiles();
    // eslint-disable-next-line more/no-then
    this.statusFetch = statusPromise.then(() =>
      // eslint-disable-next-line more/no-then
      model.updateVerified().then(() => {
        this.statusFetch = null;
      })
    );
  },

  async retrySend(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`retrySend: Message ${messageId} missing!`);
    }
    await message.retrySend();
  },

  showForwardMessageModal(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`showForwardMessageModal: Message ${messageId} missing!`);
    }

    const attachments = getAttachmentsForMessage(message.attributes);
    this.forwardMessageModal = new Whisper.ReactWrapperView({
      JSX: window.Signal.State.Roots.createForwardMessageModal(
        window.reduxStore,
        {
          attachments,
          doForwardMessage: async (
            conversationIds: Array<string>,
            messageBody?: string,
            includedAttachments?: Array<AttachmentType>,
            linkPreview?: LinkPreviewType
          ) => {
            const didForwardSuccessfully = await this.maybeForwardMessage(
              message,
              conversationIds,
              messageBody,
              includedAttachments,
              linkPreview
            );

            if (didForwardSuccessfully) {
              this.forwardMessageModal.remove();
              this.forwardMessageModal = null;
            }
          },
          isSticker: Boolean(message.get('sticker')),
          messageBody: message.getRawText(),
          onClose: () => {
            this.forwardMessageModal.remove();
            this.forwardMessageModal = null;
            this.resetLinkPreview();
          },
          onEditorStateChange: (
            messageText: string,
            _: Array<typeof window.Whisper.BodyRangeType>,
            caretLocation?: number
          ) => {
            if (!attachments.length) {
              this.debouncedMaybeGrabLinkPreview(messageText, caretLocation);
            }
          },
          onTextTooLong: () =>
            this.showToast(
              Whisper.MessageBodyTooLongToast,
              {},
              document.querySelector('.module-ForwardMessageModal')
            ),
        }
      ),
    });
    this.forwardMessageModal.render();
  },

  async maybeForwardMessage(
    message: MessageModel,
    conversationIds: Array<string>,
    messageBody?: string,
    attachments?: Array<AttachmentType>,
    linkPreview?: LinkPreviewType
  ): Promise<boolean> {
    window.log.info(
      `maybeForwardMessage/${message.idForLogging()}: Starting...`
    );
    const attachmentLookup = new Set();
    if (attachments) {
      attachments.forEach(attachment => {
        attachmentLookup.add(
          `${attachment.fileName}/${attachment.contentType}`
        );
      });
    }

    const conversations = conversationIds.map(id =>
      window.ConversationController.get(id)
    );

    // Verify that all contacts that we're forwarding
    // to are verified and trusted
    const unverifiedContacts: Array<ConversationModel> = [];
    const untrustedContacts: Array<ConversationModel> = [];
    await Promise.all(
      conversations.map(async conversation => {
        if (conversation) {
          await conversation.updateVerified();
          const unverifieds = conversation.getUnverified();
          if (unverifieds.length) {
            unverifieds.forEach(unverifiedConversation =>
              unverifiedContacts.push(unverifiedConversation)
            );
          }

          const untrusted = conversation.getUntrusted();
          if (untrusted.length) {
            untrusted.forEach(untrustedConversation =>
              untrustedContacts.push(untrustedConversation)
            );
          }
        }
      })
    );

    // If there are any unverified or untrusted contacts, show the
    // SendAnywayDialog and if we're fine with sending then mark all as
    // verified and trusted and continue the send.
    const iffyConversations = [...unverifiedContacts, ...untrustedContacts];
    if (iffyConversations.length) {
      const forwardMessageModal = document.querySelector<HTMLElement>(
        '.module-ForwardMessageModal'
      );
      if (forwardMessageModal) {
        forwardMessageModal.style.display = 'none';
      }
      const sendAnyway = await this.showSendAnywayDialog(iffyConversations);

      if (!sendAnyway) {
        if (forwardMessageModal) {
          forwardMessageModal.style.display = 'block';
        }
        return false;
      }

      let verifyPromise: Promise<void> | undefined;
      let approvePromise: Promise<void> | undefined;
      if (unverifiedContacts.length) {
        verifyPromise = this.markAllAsVerifiedDefault(unverifiedContacts);
      }
      if (untrustedContacts.length) {
        approvePromise = this.markAllAsApproved(untrustedContacts);
      }
      await Promise.all([verifyPromise, approvePromise]);
    }

    const sendMessageOptions = { dontClearDraft: true };
    const baseTimestamp = Date.now();

    // Actually send the message
    // load any sticker data, attachments, or link previews that we need to
    // send along with the message and do the send to each conversation.
    await Promise.all(
      conversations.map(async (conversation, offset) => {
        const timestamp = baseTimestamp + offset;
        if (conversation) {
          const sticker = message.get('sticker');
          if (sticker) {
            const stickerWithData = await loadStickerData(sticker);
            const stickerNoPath = stickerWithData
              ? {
                  ...stickerWithData,
                  data: {
                    ...stickerWithData.data,
                    path: undefined,
                  },
                }
              : undefined;

            conversation.sendMessage(
              null,
              [],
              null,
              [],
              stickerNoPath,
              undefined,
              { ...sendMessageOptions, timestamp }
            );
          } else {
            const preview = linkPreview
              ? await loadPreviewData([linkPreview])
              : [];
            const attachmentsWithData = await Promise.all(
              (attachments || []).map(async item => ({
                ...(await loadAttachmentData(item)),
                path: undefined,
              }))
            );
            const attachmentsToSend = attachmentsWithData.filter(
              (attachment: Partial<AttachmentType>) =>
                attachmentLookup.has(
                  `${attachment.fileName}/${attachment.contentType}`
                )
            );

            conversation.sendMessage(
              messageBody || null,
              attachmentsToSend,
              null, // quote
              preview,
              null, // sticker
              undefined, // BodyRanges
              { ...sendMessageOptions, timestamp }
            );
          }
        }
      })
    );

    // Cancel any link still pending, even if it didn't make it into the message
    this.resetLinkPreview();

    return true;
  },

  async showAllMedia() {
    // We fetch more documents than media as they don’t require to be loaded
    // into memory right away. Revisit this once we have infinite scrolling:
    const DEFAULT_MEDIA_FETCH_COUNT = 50;
    const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;

    const { model }: { model: ConversationModel } = this;
    const conversationId = model.get('id');

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

        if (
          schemaVersion &&
          schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY
        ) {
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
            .map((attachment: any, index: number) => {
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
        unsubscribe();
      },
    });
    view.headerTitle = window.i18n('allMedia');

    const update = async () => {
      view.update(await getProps());
    };

    function getMessageIds(): Array<string | undefined> | undefined {
      const state = window.reduxStore.getState();
      const byConversation = state?.conversations?.messagesByConversation;
      const messages = byConversation && byConversation[conversationId];
      if (!messages || !messages.messageIds) {
        return undefined;
      }

      return messages.messageIds;
    }

    // Detect message changes in the current conversation
    let previousMessageList: Array<string | undefined> | undefined;
    previousMessageList = getMessageIds();

    const unsubscribe = window.reduxStore.subscribe(() => {
      const currentMessageList = getMessageIds();
      if (currentMessageList !== previousMessageList) {
        update();
        previousMessageList = currentMessageList;
      }
    });

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

  showGV1Members() {
    const { model }: { model: ConversationModel } = this;
    const { contactCollection } = model;

    const memberships =
      contactCollection?.map((conversation: ConversationModel) => {
        return {
          isAdmin: false,
          member: conversation.format(),
        };
      }) || [];

    const view = new Whisper.ReactWrapperView({
      className: 'group-member-list panel',
      Component: ConversationDetailsMembershipList,
      props: {
        canAddNewMembers: false,
        i18n: window.i18n,
        maxShownMemberCount: 32,
        memberships,
        showContactModal: this.showContactModal.bind(this),
      },
    });

    this.listenBack(view);
    view.render();
  },

  forceSend({
    contactId,
    messageId,
  }: Readonly<{ contactId: string; messageId: string }>) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contact = window.ConversationController.get(contactId)!;
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`forceSend: Message ${messageId} missing!`);
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

        const sendTarget = contact.getSendTarget();
        if (!sendTarget) {
          throw new Error(
            `forceSend: Contact ${contact.idForLogging()} had no sendTarget!`
          );
        }

        message.resend(sendTarget);
      },
    });
  },

  showSafetyNumber(id: string) {
    const { model }: { model: ConversationModel } = this;

    let conversation: undefined | ConversationModel;

    if (!id && isDirectConversation(model.attributes)) {
      // eslint-disable-next-line prefer-destructuring
      conversation = model;
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

  downloadAttachmentWrapper(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(
        `downloadAttachmentWrapper: Message ${messageId} missing!`
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

  async downloadAttachment({
    attachment,
    timestamp,
    isDangerous,
  }: {
    attachment: typeof Attachment;
    timestamp: string;
    isDangerous: boolean;
  }) {
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

  async displayTapToViewMessage(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`displayTapToViewMessage: Message ${messageId} missing!`);
    }

    if (!isTapToView(message.attributes)) {
      throw new Error(
        `displayTapToViewMessage: Message ${message.idForLogging()} is not a tap to view message`
      );
    }

    if (message.isErased()) {
      throw new Error(
        `displayTapToViewMessage: Message ${message.idForLogging()} is already erased`
      );
    }

    const firstAttachment = (message.get('attachments') || [])[0];
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

  deleteMessage(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`deleteMessage: Message ${messageId} missing!`);
    }

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('deleteWarning'),
      okText: window.i18n('delete'),
      resolve: () => {
        window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
        message.cleanup();
        if (isOutgoing(message.attributes)) {
          this.model.decrementSentMessageCount();
        } else {
          this.model.decrementMessageCount();
        }
        this.resetPanel();
      },
    });
  },

  deleteMessageForEveryone(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(
        `deleteMessageForEveryone: Message ${messageId} missing!`
      );
    }

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('deleteForEveryoneWarning'),
      okText: window.i18n('delete'),
      resolve: async () => {
        try {
          await this.model.sendDeleteForEveryoneMessage(message.get('sent_at'));
        } catch (error) {
          window.log.error(
            'Error sending delete-for-everyone',
            error && error.stack,
            messageId
          );
          this.showToast(Whisper.DeleteForEveryoneFailedToast);
        }
        this.resetPanel();
      },
    });
  },

  showStickerPackPreview(packId: string, packKey: string) {
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
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`showLightbox: Message ${messageId} missing!`);
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
      .map((item: any, index: number) => ({
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
    const { model }: { model: ConversationModel } = this;

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
        currentConversationId: model.id,
        onClose: hideContactModal,
        openConversation: (conversationId: string) => {
          hideContactModal();
          this.openConversation(conversationId);
        },
        removeMember: (conversationId: string) => {
          hideContactModal();
          model.removeFromGroupV2(conversationId);
        },
        showSafetyNumber: (conversationId: string) => {
          hideContactModal();
          this.showSafetyNumber(conversationId);
        },
        toggleAdmin: (conversationId: string) => {
          hideContactModal();

          const isAdmin = model.isAdmin(conversationId);
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
            resolve: () => model.toggleAdmin(conversationId),
          });
        },
        updateSharedGroups: () => {
          const conversation = window.ConversationController.get(contactId);
          if (conversation && conversation.throttledUpdateSharedGroups) {
            conversation.throttledUpdateSharedGroups();
          }
        },
      }),
    });

    this.contactModalView.render();
  },

  showGroupLinkManagement() {
    const { model }: { model: ConversationModel } = this;

    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createGroupLinkManagement(
        window.reduxStore,
        {
          accessEnum: window.textsecure.protobuf.AccessControl.AccessRequired,
          changeHasGroupLink: this.changeHasGroupLink.bind(this),
          conversationId: model.id,
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
    const { model }: { model: ConversationModel } = this;

    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createGroupV2Permissions(
        window.reduxStore,
        {
          accessEnum: window.textsecure.protobuf.AccessControl.AccessRequired,
          conversationId: model.id,
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
    const { model }: { model: ConversationModel } = this;

    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createPendingInvites(window.reduxStore, {
        conversationId: model.id,
        ourConversationId: window.ConversationController.getOurConversationId(),
        approvePendingMembership: (conversationId: string) => {
          model.approvePendingMembershipFromGroupV2(conversationId);
        },
        revokePendingMemberships: conversationIds => {
          model.revokePendingMembershipsFromGroupV2(conversationIds);
        },
      }),
    });
    view.headerTitle = window.i18n('ConversationDetails--requests-and-invites');

    this.listenBack(view);
    view.render();
  },

  showChatColorEditor() {
    const { model }: { model: ConversationModel } = this;

    const view = new Whisper.ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createChatColorPicker(window.reduxStore, {
        conversationId: model.get('id'),
      }),
    });

    view.headerTitle = window.i18n('ChatColorPicker__menu-title');

    this.listenBack(view);
    view.render();
  },

  showConversationDetails() {
    const { model }: { model: ConversationModel } = this;

    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

    // these methods are used in more than one place and should probably be
    // dried up and hoisted to methods on ConversationView

    const onLeave = () => {
      this.longRunningTaskWrapper({
        name: 'onLeave',
        task: () => model.leaveGroupV2(),
      });
    };

    const onBlock = () => {
      this.syncMessageRequestResponse(
        'onBlock',
        model,
        messageRequestEnum.BLOCK
      );
    };

    const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

    const hasGroupLink = Boolean(
      model.get('groupInviteLinkPassword') &&
        model.get('accessControl')?.addFromInviteLink !==
          ACCESS_ENUM.UNSATISFIABLE
    );

    const props = {
      addMembers: model.addMembersV2.bind(model),
      conversationId: model.get('id'),
      hasGroupLink,
      loadRecentMediaItems: this.loadRecentMediaItems.bind(this),
      setDisappearingMessages: this.setDisappearingMessages.bind(this),
      showAllMedia: this.showAllMedia.bind(this),
      showContactModal: this.showContactModal.bind(this),
      showGroupChatColorEditor: this.showChatColorEditor.bind(this),
      showGroupLinkManagement: this.showGroupLinkManagement.bind(this),
      showGroupV2Permissions: this.showGroupV2Permissions.bind(this),
      showPendingInvites: this.showPendingInvites.bind(this),
      showLightboxForMedia: this.showLightboxForMedia.bind(this),
      updateGroupAttributes: model.updateGroupAttributesV2.bind(model),
      onLeave,
      onBlock,
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

  showMessageDetail(messageId: string) {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`showMessageDetail: Message ${messageId} missing!`);
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

  showContactDetail({
    contact,
    signalAccount,
  }: {
    contact: any;
    signalAccount: any;
  }) {
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

  async openConversation(conversationId: string) {
    window.Whisper.events.trigger('showConversation', conversationId);
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
    const { model }: { model: ConversationModel } = this;

    model.endSession();
  },

  async loadRecentMediaItems(limit: number): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    const messages: Array<MessageAttributesType> = await window.Signal.Data.getMessagesWithVisualMediaAttachments(
      model.id,
      {
        limit,
      }
    );

    const loadedRecentMediaItems = messages
      .filter(message => message.attachments !== undefined)
      .reduce(
        (acc, message) => [
          ...acc,
          ...(message.attachments || []).map(
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
      model.id,
      loadedRecentMediaItems
    );
  },

  async setDisappearingMessages(seconds: any) {
    const { model }: { model: ConversationModel } = this;

    const valueToSet = seconds > 0 ? seconds : null;

    await this.longRunningTaskWrapper({
      name: 'updateExpirationTimer',
      task: async () => model.updateExpirationTimer(valueToSet),
    });
  },

  async changeHasGroupLink(value: boolean) {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'toggleGroupLink',
      task: async () => model.toggleGroupLink(value),
    });
  },

  async copyGroupLink(groupLink: string) {
    await navigator.clipboard.writeText(groupLink);
    this.showToast(Whisper.GroupLinkCopiedToast);
  },

  async generateNewGroupLink() {
    const { model }: { model: ConversationModel } = this;

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('GroupLinkManagement--confirm-reset'),
      okText: window.i18n('GroupLinkManagement--reset'),
      resolve: async () => {
        await this.longRunningTaskWrapper({
          name: 'refreshGroupLink',
          task: async () => model.refreshGroupLink(),
        });
      },
    });
  },

  async setAccessControlAddFromInviteLinkSetting(value: boolean) {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'updateAccessControlAddFromInviteLink',
      task: async () => model.updateAccessControlAddFromInviteLink(value),
    });
  },

  async setAccessControlAttributesSetting(value: number) {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'updateAccessControlAttributes',
      task: async () => model.updateAccessControlAttributes(value),
    });
  },

  async setAccessControlMembersSetting(value: number) {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'updateAccessControlMembers',
      task: async () => model.updateAccessControlMembers(value),
    });
  },

  async destroyMessages() {
    const { model }: { model: ConversationModel } = this;

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('deleteConversationConfirmation'),
      okText: window.i18n('delete'),
      resolve: () => {
        this.longRunningTaskWrapper({
          name: 'destroymessages',
          task: async () => {
            model.trigger('unload', 'delete messages');
            await model.destroyMessages();
            model.updateLastMessage();
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

  showSendAnywayDialog(
    contacts: Array<ConversationModel>,
    confirmText?: string
  ) {
    return new Promise(resolve => {
      showSafetyNumberChangeDialog({
        confirmText,
        contacts,
        reject: () => {
          resolve(false);
        },
        resolve: () => {
          resolve(true);
        },
      });
    });
  },

  async sendReactionMessage(messageId: string, reaction: any) {
    const messageModel = messageId
      ? await getMessageById(messageId, {
          Message: Whisper.Message,
        })
      : undefined;

    try {
      if (!messageModel) {
        throw new Error('Message not found');
      }

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
    const { model }: { model: ConversationModel } = this;

    try {
      const contacts = await this.getUntrustedContacts(options);

      if (contacts && contacts.length) {
        const sendAnyway = await this.showSendAnywayDialog(contacts);
        if (sendAnyway) {
          this.sendStickerMessage({ ...options, force: true });
        }

        return;
      }

      if (this.showInvalidMessageToast()) {
        return;
      }

      const { packId, stickerId } = options;
      model.sendStickerMessage(packId, stickerId);
    } catch (error) {
      window.log.error(
        'clickSend error:',
        error && error.stack ? error.stack : error
      );
    }
  },

  async getUntrustedContacts(options: any = {}) {
    const { model }: { model: ConversationModel } = this;

    // This will go to the trust store for the latest identity key information,
    //   and may result in the display of a new banner for this conversation.
    await model.updateVerified();
    const unverifiedContacts = model.getUnverified();

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

    const untrustedContacts = model.getUntrusted();

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
    const { model }: { model: ConversationModel } = this;

    const message: MessageModel | undefined = messageId
      ? await getMessageById(messageId, {
          Message: Whisper.Message,
        })
      : undefined;

    if (message && !canReply(message.attributes, findAndFormatContact)) {
      return;
    }

    if (message && !message.isNormalBubble()) {
      return;
    }

    this.quote = null;
    this.quotedMessage = null;

    const existing = model.get('quotedMessageId');
    if (existing !== messageId) {
      this.model.set({
        quotedMessageId: messageId,
        draftChanged: true,
      });

      await this.saveModel();
    }

    if (message) {
      const quotedMessage = window.MessageController.register(
        message.id,
        message
      );
      this.quotedMessage = quotedMessage;

      if (quotedMessage) {
        this.quote = await model.makeQuote(this.quotedMessage);

        this.enableMessageField();
        this.focusMessageField();
      }
    }

    this.renderQuotedMessage();
  },

  renderQuotedMessage() {
    const { model }: { model: ConversationModel } = this;

    if (!this.quotedMessage) {
      window.reduxActions.composer.setQuotedMessage(undefined);
      return;
    }

    window.reduxActions.composer.setQuotedMessage({
      conversationId: model.id,
      quote: this.quote,
    });
  },

  showInvalidMessageToast(messageText?: string): boolean {
    const { model }: { model: ConversationModel } = this;

    let ToastView: undefined | typeof window.Whisper.ToastView;

    if (window.reduxStore.getState().expiration.hasExpired) {
      ToastView = Whisper.ExpiredToast;
    }
    if (!model.isValid()) {
      ToastView = Whisper.InvalidConversationToast;
    }
    if (
      isDirectConversation(this.model.attributes) &&
      (window.storage.blocked.isBlocked(this.model.get('e164')) ||
        window.storage.blocked.isUuidBlocked(this.model.get('uuid')))
    ) {
      ToastView = Whisper.BlockedToast;
    }
    if (
      !isDirectConversation(this.model.attributes) &&
      window.storage.blocked.isGroupBlocked(this.model.get('groupId'))
    ) {
      ToastView = Whisper.BlockedGroupToast;
    }

    if (!isDirectConversation(model.attributes) && model.get('left')) {
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
    const { model }: { model: ConversationModel } = this;

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

    model.clearTypingTimers();

    if (this.showInvalidMessageToast(message)) {
      this.enableMessageField();
      return;
    }

    try {
      if (!message.length && !this.hasFiles() && !this.voiceNoteAttachment) {
        return;
      }

      const attachments = await this.getFiles();
      const sendDelta = Date.now() - this.sendStart;
      window.log.info('Send pre-checks took', sendDelta, 'milliseconds');

      model.sendMessage(
        message,
        attachments,
        this.quote,
        this.getLinkPreview(),
        undefined, // sticker
        mentions,
        {
          sendHQImages:
            window.reduxStore &&
            window.reduxStore.getState().composer
              .shouldSendHighQualityAttachments,
        }
      );

      this.compositionApi.current.reset();
      model.setMarkedUnread(false);
      this.setQuoteMessage(null);
      this.resetLinkPreview();
      this.clearAttachments();
      window.reduxActions.composer.resetComposer();
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
    messageText: string,
    bodyRanges: Array<typeof window.Whisper.BodyRangeType>
  ) {
    const { model }: { model: ConversationModel } = this;

    const trimmed =
      messageText && messageText.length > 0 ? messageText.trim() : '';

    if (model.get('draft') && (!messageText || trimmed.length === 0)) {
      this.model.set({
        draft: null,
        draftChanged: true,
        draftBodyRanges: [],
      });
      await this.saveModel();

      return;
    }

    if (messageText !== model.get('draft')) {
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

    const links = LinkPreview.findLinks(message, caretLocation);
    const { currentlyMatchedLink } = this;
    if (links.includes(currentlyMatchedLink)) {
      return;
    }

    this.currentlyMatchedLink = null;
    this.excludedPreviewUrls = this.excludedPreviewUrls || [];

    const link = links.find(
      item =>
        LinkPreview.isLinkSafeToPreview(item) &&
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
    window.reduxActions.linkPreviews.removeLinkPreview();
    this.preview = null;
    this.currentlyMatchedLink = null;
    this.linkPreviewAbortController?.abort();
    this.linkPreviewAbortController = null;
    this.renderLinkPreview();
  },

  async getStickerPackPreview(
    url: string,
    abortSignal: Readonly<AbortSignal>
  ): Promise<null | LinkPreviewResult> {
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
    abortSignal: Readonly<AbortSignal>
  ): Promise<null | LinkPreviewResult> {
    const urlObject = maybeParseUrl(url);
    if (!urlObject) {
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
      Bytes.fromBase64(masterKey)
    );
    const id = Bytes.toBase64(fields.id);
    const logId = `groupv2(${id})`;
    const secretParams = Bytes.toBase64(fields.secretParams);

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
    let image: undefined | LinkPreviewImage;

    if (result.avatar) {
      try {
        const data = await window.Signal.Groups.decryptGroupAvatar(
          result.avatar,
          secretParams
        );
        image = {
          data,
          size: data.byteLength,
          contentType: IMAGE_JPEG,
          blurHash: await window.imageToBlurHash(
            new Blob([data], {
              type: IMAGE_JPEG,
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
    abortSignal: Readonly<AbortSignal>
  ): Promise<null | LinkPreviewResult> {
    if (LinkPreview.isStickerPack(url)) {
      return this.getStickerPackPreview(url, abortSignal);
    }
    if (LinkPreview.isGroupLink(url)) {
      return this.getGroupPreview(url, abortSignal);
    }

    // This is already checked elsewhere, but we want to be extra-careful.
    if (!LinkPreview.isLinkSafeToPreview(url)) {
      return null;
    }

    const linkPreviewMetadata = await window.textsecure.messaging.fetchLinkPreviewMetadata(
      url,
      abortSignal
    );
    if (!linkPreviewMetadata || abortSignal.aborted) {
      return null;
    }
    const { title, imageHref, description, date } = linkPreviewMetadata;

    let image;
    if (imageHref && LinkPreview.isLinkSafeToPreview(imageHref)) {
      let objectUrl: void | string;
      try {
        const fullSizeImage = await window.textsecure.messaging.fetchLinkPreviewImage(
          imageHref,
          abortSignal
        );
        if (abortSignal.aborted) {
          return null;
        }
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

    if (abortSignal.aborted) {
      return null;
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
    window.reduxActions.linkPreviews.removeLinkPreview();
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

      window.reduxActions.linkPreviews.addLinkPreview(result);
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
    if (this.forwardMessageModal) {
      return;
    }
    window.reduxActions.composer.setLinkPreviewResult(
      Boolean(this.currentlyMatchedLink),
      this.getLinkPreviewWithDomain()
    );
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

  getLinkPreviewWithDomain(): LinkPreviewWithDomain | undefined {
    if (!this.preview || !this.preview.length) {
      return undefined;
    }

    const [preview] = this.preview;
    return {
      ...preview,
      domain: LinkPreview.getDomain(preview.url),
    };
  },

  // Called whenever the user changes the message composition field. But only
  //   fires if there's content in the message field after the change.
  maybeBumpTyping(messageText: string) {
    if (messageText.length) {
      this.model.throttledBumpTyping();
    }
  },
});
