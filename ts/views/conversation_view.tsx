// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type * as Backbone from 'backbone';
import type { ComponentProps } from 'react';
import * as React from 'react';
import { debounce, flatten, throttle } from 'lodash';
import { render } from 'mustache';

import type { AttachmentType } from '../types/Attachment';
import { isGIF } from '../types/Attachment';
import * as Stickers from '../types/Stickers';
import type { BodyRangeType, BodyRangesType } from '../types/Util';
import type { MIMEType } from '../types/MIME';
import type { ConversationModel } from '../models/conversations';
import type {
  GroupV2PendingMemberType,
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import type { MediaItemType, MediaItemMessageType } from '../types/MediaItem';
import type { MessageModel } from '../models/messages';
import { getMessageById } from '../messages/getMessageById';
import { getContactId } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import { enqueueReactionForSend } from '../reactions/enqueueReactionForSend';
import { addReportSpamJob } from '../jobs/helpers/addReportSpamJob';
import { reportSpamJobQueue } from '../jobs/reportSpamJobQueue';
import type { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import {
  isDirectConversation,
  isGroup,
  isGroupV1,
} from '../util/whatTypeOfConversation';
import { findAndFormatContact } from '../util/findAndFormatContact';
import { getPreferredBadgeSelector } from '../state/selectors/badges';
import {
  canReply,
  isIncoming,
  isOutgoing,
  isTapToView,
} from '../state/selectors/message';
import {
  getConversationSelector,
  getMessagesByConversation,
} from '../state/selectors/conversations';
import { getActiveCallState } from '../state/selectors/calling';
import { getTheme } from '../state/selectors/user';
import { ReactWrapperView } from './ReactWrapperView';
import type { Lightbox } from '../components/Lightbox';
import { ConversationDetailsMembershipList } from '../components/conversation/conversation-details/ConversationDetailsMembershipList';
import { showSafetyNumberChangeDialog } from '../shims/showSafetyNumberChangeDialog';
import * as log from '../logging/log';
import type { EmbeddedContactType } from '../types/EmbeddedContact';
import { createConversationView } from '../state/roots/createConversationView';
import { AttachmentToastType } from '../types/AttachmentToastType';
import type { CompositionAPIType } from '../components/CompositionArea';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SignalService as Proto } from '../protobuf';
import { ToastBlocked } from '../components/ToastBlocked';
import { ToastBlockedGroup } from '../components/ToastBlockedGroup';
import { ToastCannotMixImageAndNonImageAttachments } from '../components/ToastCannotMixImageAndNonImageAttachments';
import { ToastCannotStartGroupCall } from '../components/ToastCannotStartGroupCall';
import { ToastConversationArchived } from '../components/ToastConversationArchived';
import { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import { ToastDangerousFileType } from '../components/ToastDangerousFileType';
import { ToastDeleteForEveryoneFailed } from '../components/ToastDeleteForEveryoneFailed';
import { ToastExpired } from '../components/ToastExpired';
import { ToastFileSize } from '../components/ToastFileSize';
import { ToastInvalidConversation } from '../components/ToastInvalidConversation';
import { ToastLeftGroup } from '../components/ToastLeftGroup';
import { ToastMaxAttachments } from '../components/ToastMaxAttachments';
import { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';
import { ToastOneNonImageAtATime } from '../components/ToastOneNonImageAtATime';
import { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import { ToastPinnedConversationsFull } from '../components/ToastPinnedConversationsFull';
import { ToastReactionFailed } from '../components/ToastReactionFailed';
import { ToastReportedSpamAndBlocked } from '../components/ToastReportedSpamAndBlocked';
import { ToastTapToViewExpiredIncoming } from '../components/ToastTapToViewExpiredIncoming';
import { ToastTapToViewExpiredOutgoing } from '../components/ToastTapToViewExpiredOutgoing';
import { ToastUnableToLoadAttachment } from '../components/ToastUnableToLoadAttachment';
import { ToastCannotOpenGiftBadge } from '../components/ToastCannotOpenGiftBadge';
import { deleteDraftAttachment } from '../util/deleteDraftAttachment';
import { markAllAsApproved } from '../util/markAllAsApproved';
import { markAllAsVerifiedDefault } from '../util/markAllAsVerifiedDefault';
import { retryMessageSend } from '../util/retryMessageSend';
import { isNotNil } from '../util/isNotNil';
import { markViewed } from '../services/MessageUpdater';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { resolveAttachmentDraftData } from '../util/resolveAttachmentDraftData';
import { showToast } from '../util/showToast';
import { viewSyncJobQueue } from '../jobs/viewSyncJobQueue';
import { viewedReceiptsJobQueue } from '../jobs/viewedReceiptsJobQueue';
import { RecordingState } from '../state/ducks/audioRecorder';
import { UUIDKind } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
import { retryDeleteForEveryone } from '../util/retryDeleteForEveryone';
import { ContactDetail } from '../components/conversation/ContactDetail';
import { MediaGallery } from '../components/conversation/media-gallery/MediaGallery';
import type { ItemClickEvent } from '../components/conversation/media-gallery/types/ItemClickEvent';
import {
  getLinkPreviewForSend,
  hasLinkPreviewLoaded,
  maybeGrabLinkPreview,
  removeLinkPreview,
  resetLinkPreview,
  suspendLinkPreviews,
} from '../services/LinkPreview';
import { LinkPreviewSourceType } from '../types/LinkPreview';
import { closeLightbox, showLightbox } from '../util/showLightbox';
import { saveAttachment } from '../util/saveAttachment';
import { sendDeleteForEveryoneMessage } from '../util/sendDeleteForEveryoneMessage';
import { SECOND } from '../util/durations';

type AttachmentOptions = {
  messageId: string;
  attachment: AttachmentType;
};

type PanelType = { view: Backbone.View; headerTitle?: string };

const FIVE_MINUTES = 1000 * 60 * 5;

const { Message } = window.Signal.Types;

const {
  copyIntoTempDirectory,
  deleteTempFile,
  getAbsoluteAttachmentPath,
  getAbsoluteTempPath,
  upgradeMessageSchema,
} = window.Signal.Migrations;

const { getMessagesBySentAt } = window.Signal.Data;

type MessageActionsType = {
  deleteMessage: (messageId: string) => unknown;
  deleteMessageForEveryone: (messageId: string) => unknown;
  displayTapToViewMessage: (messageId: string) => unknown;
  downloadAttachment: (options: {
    attachment: AttachmentType;
    timestamp: number;
    isDangerous: boolean;
  }) => unknown;
  downloadNewVersion: () => unknown;
  kickOffAttachmentDownload: (
    options: Readonly<{ messageId: string }>
  ) => unknown;
  markAttachmentAsCorrupted: (options: AttachmentOptions) => unknown;
  markViewed: (messageId: string) => unknown;
  openConversation: (conversationId: string, messageId?: string) => unknown;
  openGiftBadge: (messageId: string) => unknown;
  openLink: (url: string) => unknown;
  reactToMessage: (
    messageId: string,
    reaction: { emoji: string; remove: boolean }
  ) => unknown;
  replyToMessage: (messageId: string) => unknown;
  retrySend: (messageId: string) => unknown;
  retryDeleteForEveryone: (messageId: string) => unknown;
  showContactDetail: (options: {
    contact: EmbeddedContactType;
    signalAccount?: {
      phoneNumber: string;
      uuid: UUIDStringType;
    };
  }) => unknown;
  showContactModal: (contactId: string) => unknown;
  showSafetyNumber: (contactId: string) => unknown;
  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
  showForwardMessageModal: (messageId: string) => unknown;
  showIdentity: (conversationId: string) => unknown;
  showMessageDetail: (messageId: string) => unknown;
  showVisualAttachment: (options: {
    attachment: AttachmentType;
    messageId: string;
    showSingle?: boolean;
  }) => unknown;
  startConversation: (e164: string, uuid: UUIDStringType) => unknown;
};

type MediaType = {
  path: string;
  objectURL: string;
  thumbnailObjectUrl?: string;
  contentType: MIMEType;
  index: number;
  attachment: AttachmentType;
  message: {
    attachments: Array<AttachmentType>;
    conversationId: string;
    id: string;
    received_at: number;
    received_at_ms: number;
    sent_at: number;
  };
};

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

export class ConversationView extends window.Backbone.View<ConversationModel> {
  private debouncedSaveDraft: (
    messageText: string,
    bodyRanges: Array<BodyRangeType>
  ) => Promise<void>;
  private lazyUpdateVerified: () => void;

  // Composing messages
  private compositionApi: {
    current: CompositionAPIType;
  } = { current: undefined };
  private sendStart?: number;

  // Quotes
  private quote?: QuotedMessageType;
  private quotedMessage?: MessageModel;

  // Sub-views
  private contactModalView?: Backbone.View;
  private conversationView?: Backbone.View;
  private lightboxView?: ReactWrapperView;
  private migrationDialog?: Backbone.View;
  private stickerPreviewModalView?: Backbone.View;

  // Panel support
  private panels: Array<PanelType> = [];
  private previousFocus?: HTMLElement;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: Array<any>) {
    super(...args);

    this.lazyUpdateVerified = debounce(
      this.model.updateVerified.bind(this.model),
      1000 // one second
    );
    this.model.throttledGetProfiles =
      this.model.throttledGetProfiles ||
      throttle(this.model.getProfiles.bind(this.model), FIVE_MINUTES);

    this.debouncedSaveDraft = debounce(this.saveDraft.bind(this), 200);

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
    this.listenTo(
      this.model,
      'save-attachment',
      this.downloadAttachmentWrapper
    );
    this.listenTo(this.model, 'delete-message', this.deleteMessage);
    this.listenTo(this.model, 'remove-link-review', removeLinkPreview);
    this.listenTo(
      this.model,
      'remove-all-draft-attachments',
      this.clearAttachments
    );

    this.render();

    this.setupConversationView();
    this.updateAttachmentsView();
  }

  override events(): Record<string, string> {
    return {
      drop: 'onDrop',
      paste: 'onPaste',
    };
  }

  // We need this ignore because the backbone types really want this to be a string
  //   property, but the property isn't set until after super() is run, meaning that this
  //   classname wouldn't be applied when Backbone creates our el.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  className(): string {
    return 'conversation';
  }

  // Same situation as className().
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  id(): string {
    return `conversation-${this.model.cid}`;
  }

  // Backbone.View<ConversationModel> is demanded as the return type here, and we can't
  //   satisfy it because of the above difference in signature: className is a function
  //   when it should be a plain string property.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  render(): ConversationView {
    const template = $('#conversation').html();
    this.$el.html(render(template, {}));
    return this;
  }

  setMuteExpiration(ms = 0): void {
    this.model.setMuteExpiration(
      ms >= Number.MAX_SAFE_INTEGER ? ms : Date.now() + ms
    );
  }

  setPin(value: boolean): void {
    if (value) {
      const pinnedConversationIds = window.storage.get(
        'pinnedConversationIds',
        new Array<string>()
      );

      if (pinnedConversationIds.length >= 4) {
        showToast(ToastPinnedConversationsFull);
        return;
      }
      this.model.pin();
    } else {
      this.model.unpin();
    }
  }

  setupConversationView(): void {
    // setupHeader
    const conversationHeaderProps = {
      id: this.model.id,

      onSetDisappearingMessages: (seconds: number) =>
        this.setDisappearingMessages(seconds),
      onDeleteMessages: () => this.destroyMessages(),
      onSearchInConversation: () => {
        const { searchInConversation } = window.reduxActions.search;
        searchInConversation(this.model.id);
      },
      onSetMuteNotifications: this.setMuteExpiration.bind(this),
      onSetPin: this.setPin.bind(this),
      // These are view only and don't update the Conversation model, so they
      //   need a manual update call.
      onOutgoingAudioCallInConversation:
        this.onOutgoingAudioCallInConversation.bind(this),
      onOutgoingVideoCallInConversation:
        this.onOutgoingVideoCallInConversation.bind(this),

      onShowConversationDetails: () => {
        this.showConversationDetails();
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
        this.model.setArchived(true);
        this.model.trigger('unload', 'archive');

        showToast(ToastConversationArchived, {
          undo: () => {
            this.model.setArchived(false);
            this.openConversation(this.model.get('id'));
          },
        });
      },
      onMarkUnread: () => {
        this.model.setMarkedUnread(true);

        showToast(ToastConversationMarkedUnread);
      },
      onMoveToInbox: () => {
        this.model.setArchived(false);

        showToast(ToastConversationUnarchived);
      },
    };
    window.reduxActions.conversations.setSelectedConversationHeaderTitle();

    // setupTimeline
    const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

    const contactSupport = () => {
      const baseUrl =
        'https://support.signal.org/hc/LOCALE/requests/new?desktop&chat_refreshed';
      const locale = window.getLocale();
      const supportLocale = window.Signal.Util.mapToSupportLocale(locale);
      const url = baseUrl.replace('LOCALE', supportLocale);

      openLinkInWebBrowser(url);
    };

    const learnMoreAboutDeliveryIssue = () => {
      openLinkInWebBrowser(
        'https://support.signal.org/hc/articles/4404859745690'
      );
    };

    const scrollToQuotedMessage = async (
      options: Readonly<{
        authorId: string;
        sentAt: number;
      }>
    ) => {
      const { authorId, sentAt } = options;

      const conversationId = this.model.id;
      const messages = await getMessagesBySentAt(sentAt);
      const message = messages.find(item =>
        Boolean(
          item.conversationId === conversationId &&
            authorId &&
            getContactId(item) === authorId
        )
      );

      if (!message) {
        showToast(ToastOriginalMessageNotFound);
        return;
      }

      this.scrollToMessage(message.id);
    };

    const markMessageRead = async (messageId: string) => {
      if (!window.SignalContext.activeWindowService.isActive()) {
        return;
      }

      const activeCall = getActiveCallState(window.reduxStore.getState());
      if (activeCall && !activeCall.pip) {
        return;
      }

      const message = await getMessageById(messageId);
      if (!message) {
        throw new Error(`markMessageRead: failed to load message ${messageId}`);
      }

      await this.model.markRead(message.get('received_at'), {
        newestSentAt: message.get('sent_at'),
        sendReadReceipts: true,
      });
    };

    const createMessageRequestResponseHandler =
      (name: string, enumValue: number): ((conversationId: string) => void) =>
      conversationId => {
        const conversation = window.ConversationController.get(conversationId);
        if (!conversation) {
          log.error(
            `createMessageRequestResponseHandler: Expected a conversation to be found in ${name}. Doing nothing`
          );
          return;
        }
        this.syncMessageRequestResponse(name, conversation, enumValue);
      };

    const timelineProps = {
      id: this.model.id,

      ...this.getMessageActions(),

      acknowledgeGroupMemberNameCollisions: (
        groupNameCollisions: Readonly<GroupNameCollisionsWithIdsByTitle>
      ): void => {
        this.model.acknowledgeGroupMemberNameCollisions(groupNameCollisions);
      },
      blockGroupLinkRequests: (uuid: UUIDStringType) => {
        this.model.blockGroupLinkRequests(uuid);
      },
      contactSupport,
      learnMoreAboutDeliveryIssue,
      loadNewerMessages: this.model.loadNewerMessages.bind(this.model),
      loadNewestMessages: this.model.loadNewestMessages.bind(this.model),
      loadOlderMessages: this.model.loadOlderMessages.bind(this.model),
      markMessageRead,
      onBlock: createMessageRequestResponseHandler(
        'onBlock',
        messageRequestEnum.BLOCK
      ),
      onBlockAndReportSpam: (conversationId: string) => {
        const conversation = window.ConversationController.get(conversationId);
        if (!conversation) {
          log.error(
            `onBlockAndReportSpam: Expected a conversation to be found for ${conversationId}. Doing nothing.`
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
      removeMember: (conversationId: string) => {
        this.longRunningTaskWrapper({
          name: 'removeMember',
          task: () => this.model.removeFromGroupV2(conversationId),
        });
      },
      scrollToQuotedMessage,
      unblurAvatar: () => {
        this.model.unblurAvatar();
      },
      updateSharedGroups: () => this.model.throttledUpdateSharedGroups?.(),
    };

    // setupCompositionArea
    window.reduxActions.composer.resetComposer();

    const compositionAreaProps = {
      id: this.model.id,
      compositionApi: this.compositionApi,
      onClickAddPack: () => this.showStickerManager(),
      onPickSticker: (packId: string, stickerId: number) =>
        this.sendStickerMessage({ packId, stickerId }),
      onEditorStateChange: (
        msg: string,
        bodyRanges: Array<BodyRangeType>,
        caretLocation?: number
      ) => this.onEditorStateChange(msg, bodyRanges, caretLocation),
      onTextTooLong: () => showToast(ToastMessageBodyTooLong),
      getQuotedMessage: () => this.model.get('quotedMessageId'),
      clearQuotedMessage: () => this.setQuoteMessage(null),
      onAccept: () => {
        this.syncMessageRequestResponse(
          'onAccept',
          this.model,
          messageRequestEnum.ACCEPT
        );
      },
      onBlock: () => {
        this.syncMessageRequestResponse(
          'onBlock',
          this.model,
          messageRequestEnum.BLOCK
        );
      },
      onUnblock: () => {
        this.syncMessageRequestResponse(
          'onUnblock',
          this.model,
          messageRequestEnum.ACCEPT
        );
      },
      onDelete: () => {
        this.syncMessageRequestResponse(
          'onDelete',
          this.model,
          messageRequestEnum.DELETE
        );
      },
      onBlockAndReportSpam: () => {
        this.blockAndReportSpam(this.model);
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

      onClearAttachments: this.clearAttachments.bind(this),
      onSelectMediaQuality: (isHQ: boolean) => {
        window.reduxActions.composer.setMediaQualitySetting(isHQ);
      },

      handleClickQuotedMessage: (id: string) => this.scrollToMessage(id),

      onCloseLinkPreview: () => {
        suspendLinkPreviews();
        removeLinkPreview();
      },

      openConversation: this.openConversation.bind(this),

      onSendMessage: ({
        draftAttachments,
        mentions = [],
        message = '',
        timestamp,
        voiceNoteAttachment,
      }: {
        draftAttachments?: ReadonlyArray<AttachmentType>;
        mentions?: BodyRangesType;
        message?: string;
        timestamp?: number;
        voiceNoteAttachment?: AttachmentType;
      }): void => {
        this.sendMessage(message, mentions, {
          draftAttachments,
          timestamp,
          voiceNoteAttachment,
        });
      },
    };

    // createConversationView root

    const JSX = createConversationView(window.reduxStore, {
      compositionAreaProps,
      conversationHeaderProps,
      timelineProps,
    });

    this.conversationView = new ReactWrapperView({ JSX });
    this.$('.ConversationView__template').append(this.conversationView.el);
  }

  async onOutgoingVideoCallInConversation(): Promise<void> {
    log.info('onOutgoingVideoCallInConversation: about to start a video call');

    if (this.model.get('announcementsOnly') && !this.model.areWeAdmin()) {
      showToast(ToastCannotStartGroupCall);
      return;
    }

    if (await this.isCallSafe()) {
      log.info(
        'onOutgoingVideoCallInConversation: call is deemed "safe". Making call'
      );
      window.reduxActions.calling.startCallingLobby({
        conversationId: this.model.id,
        isVideoCall: true,
      });
      log.info('onOutgoingVideoCallInConversation: started the call');
    } else {
      log.info(
        'onOutgoingVideoCallInConversation: call is deemed "unsafe". Stopping'
      );
    }
  }

  async onOutgoingAudioCallInConversation(): Promise<void> {
    log.info('onOutgoingAudioCallInConversation: about to start an audio call');

    if (await this.isCallSafe()) {
      log.info(
        'onOutgoingAudioCallInConversation: call is deemed "safe". Making call'
      );
      window.reduxActions.calling.startCallingLobby({
        conversationId: this.model.id,
        isVideoCall: false,
      });
      log.info('onOutgoingAudioCallInConversation: started the call');
    } else {
      log.info(
        'onOutgoingAudioCallInConversation: call is deemed "unsafe". Stopping'
      );
    }
  }

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
  }

  getMessageActions(): MessageActionsType {
    const reactToMessage = async (
      messageId: string,
      reaction: { emoji: string; remove: boolean }
    ) => {
      const { emoji, remove } = reaction;
      try {
        await enqueueReactionForSend({
          messageId,
          emoji,
          remove,
        });
      } catch (error) {
        log.error('Error sending reaction', error, messageId, reaction);
        showToast(ToastReactionFailed);
      }
    };
    const replyToMessage = (messageId: string) => {
      this.setQuoteMessage(messageId);
    };
    const retrySend = retryMessageSend;
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
    const openConversation = (conversationId: string, messageId?: string) => {
      this.openConversation(conversationId, messageId);
    };
    const showContactDetail = (options: {
      contact: EmbeddedContactType;
      signalAccount?: {
        phoneNumber: string;
        uuid: UUIDStringType;
      };
    }) => {
      this.showContactDetail(options);
    };
    const kickOffAttachmentDownload = async (
      options: Readonly<{ messageId: string }>
    ) => {
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
    const onMarkViewed = (messageId: string): void => {
      const message = window.MessageController.getById(messageId);
      if (!message) {
        throw new Error(`onMarkViewed: Message ${messageId} missing!`);
      }

      if (message.get('readStatus') === ReadStatus.Viewed) {
        return;
      }

      const senderE164 = message.get('source');
      const senderUuid = message.get('sourceUuid');
      const timestamp = message.get('sent_at');

      message.set(markViewed(message.attributes, Date.now()));

      if (isIncoming(message.attributes)) {
        viewedReceiptsJobQueue.add({
          viewedReceipt: {
            messageId,
            senderE164,
            senderUuid,
            timestamp,
          },
        });
      }

      viewSyncJobQueue.add({
        viewSyncs: [
          {
            messageId,
            senderE164,
            senderUuid,
            timestamp,
          },
        ],
      });
    };
    const showVisualAttachment = (options: {
      attachment: AttachmentType;
      messageId: string;
      showSingle?: boolean;
    }) => {
      this.showLightbox(options);
    };
    const downloadAttachment = (options: {
      attachment: AttachmentType;
      timestamp: number;
      isDangerous: boolean;
    }) => {
      this.downloadAttachment(options);
    };
    const displayTapToViewMessage = (messageId: string) =>
      this.displayTapToViewMessage(messageId);
    const showIdentity = (conversationId: string) => {
      this.showSafetyNumber(conversationId);
    };
    const openGiftBadge = (messageId: string): void => {
      const message = window.MessageController.getById(messageId);
      if (!message) {
        throw new Error(`openGiftBadge: Message ${messageId} missing!`);
      }

      showToast(ToastCannotOpenGiftBadge, {
        isIncoming: isIncoming(message.attributes),
      });
    };

    const openLink = openLinkInWebBrowser;
    const downloadNewVersion = () => {
      openLinkInWebBrowser('https://signal.org/download');
    };
    const showSafetyNumber = (contactId: string) => {
      this.showSafetyNumber(contactId);
    };
    const showExpiredIncomingTapToViewToast = () => {
      log.info('Showing expired tap-to-view toast for an incoming message');
      showToast(ToastTapToViewExpiredIncoming);
    };
    const showExpiredOutgoingTapToViewToast = () => {
      log.info('Showing expired tap-to-view toast for an outgoing message');
      showToast(ToastTapToViewExpiredOutgoing);
    };

    const showForwardMessageModal = this.showForwardMessageModal.bind(this);
    const startConversation = this.startConversation.bind(this);

    return {
      deleteMessage,
      deleteMessageForEveryone,
      displayTapToViewMessage,
      downloadAttachment,
      downloadNewVersion,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      markViewed: onMarkViewed,
      openConversation,
      openGiftBadge,
      openLink,
      reactToMessage,
      replyToMessage,
      retrySend,
      retryDeleteForEveryone,
      showContactDetail,
      showContactModal,
      showSafetyNumber,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showForwardMessageModal,
      showIdentity,
      showMessageDetail,
      showVisualAttachment,
      startConversation,
    };
  }

  async scrollToMessage(messageId: string): Promise<void> {
    const message = await getMessageById(messageId);
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
    const messagesByConversation =
      getMessagesByConversation(state)[this.model.id];
    if (!messagesByConversation?.messageIds.includes(messageId)) {
      isInMemory = false;
    }

    if (isInMemory) {
      const { scrollToMessage } = window.reduxActions.conversations;
      scrollToMessage(this.model.id, messageId);
      return;
    }

    this.model.loadAndScroll(messageId);
  }

  async startMigrationToGV2(): Promise<void> {
    const logId = this.model.idForLogging();

    if (!isGroupV1(this.model.attributes)) {
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
    const { droppedGV2MemberIds, pendingMembersV2 } =
      await this.longRunningTaskWrapper({
        name: 'getGroupMigrationMembers',
        task: () => window.Signal.Groups.getGroupMigrationMembers(this.model),
      });

    const invitedMemberIds = pendingMembersV2.map(
      (item: GroupV2PendingMemberType) => item.uuid
    );

    this.migrationDialog = new ReactWrapperView({
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
  }

  // TODO DESKTOP-2426
  async processAttachments(files: Array<File>): Promise<void> {
    const state = window.reduxStore.getState();

    const isRecording =
      state.audioRecorder.recordingState === RecordingState.Recording;

    if (hasLinkPreviewLoaded() || isRecording) {
      return;
    }

    const {
      addAttachment,
      addPendingAttachment,
      processAttachments,
      removeAttachment,
    } = window.reduxActions.composer;

    await processAttachments({
      addAttachment,
      addPendingAttachment,
      conversationId: this.model.id,
      draftAttachments: this.model.get('draftAttachments') || [],
      files,
      onShowToast: (toastType: AttachmentToastType) => {
        if (toastType === AttachmentToastType.ToastFileSize) {
          showToast(ToastFileSize, {
            limit: 100,
            units: 'MB',
          });
        } else if (toastType === AttachmentToastType.ToastDangerousFileType) {
          showToast(ToastDangerousFileType);
        } else if (toastType === AttachmentToastType.ToastMaxAttachments) {
          showToast(ToastMaxAttachments);
        } else if (toastType === AttachmentToastType.ToastOneNonImageAtATime) {
          showToast(ToastOneNonImageAtATime);
        } else if (
          toastType ===
          AttachmentToastType.ToastCannotMixImageAndNonImageAttachments
        ) {
          showToast(ToastCannotMixImageAndNonImageAttachments);
        } else if (
          toastType === AttachmentToastType.ToastUnableToLoadAttachment
        ) {
          showToast(ToastUnableToLoadAttachment);
        }
      },
      removeAttachment,
    });
  }

  unload(reason: string): void {
    log.info(
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
        const now = Date.now();
        const active_at = this.model.get('active_at') || now;

        this.model.set({
          active_at,
          draftChanged: false,
          draftTimestamp: now,
          timestamp: now,
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

    this.conversationView?.remove();

    if (this.contactModalView) {
      this.contactModalView.remove();
    }
    if (this.stickerPreviewModalView) {
      this.stickerPreviewModalView.remove();
    }
    if (this.lightboxView) {
      this.lightboxView.remove();
    }
    if (this.panels && this.panels.length) {
      for (let i = 0, max = this.panels.length; i < max; i += 1) {
        const panel = this.panels[i];
        panel.view.remove();
      }
      window.reduxActions.conversations.setSelectedConversationPanelDepth(0);
    }

    removeLinkPreview();
    suspendLinkPreviews();

    this.remove();
  }

  async onDrop(e: JQuery.TriggeredEvent): Promise<void> {
    if (!e.originalEvent) {
      return;
    }
    const event = e.originalEvent as DragEvent;
    if (!event.dataTransfer) {
      return;
    }

    if (event.dataTransfer.types[0] !== 'Files') {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const { files } = event.dataTransfer;
    this.processAttachments(Array.from(files));
  }

  onPaste(e: JQuery.TriggeredEvent): void {
    if (!e.originalEvent) {
      return;
    }
    const event = e.originalEvent as ClipboardEvent;
    if (!event.clipboardData) {
      return;
    }
    const { items } = event.clipboardData;

    const anyImages = [...items].some(
      item => item.type.split('/')[0] === 'image'
    );
    if (!anyImages) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const files: Array<File> = [];
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type.split('/')[0] === 'image') {
        const file = items[i].getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    this.processAttachments(files);
  }

  syncMessageRequestResponse(
    name: string,
    model: ConversationModel,
    messageRequestType: number
  ): Promise<void> {
    return this.longRunningTaskWrapper({
      name,
      task: model.syncMessageRequestResponse.bind(model, messageRequestType),
    });
  }

  blockAndReportSpam(model: ConversationModel): Promise<void> {
    const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

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
        showToast(ToastReportedSpamAndBlocked);
      },
    });
  }

  async saveModel(): Promise<void> {
    window.Signal.Data.updateConversation(this.model.attributes);
  }

  async clearAttachments(): Promise<void> {
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
        draftAttachments.map(attachment => deleteDraftAttachment(attachment))
      ),
    ]);
  }

  hasFiles(options: { includePending: boolean }): boolean {
    const draftAttachments = this.model.get('draftAttachments') || [];
    if (options.includePending) {
      return draftAttachments.length > 0;
    }

    return draftAttachments.some(item => !item.pending);
  }

  updateAttachmentsView(): void {
    const draftAttachments = this.model.get('draftAttachments') || [];
    window.reduxActions.composer.replaceAttachments(
      this.model.get('id'),
      draftAttachments
    );
    if (this.hasFiles({ includePending: true })) {
      removeLinkPreview();
    }
  }

  async onOpened(messageId: string): Promise<void> {
    this.model.onOpenStart();

    if (messageId) {
      const message = await getMessageById(messageId);

      if (message) {
        this.model.loadAndScroll(messageId);
        return;
      }

      log.warn(`onOpened: Did not find message ${messageId}`);
    }

    const { retryPlaceholders } = window.Signal.Services;
    if (retryPlaceholders) {
      await retryPlaceholders.findByConversationAndMarkOpened(this.model.id);
    }

    const loadAndUpdate = async () => {
      Promise.all([
        this.model.loadNewestMessages(undefined, undefined),
        this.model.updateLastMessage(),
        this.model.updateUnread(),
      ]);
    };

    loadAndUpdate();

    this.focusMessageField();

    const quotedMessageId = this.model.get('quotedMessageId');
    if (quotedMessageId) {
      this.setQuoteMessage(quotedMessageId);
    }

    this.model.fetchLatestGroupV2Data();
    strictAssert(
      this.model.throttledMaybeMigrateV1Group !== undefined,
      'Conversation model should be initialized'
    );
    this.model.throttledMaybeMigrateV1Group();
    strictAssert(
      this.model.throttledFetchSMSOnlyUUID !== undefined,
      'Conversation model should be initialized'
    );
    this.model.throttledFetchSMSOnlyUUID();

    const ourUuid = window.textsecure.storage.user.getUuid(UUIDKind.ACI);
    if (
      !isGroup(this.model.attributes) ||
      (ourUuid && this.model.hasMember(ourUuid))
    ) {
      strictAssert(
        this.model.throttledGetProfiles !== undefined,
        'Conversation model should be initialized'
      );
      await this.model.throttledGetProfiles();
    }

    this.model.updateVerified();
  }

  async showForwardMessageModal(messageId: string): Promise<void> {
    window.reduxActions.globalModals.toggleForwardMessageModal(messageId);
  }

  showAllMedia(): void {
    if (document.querySelectorAll('.module-media-gallery').length) {
      return;
    }

    // We fetch more documents than media as they don’t require to be loaded
    // into memory right away. Revisit this once we have infinite scrolling:
    const DEFAULT_MEDIA_FETCH_COUNT = 50;
    const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;

    const conversationId = this.model.get('id');
    const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();

    const getProps = async () => {
      const rawMedia =
        await window.Signal.Data.getMessagesWithVisualMediaAttachments(
          conversationId,
          {
            limit: DEFAULT_MEDIA_FETCH_COUNT,
          }
        );
      const rawDocuments =
        await window.Signal.Data.getMessagesWithFileAttachments(
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
          await window.Signal.Data.saveMessage(rawMedia[i], { ourUuid });
        }
      }

      const media: Array<MediaType> = flatten(
        rawMedia.map(message => {
          return (message.attachments || []).map(
            (
              attachment: AttachmentType,
              index: number
            ): MediaType | undefined => {
              if (
                !attachment.path ||
                !attachment.thumbnail ||
                attachment.pending ||
                attachment.error
              ) {
                return;
              }

              const { thumbnail } = attachment;
              return {
                path: attachment.path,
                objectURL: getAbsoluteAttachmentPath(attachment.path),
                thumbnailObjectUrl: thumbnail?.path
                  ? getAbsoluteAttachmentPath(thumbnail.path)
                  : undefined,
                contentType: attachment.contentType,
                index,
                attachment,
                message: {
                  attachments: message.attachments || [],
                  conversationId:
                    window.ConversationController.lookupOrCreate({
                      uuid: message.sourceUuid,
                      e164: message.source,
                    })?.id || message.conversationId,
                  id: message.id,
                  received_at: message.received_at,
                  received_at_ms: Number(message.received_at_ms),
                  sent_at: message.sent_at,
                },
              };
            }
          );
        })
      ).filter(isNotNil);

      // Unlike visual media, only one non-image attachment is supported
      const documents: Array<MediaItemType> = [];
      rawDocuments.forEach(message => {
        const attachments = message.attachments || [];
        const attachment = attachments[0];
        if (!attachment) {
          return;
        }

        documents.push({
          contentType: attachment.contentType,
          index: 0,
          attachment,
          // We do this cast because we know there attachments (see the checks above).
          message: message as MessageAttributesType & {
            attachments: Array<AttachmentType>;
          },
        });
      });

      const onItemClick = async ({
        message,
        attachment,
        type,
      }: ItemClickEvent) => {
        switch (type) {
          case 'documents': {
            saveAttachment(attachment, message.sent_at);
            break;
          }

          case 'media': {
            const selectedMedia =
              media.find(item => attachment.path === item.path) || media[0];
            this.showLightboxForMedia(selectedMedia, media);
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

    const view = new ReactWrapperView({
      className: 'panel',
      // We present an empty panel briefly, while we wait for props to load.
      JSX: <></>,
      onClose: () => {
        unsubscribe();
      },
    });
    const headerTitle = window.i18n('allMedia');

    const update = async () => {
      const props = await getProps();
      view.update(<MediaGallery i18n={window.i18n} {...props} />);
    };

    this.addPanel({ view, headerTitle });

    update();
  }

  focusMessageField(): void {
    if (this.panels && this.panels.length) {
      return;
    }

    this.compositionApi.current?.focusInput();
  }

  disableMessageField(): void {
    this.compositionApi.current?.setDisabled(true);
  }

  enableMessageField(): void {
    this.compositionApi.current?.setDisabled(false);
  }

  resetEmojiResults(): void {
    this.compositionApi.current?.resetEmojiResults();
  }

  showGV1Members(): void {
    const { contactCollection, id } = this.model;

    const memberships =
      contactCollection?.map((conversation: ConversationModel) => {
        return {
          isAdmin: false,
          member: conversation.format(),
        };
      }) || [];

    const reduxState = window.reduxStore.getState();
    const getPreferredBadge = getPreferredBadgeSelector(reduxState);
    const theme = getTheme(reduxState);

    const view = new ReactWrapperView({
      className: 'group-member-list panel',
      JSX: (
        <ConversationDetailsMembershipList
          canAddNewMembers={false}
          conversationId={id}
          i18n={window.i18n}
          getPreferredBadge={getPreferredBadge}
          maxShownMemberCount={32}
          memberships={memberships}
          showContactModal={contactId => {
            this.showContactModal(contactId);
          }}
          theme={theme}
        />
      ),
    });

    this.addPanel({ view });
    view.render();
  }

  showSafetyNumber(id?: string): void {
    let conversation: undefined | ConversationModel;

    if (!id && isDirectConversation(this.model.attributes)) {
      conversation = this.model;
    } else {
      conversation = window.ConversationController.get(id);
    }
    if (conversation) {
      window.reduxActions.globalModals.toggleSafetyNumberModal(
        conversation.get('id')
      );
    }
  }

  downloadAttachmentWrapper(
    messageId: string,
    providedAttachment?: AttachmentType
  ): void {
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

    const attachment =
      providedAttachment && attachments.includes(providedAttachment)
        ? providedAttachment
        : attachments[0];
    const { fileName } = attachment;

    const isDangerous = window.Signal.Util.isFileDangerous(fileName || '');

    this.downloadAttachment({ attachment, timestamp, isDangerous });
  }

  async downloadAttachment({
    attachment,
    timestamp,
    isDangerous,
  }: {
    attachment: AttachmentType;
    timestamp: number;
    isDangerous: boolean;
  }): Promise<void> {
    if (isDangerous) {
      showToast(ToastDangerousFileType);
      return;
    }

    return saveAttachment(attachment, timestamp);
  }

  async displayTapToViewMessage(messageId: string): Promise<void> {
    log.info('displayTapToViewMessage: attempting to display message');

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
    const { path: tempPath } = await copyIntoTempDirectory(absolutePath);
    const tempAttachment = {
      ...firstAttachment,
      path: tempPath,
    };

    await message.markViewOnceMessageViewed();

    const close = (): void => {
      try {
        this.stopListening(message);
        closeLightbox();
      } finally {
        deleteTempFile(tempPath);
      }
    };

    this.listenTo(message, 'expired', close);
    this.listenTo(message, 'change', () => {
      showLightbox(getProps());
    });

    const getProps = (): ComponentProps<typeof Lightbox> => {
      const { path, contentType } = tempAttachment;

      return {
        close,
        i18n: window.i18n,
        media: [
          {
            attachment: tempAttachment,
            objectURL: getAbsoluteTempPath(path),
            contentType,
            index: 0,
            message: {
              attachments: message.get('attachments') || [],
              id: message.get('id'),
              conversationId: message.get('conversationId'),
              received_at: message.get('received_at'),
              received_at_ms: Number(message.get('received_at_ms')),
              sent_at: message.get('sent_at'),
            },
          },
        ],
        isViewOnce: true,
      };
    };

    showLightbox(getProps());

    log.info('displayTapToViewMessage: showed lightbox');
  }

  deleteMessage(messageId: string): void {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`deleteMessage: Message ${messageId} missing!`);
    }

    window.showConfirmationDialog({
      confirmStyle: 'negative',
      message: window.i18n('deleteWarning'),
      okText: window.i18n('delete'),
      resolve: () => {
        window.Signal.Data.removeMessage(message.id);
        if (isOutgoing(message.attributes)) {
          this.model.decrementSentMessageCount();
        } else {
          this.model.decrementMessageCount();
        }
        this.resetPanel();
      },
    });
  }

  deleteMessageForEveryone(messageId: string): void {
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
          await sendDeleteForEveryoneMessage(this.model.attributes, {
            id: message.id,
            timestamp: message.get('sent_at'),
          });
        } catch (error) {
          log.error(
            'Error sending delete-for-everyone',
            error && error.stack,
            messageId
          );
          showToast(ToastDeleteForEveryoneFailed);
        }
        this.resetPanel();
      },
    });
  }

  showStickerPackPreview(packId: string, packKey: string): void {
    Stickers.downloadEphemeralPack(packId, packKey);

    const props = {
      packId,
      onClose: async () => {
        if (this.stickerPreviewModalView) {
          this.stickerPreviewModalView.remove();
          this.stickerPreviewModalView = undefined;
        }
        await Stickers.removeEphemeralPack(packId);
      },
    };

    this.stickerPreviewModalView = new ReactWrapperView({
      className: 'sticker-preview-modal-wrapper',
      JSX: window.Signal.State.Roots.createStickerPreviewModal(
        window.reduxStore,
        props
      ),
    });
  }

  showLightboxForMedia(
    selectedMediaItem: MediaItemType,
    media: Array<MediaItemType> = []
  ): void {
    const onSave = async ({
      attachment,
      message,
      index,
    }: {
      attachment: AttachmentType;
      message: MediaItemMessageType;
      index: number;
    }) => {
      return saveAttachment(attachment, message.sent_at, index + 1);
    };

    const selectedIndex = media.findIndex(
      mediaItem =>
        mediaItem.attachment.path === selectedMediaItem.attachment.path
    );

    showLightbox({
      close: closeLightbox,
      i18n: window.i18n,
      getConversation: getConversationSelector(window.reduxStore.getState()),
      media,
      onForward: messageId => {
        this.showForwardMessageModal(messageId);
      },
      onSave,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
    });
  }

  showLightbox({
    attachment,
    messageId,
  }: {
    attachment: AttachmentType;
    messageId: string;
    showSingle?: boolean;
  }): void {
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

    const { contentType } = attachment;

    if (
      !window.Signal.Util.GoogleChrome.isImageTypeSupported(contentType) &&
      !window.Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)
    ) {
      this.downloadAttachmentWrapper(messageId, attachment);
      return;
    }

    const attachments: Array<AttachmentType> = message.get('attachments') || [];

    const loop = isGIF(attachments);

    const media = attachments
      .filter(item => item.thumbnail && !item.pending && !item.error)
      .map((item, index) => ({
        objectURL: getAbsoluteAttachmentPath(item.path ?? ''),
        path: item.path,
        contentType: item.contentType,
        loop,
        index,
        message: {
          attachments: message.get('attachments') || [],
          id: message.get('id'),
          conversationId:
            window.ConversationController.lookupOrCreate({
              uuid: message.get('sourceUuid'),
              e164: message.get('source'),
            })?.id || message.get('conversationId'),
          received_at: message.get('received_at'),
          received_at_ms: Number(message.get('received_at_ms')),
          sent_at: message.get('sent_at'),
        },
        attachment: item,
        thumbnailObjectUrl:
          item.thumbnail?.objectUrl ||
          getAbsoluteAttachmentPath(item.thumbnail?.path ?? ''),
      }));

    if (!media.length) {
      log.error(
        'showLightbox: unable to load attachment',
        attachments.map(x => ({
          contentType: x.contentType,
          error: x.error,
          flags: x.flags,
          path: x.path,
          size: x.size,
        }))
      );
      showToast(ToastUnableToLoadAttachment);
      return;
    }

    const selectedMedia =
      media.find(item => attachment.path === item.path) || media[0];

    this.showLightboxForMedia(selectedMedia, media);
  }

  showContactModal(contactId: string): void {
    window.reduxActions.globalModals.showContactModal(contactId, this.model.id);
  }

  showGroupLinkManagement(): void {
    const view = new ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createGroupLinkManagement(
        window.reduxStore,
        {
          conversationId: this.model.id,
        }
      ),
    });
    const headerTitle = window.i18n('ConversationDetails--group-link');

    this.addPanel({ view, headerTitle });
    view.render();
  }

  showGroupV2Permissions(): void {
    const view = new ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createGroupV2Permissions(
        window.reduxStore,
        {
          conversationId: this.model.id,
          setAccessControlAttributesSetting:
            this.setAccessControlAttributesSetting.bind(this),
          setAccessControlMembersSetting:
            this.setAccessControlMembersSetting.bind(this),
          setAnnouncementsOnly: this.setAnnouncementsOnly.bind(this),
        }
      ),
    });
    const headerTitle = window.i18n('permissions');

    this.addPanel({ view, headerTitle });
    view.render();
  }

  showPendingInvites(): void {
    const view = new ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createPendingInvites(window.reduxStore, {
        conversationId: this.model.id,
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
        approvePendingMembership: (conversationId: string) => {
          this.model.approvePendingMembershipFromGroupV2(conversationId);
        },
        revokePendingMemberships: conversationIds => {
          this.model.revokePendingMembershipsFromGroupV2(conversationIds);
        },
      }),
    });
    const headerTitle = window.i18n(
      'ConversationDetails--requests-and-invites'
    );

    this.addPanel({ view, headerTitle });
    view.render();
  }

  showConversationNotificationsSettings(): void {
    const view = new ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createConversationNotificationsSettings(
        window.reduxStore,
        {
          conversationId: this.model.id,
          setDontNotifyForMentionsIfMuted:
            this.model.setDontNotifyForMentionsIfMuted.bind(this.model),
          setMuteExpiration: this.setMuteExpiration.bind(this),
        }
      ),
    });
    const headerTitle = window.i18n('ConversationDetails--notifications');

    this.addPanel({ view, headerTitle });
    view.render();
  }

  showChatColorEditor(): void {
    const view = new ReactWrapperView({
      className: 'panel',
      JSX: window.Signal.State.Roots.createChatColorPicker(window.reduxStore, {
        conversationId: this.model.get('id'),
      }),
    });
    const headerTitle = window.i18n('ChatColorPicker__menu-title');

    this.addPanel({ view, headerTitle });
    view.render();
  }

  showConversationDetails(): void {
    // Run a getProfiles in case member's capabilities have changed
    // Redux should cover us on the return here so no need to await this.
    if (this.model.throttledGetProfiles) {
      this.model.throttledGetProfiles();
    }

    const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

    // these methods are used in more than one place and should probably be
    // dried up and hoisted to methods on ConversationView

    const onLeave = () => {
      this.longRunningTaskWrapper({
        name: 'onLeave',
        task: () => this.model.leaveGroupV2(),
      });
    };

    const onBlock = () => {
      this.syncMessageRequestResponse(
        'onBlock',
        this.model,
        messageRequestEnum.BLOCK
      );
    };

    const props = {
      addMembers: this.model.addMembersV2.bind(this.model),
      conversationId: this.model.get('id'),
      loadRecentMediaItems: this.loadRecentMediaItems.bind(this),
      setDisappearingMessages: this.setDisappearingMessages.bind(this),
      showAllMedia: this.showAllMedia.bind(this),
      showContactModal: this.showContactModal.bind(this),
      showChatColorEditor: this.showChatColorEditor.bind(this),
      showGroupLinkManagement: this.showGroupLinkManagement.bind(this),
      showGroupV2Permissions: this.showGroupV2Permissions.bind(this),
      showConversationNotificationsSettings:
        this.showConversationNotificationsSettings.bind(this),
      showPendingInvites: this.showPendingInvites.bind(this),
      showLightboxForMedia: this.showLightboxForMedia.bind(this),
      updateGroupAttributes: this.model.updateGroupAttributesV2.bind(
        this.model
      ),
      onLeave,
      onBlock,
      onUnblock: () => {
        this.syncMessageRequestResponse(
          'onUnblock',
          this.model,
          messageRequestEnum.ACCEPT
        );
      },
      setMuteExpiration: this.setMuteExpiration.bind(this),
      onOutgoingAudioCallInConversation:
        this.onOutgoingAudioCallInConversation.bind(this),
      onOutgoingVideoCallInConversation:
        this.onOutgoingVideoCallInConversation.bind(this),
    };

    const view = new ReactWrapperView({
      className: 'conversation-details-pane panel',
      JSX: window.Signal.State.Roots.createConversationDetails(
        window.reduxStore,
        props
      ),
    });
    const headerTitle = '';

    this.addPanel({ view, headerTitle });
    view.render();
  }

  showMessageDetail(messageId: string): void {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`showMessageDetail: Message ${messageId} missing!`);
    }

    if (!message.isNormalBubble()) {
      return;
    }

    const getProps = () => ({
      ...message.getPropsForMessageDetail(
        window.ConversationController.getOurConversationIdOrThrow()
      ),
      ...this.getMessageActions(),
    });

    const onClose = () => {
      this.stopListening(message, 'change', update);
      this.resetPanel();
    };

    const view = new ReactWrapperView({
      className: 'panel message-detail-wrapper',
      JSX: window.Signal.State.Roots.createMessageDetail(
        window.reduxStore,
        getProps()
      ),
      onClose,
    });

    const update = () =>
      view.update(
        window.Signal.State.Roots.createMessageDetail(
          window.reduxStore,
          getProps()
        )
      );
    this.listenTo(message, 'change', update);
    this.listenTo(message, 'expired', onClose);
    // We could listen to all involved contacts, but we'll call that overkill

    this.addPanel({ view });
    view.render();
  }

  showStickerManager(): void {
    const view = new ReactWrapperView({
      className: ['sticker-manager-wrapper', 'panel'].join(' '),
      JSX: window.Signal.State.Roots.createStickerManager(window.reduxStore),
      onClose: () => {
        this.resetPanel();
      },
    });

    this.addPanel({ view });
    view.render();
  }

  showContactDetail({
    contact,
    signalAccount,
  }: {
    contact: EmbeddedContactType;
    signalAccount?: {
      phoneNumber: string;
      uuid: UUIDStringType;
    };
  }): void {
    const view = new ReactWrapperView({
      className: 'contact-detail-pane panel',
      JSX: (
        <ContactDetail
          i18n={window.i18n}
          contact={contact}
          hasSignalAccount={Boolean(signalAccount)}
          onSendMessage={() => {
            if (signalAccount) {
              this.startConversation(
                signalAccount.phoneNumber,
                signalAccount.uuid
              );
            }
          }}
        />
      ),
      onClose: () => {
        this.resetPanel();
      },
    });

    this.addPanel({ view });
  }

  startConversation(e164: string, uuid: UUIDStringType): void {
    const conversation = window.ConversationController.lookupOrCreate({
      e164,
      uuid,
    });
    strictAssert(
      conversation,
      `startConversation failed given ${e164}/${uuid} combination`
    );

    this.openConversation(conversation.id);
  }

  async openConversation(
    conversationId: string,
    messageId?: string
  ): Promise<void> {
    window.Whisper.events.trigger(
      'showConversation',
      conversationId,
      messageId
    );
  }

  addPanel(panel: PanelType): void {
    this.panels = this.panels || [];

    if (this.panels.length === 0) {
      this.previousFocus = document.activeElement as HTMLElement;
    }

    this.panels.unshift(panel);
    panel.view.$el.insertAfter(this.$('.panel').last());
    panel.view.$el.one('animationend', () => {
      panel.view.$el.addClass('panel--static');
    });

    window.reduxActions.conversations.setSelectedConversationPanelDepth(
      this.panels.length
    );
    window.reduxActions.conversations.setSelectedConversationHeaderTitle(
      panel.headerTitle
    );
  }
  resetPanel(): void {
    if (!this.panels || !this.panels.length) {
      return;
    }

    const panel = this.panels.shift();

    if (
      this.panels.length === 0 &&
      this.previousFocus &&
      this.previousFocus.focus
    ) {
      this.previousFocus.focus();
      this.previousFocus = undefined;
    }

    if (this.panels.length > 0) {
      this.panels[0].view.$el.fadeIn(250);
    }

    if (panel) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const removePanel = () => {
        if (!timeout) {
          return;
        }

        clearTimeout(timeout);
        timeout = undefined;

        panel.view.remove();

        if (this.panels.length === 0) {
          // Make sure poppers are positioned properly
          window.dispatchEvent(new Event('resize'));
        }
      };
      panel.view.$el
        .addClass('panel--remove')
        .one('transitionend', removePanel);

      // Backup, in case things go wrong with the transitionend event
      timeout = setTimeout(removePanel, SECOND);
    }

    window.reduxActions.conversations.setSelectedConversationPanelDepth(
      this.panels.length
    );
    window.reduxActions.conversations.setSelectedConversationHeaderTitle(
      this.panels[0]?.headerTitle
    );
  }

  async loadRecentMediaItems(limit: number): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    const messages: Array<MessageAttributesType> =
      await window.Signal.Data.getMessagesWithVisualMediaAttachments(model.id, {
        limit,
      });

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
                thumbnailObjectUrl: thumbnail?.path
                  ? getAbsoluteAttachmentPath(thumbnail.path)
                  : '',
                contentType: attachment.contentType,
                index,
                attachment,
                message: {
                  attachments: message.attachments || [],
                  conversationId:
                    window.ConversationController.get(message.sourceUuid)?.id ||
                    message.conversationId,
                  id: message.id,
                  received_at: message.received_at,
                  received_at_ms: Number(message.received_at_ms),
                  sent_at: message.sent_at,
                },
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
  }

  async setDisappearingMessages(seconds: number): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    const valueToSet = seconds > 0 ? seconds : undefined;

    await this.longRunningTaskWrapper({
      name: 'updateExpirationTimer',
      task: async () =>
        model.updateExpirationTimer(valueToSet, {
          reason: 'setDisappearingMessages',
        }),
    });
  }

  async setAccessControlAttributesSetting(value: number): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'updateAccessControlAttributes',
      task: async () => model.updateAccessControlAttributes(value),
    });
  }

  async setAccessControlMembersSetting(value: number): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'updateAccessControlMembers',
      task: async () => model.updateAccessControlMembers(value),
    });
  }

  async setAnnouncementsOnly(value: boolean): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    await this.longRunningTaskWrapper({
      name: 'updateAnnouncementsOnly',
      task: async () => model.updateAnnouncementsOnly(value),
    });
  }

  async destroyMessages(): Promise<void> {
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
        log.info('destroyMessages: User canceled delete');
      },
    });
  }

  async isCallSafe(): Promise<boolean> {
    const contacts = await this.getUntrustedContacts();
    if (contacts.length) {
      const callAnyway = await this.showSendAnywayDialog(
        contacts,
        window.i18n('callAnyway')
      );
      if (!callAnyway) {
        log.info(
          'Safety number change dialog not accepted, new call not allowed.'
        );
        return false;
      }
    }

    return true;
  }

  showSendAnywayDialog(
    contacts: Array<ConversationModel>,
    confirmText?: string
  ): Promise<boolean> {
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
  }

  async sendStickerMessage(options: {
    packId: string;
    stickerId: number;
    force?: boolean;
  }): Promise<void> {
    const { model }: { model: ConversationModel } = this;

    try {
      const contacts = await this.getUntrustedContacts(options);

      if (contacts.length) {
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
      log.error('clickSend error:', error && error.stack ? error.stack : error);
    }
  }

  async getUntrustedContacts(
    options: { force?: boolean } = {}
  ): Promise<Array<ConversationModel>> {
    const { model }: { model: ConversationModel } = this;

    // This will go to the trust store for the latest identity key information,
    //   and may result in the display of a new banner for this conversation.
    await model.updateVerified();
    const unverifiedContacts = model.getUnverified();

    if (options.force) {
      if (unverifiedContacts.length) {
        await markAllAsVerifiedDefault(unverifiedContacts);
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
        await markAllAsApproved(untrustedContacts);
      }
    } else if (untrustedContacts.length) {
      return untrustedContacts;
    }

    return [];
  }

  async setQuoteMessage(messageId: null | string): Promise<void> {
    const { model } = this;
    const message = messageId ? await getMessageById(messageId) : undefined;

    if (
      message &&
      !canReply(
        message.attributes,
        window.ConversationController.getOurConversationIdOrThrow(),
        findAndFormatContact
      )
    ) {
      return;
    }

    if (message && !message.isNormalBubble()) {
      return;
    }

    this.quote = undefined;
    this.quotedMessage = undefined;

    const existing = model.get('quotedMessageId');
    if (existing !== messageId) {
      const now = Date.now();
      let active_at = this.model.get('active_at');
      let timestamp = this.model.get('timestamp');

      if (!active_at && messageId) {
        active_at = now;
        timestamp = now;
      }

      this.model.set({
        active_at,
        draftChanged: true,
        quotedMessageId: messageId,
        timestamp,
      });

      await this.saveModel();
    }

    if (message) {
      this.quotedMessage = message;
      this.quote = await model.makeQuote(this.quotedMessage);

      this.enableMessageField();
      this.focusMessageField();
    }

    this.renderQuotedMessage();
  }

  renderQuotedMessage(): void {
    const { model }: { model: ConversationModel } = this;

    if (!this.quotedMessage) {
      window.reduxActions.composer.setQuotedMessage(undefined);
      return;
    }

    window.reduxActions.composer.setQuotedMessage({
      conversationId: model.id,
      quote: this.quote,
    });
  }

  showInvalidMessageToast(messageText?: string): boolean {
    const { model }: { model: ConversationModel } = this;

    let toastView:
      | undefined
      | typeof ToastBlocked
      | typeof ToastBlockedGroup
      | typeof ToastExpired
      | typeof ToastInvalidConversation
      | typeof ToastLeftGroup
      | typeof ToastMessageBodyTooLong;

    if (window.reduxStore.getState().expiration.hasExpired) {
      toastView = ToastExpired;
    }
    if (!model.isValid()) {
      toastView = ToastInvalidConversation;
    }

    const e164 = this.model.get('e164');
    const uuid = this.model.get('uuid');
    if (
      isDirectConversation(this.model.attributes) &&
      ((e164 && window.storage.blocked.isBlocked(e164)) ||
        (uuid && window.storage.blocked.isUuidBlocked(uuid)))
    ) {
      toastView = ToastBlocked;
    }

    const groupId = this.model.get('groupId');
    if (
      !isDirectConversation(this.model.attributes) &&
      groupId &&
      window.storage.blocked.isGroupBlocked(groupId)
    ) {
      toastView = ToastBlockedGroup;
    }

    if (!isDirectConversation(model.attributes) && model.get('left')) {
      toastView = ToastLeftGroup;
    }
    if (messageText && messageText.length > MAX_MESSAGE_BODY_LENGTH) {
      toastView = ToastMessageBodyTooLong;
    }

    if (toastView) {
      showToast(toastView);
      return true;
    }

    return false;
  }

  async sendMessage(
    message = '',
    mentions: BodyRangesType = [],
    options: {
      draftAttachments?: ReadonlyArray<AttachmentType>;
      force?: boolean;
      timestamp?: number;
      voiceNoteAttachment?: AttachmentType;
    } = {}
  ): Promise<void> {
    const { model }: { model: ConversationModel } = this;
    const timestamp = options.timestamp || Date.now();

    this.sendStart = Date.now();

    try {
      this.disableMessageField();
      const contacts = await this.getUntrustedContacts(options);

      if (contacts.length) {
        const sendAnyway = await this.showSendAnywayDialog(contacts);
        if (sendAnyway) {
          this.sendMessage(message, mentions, { force: true, timestamp });
          return;
        }

        this.enableMessageField();
        return;
      }
    } catch (error) {
      this.enableMessageField();
      log.error(
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
      if (
        !message.length &&
        !this.hasFiles({ includePending: false }) &&
        !options.voiceNoteAttachment
      ) {
        return;
      }

      let attachments: Array<AttachmentType> = [];
      if (options.voiceNoteAttachment) {
        attachments = [options.voiceNoteAttachment];
      } else if (options.draftAttachments) {
        attachments = (
          await Promise.all(
            options.draftAttachments.map(resolveAttachmentDraftData)
          )
        ).filter(isNotNil);
      }

      const sendHQImages =
        window.reduxStore &&
        window.reduxStore.getState().composer.shouldSendHighQualityAttachments;
      const sendDelta = Date.now() - this.sendStart;

      log.info('Send pre-checks took', sendDelta, 'milliseconds');

      await model.enqueueMessageForSend(
        {
          body: message,
          attachments,
          quote: this.quote,
          preview: getLinkPreviewForSend(message),
          mentions,
        },
        {
          sendHQImages,
          timestamp,
          extraReduxActions: () => {
            this.compositionApi.current?.reset();
            model.setMarkedUnread(false);
            this.setQuoteMessage(null);
            resetLinkPreview();
            this.clearAttachments();
            window.reduxActions.composer.resetComposer();
          },
        }
      );
    } catch (error) {
      log.error(
        'Error pulling attached files before send',
        error && error.stack ? error.stack : error
      );
    } finally {
      this.enableMessageField();
    }
  }

  onEditorStateChange(
    messageText: string,
    bodyRanges: Array<BodyRangeType>,
    caretLocation?: number
  ): void {
    this.maybeBumpTyping(messageText);
    this.debouncedSaveDraft(messageText, bodyRanges);

    // If we have attachments, don't add link preview
    if (!this.hasFiles({ includePending: true })) {
      maybeGrabLinkPreview(
        messageText,
        LinkPreviewSourceType.Composer,
        caretLocation
      );
    }
  }

  async saveDraft(
    messageText: string,
    bodyRanges: Array<BodyRangeType>
  ): Promise<void> {
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
      const now = Date.now();
      let active_at = this.model.get('active_at');
      let timestamp = this.model.get('timestamp');

      if (!active_at) {
        active_at = now;
        timestamp = now;
      }

      this.model.set({
        active_at,
        draft: messageText,
        draftBodyRanges: bodyRanges,
        draftChanged: true,
        timestamp,
      });
      await this.saveModel();
    }
  }

  // Called whenever the user changes the message composition field. But only
  //   fires if there's content in the message field after the change.
  maybeBumpTyping(messageText: string): void {
    if (messageText.length && this.model.throttledBumpTyping) {
      this.model.throttledBumpTyping();
    }
  }
}

window.Whisper.ConversationView = ConversationView;
