// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type * as Backbone from 'backbone';
import type { ComponentProps } from 'react';
import * as React from 'react';
import { flatten } from 'lodash';
import { render } from 'mustache';

import type { AttachmentType } from '../types/Attachment';
import { isGIF } from '../types/Attachment';
import * as Stickers from '../types/Stickers';
import type { MIMEType } from '../types/MIME';
import type { ConversationModel } from '../models/conversations';
import type { MessageAttributesType } from '../model-types.d';
import type { MediaItemType, MediaItemMessageType } from '../types/MediaItem';
import { getMessageById } from '../messages/getMessageById';
import { getContactId } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import { enqueueReactionForSend } from '../reactions/enqueueReactionForSend';
import type { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import { isDirectConversation, isGroup } from '../util/whatTypeOfConversation';
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
import * as log from '../logging/log';
import type { EmbeddedContactType } from '../types/EmbeddedContact';
import { createConversationView } from '../state/roots/createConversationView';
import { ToastConversationArchived } from '../components/ToastConversationArchived';
import { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import { ToastDangerousFileType } from '../components/ToastDangerousFileType';
import { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';
import { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import { ToastReactionFailed } from '../components/ToastReactionFailed';
import { ToastTapToViewExpiredIncoming } from '../components/ToastTapToViewExpiredIncoming';
import { ToastTapToViewExpiredOutgoing } from '../components/ToastTapToViewExpiredOutgoing';
import { ToastUnableToLoadAttachment } from '../components/ToastUnableToLoadAttachment';
import { ToastCannotOpenGiftBadge } from '../components/ToastCannotOpenGiftBadge';
import { deleteDraftAttachment } from '../util/deleteDraftAttachment';
import { retryMessageSend } from '../util/retryMessageSend';
import { isNotNil } from '../util/isNotNil';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { showToast } from '../util/showToast';
import { UUIDKind } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
import { retryDeleteForEveryone } from '../util/retryDeleteForEveryone';
import { ContactDetail } from '../components/conversation/ContactDetail';
import { MediaGallery } from '../components/conversation/media-gallery/MediaGallery';
import type { ItemClickEvent } from '../components/conversation/media-gallery/types/ItemClickEvent';
import {
  removeLinkPreview,
  suspendLinkPreviews,
} from '../services/LinkPreview';
import { closeLightbox, showLightbox } from '../util/showLightbox';
import { saveAttachment } from '../util/saveAttachment';
import { SECOND } from '../util/durations';
import { startConversation } from '../util/startConversation';
import { longRunningTaskWrapper } from '../util/longRunningTaskWrapper';
import { hasDraftAttachments } from '../util/hasDraftAttachments';

type AttachmentOptions = {
  messageId: string;
  attachment: AttachmentType;
};

type PanelType = { view: Backbone.View; headerTitle?: string };

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

export class ConversationView extends window.Backbone.View<ConversationModel> {
  // Sub-views
  private contactModalView?: Backbone.View;
  private conversationView?: Backbone.View;
  private lightboxView?: ReactWrapperView;
  private stickerPreviewModalView?: Backbone.View;

  // Panel support
  private panels: Array<PanelType> = [];
  private previousFocus?: HTMLElement;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: Array<any>) {
    super(...args);

    // Events on Conversation model
    this.listenTo(this.model, 'destroy', this.stopListening);

    // These are triggered by InboxView
    this.listenTo(this.model, 'opened', this.onOpened);
    this.listenTo(this.model, 'scroll-to-message', this.scrollToMessage);
    this.listenTo(this.model, 'unload', (reason: string) =>
      this.unload(`model trigger - ${reason}`)
    );

    // These are triggered by background.ts for keyboard handling
    this.listenTo(this.model, 'open-all-media', this.showAllMedia);
    this.listenTo(this.model, 'escape-pressed', this.resetPanel);
    this.listenTo(this.model, 'show-message-details', this.showMessageDetail);
    this.listenTo(this.model, 'show-contact-modal', this.showContactModal);
    this.listenTo(
      this.model,
      'toggle-reply',
      (messageId: string | undefined) => {
        const composerState = window.reduxStore
          ? window.reduxStore.getState().composer
          : undefined;
        const quote = composerState?.quotedMessage?.quote;

        this.setQuoteMessage(quote ? undefined : messageId);
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

  setupConversationView(): void {
    // setupHeader
    const conversationHeaderProps = {
      id: this.model.id,

      onSearchInConversation: () => {
        const { searchInConversation } = window.reduxActions.search;
        searchInConversation(this.model.id);
      },
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
      removeMember: (conversationId: string) => {
        longRunningTaskWrapper({
          idForLogging: this.model.idForLogging(),
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
      onClickAddPack: () => this.showStickerManager(),
      onTextTooLong: () => showToast(ToastMessageBodyTooLong),
      getQuotedMessage: () => this.model.get('quotedMessageId'),
      clearQuotedMessage: () => this.setQuoteMessage(undefined),
      onCancelJoinRequest: async () => {
        await window.showConfirmationDialog({
          dialogName: 'GroupV2CancelRequestToJoin',
          message: window.i18n(
            'GroupV2--join--cancel-request-to-join--confirmation'
          ),
          okText: window.i18n('GroupV2--join--cancel-request-to-join--yes'),
          cancelText: window.i18n('GroupV2--join--cancel-request-to-join--no'),
          resolve: () => {
            longRunningTaskWrapper({
              idForLogging: this.model.idForLogging(),
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
    };

    // createConversationView root

    const JSX = createConversationView(window.reduxStore, {
      conversationId: this.model.id,
      compositionAreaProps,
      conversationHeaderProps,
      timelineProps,
    });

    this.conversationView = new ReactWrapperView({ JSX });
    this.$('.ConversationView__template').append(this.conversationView.el);
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

    return {
      deleteMessage,
      displayTapToViewMessage,
      downloadAttachment,
      downloadNewVersion,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
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

  async saveModel(): Promise<void> {
    window.Signal.Data.updateConversation(this.model.attributes);
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

    window.reduxActions.composer.setComposerFocus(this.model.id);

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

        // We want these message to be cached in memory for other operations like
        //   listening to 'expired' events when showing the lightbox, and so any other
        //   code working with this message has the latest updates.
        const model = window.MessageController.register(message.id, message);

        if (
          schemaVersion &&
          schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY
        ) {
          // Yep, we really do want to wait for each of these
          // eslint-disable-next-line no-await-in-loop
          rawMedia[i] = await upgradeMessageSchema(message);
          model.set(rawMedia[i]);

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
                      reason: 'conversation_view.showAllMedia',
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
      // eslint-disable-next-line react/jsx-no-useless-fragment
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
      dialogName: 'deleteMessage',
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

    const mediaMessage = selectedMediaItem.message;
    const message = window.MessageController.getById(mediaMessage.id);
    if (!message) {
      throw new Error(
        `showLightboxForMedia: Message ${mediaMessage.id} missing!`
      );
    }

    const close = () => {
      closeLightbox();
      this.stopListening(message, 'expired', closeLightbox);
    };

    showLightbox({
      close,
      i18n: window.i18n,
      getConversation: getConversationSelector(window.reduxStore.getState()),
      media,
      onForward: messageId => {
        this.showForwardMessageModal(messageId);
      },
      onSave,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
    });

    this.listenTo(message, 'expired', close);
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
              reason: 'conversation_view.showLightBox',
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

    // these methods are used in more than one place and should probably be
    // dried up and hoisted to methods on ConversationView

    const onLeave = () => {
      longRunningTaskWrapper({
        idForLogging: this.model.idForLogging(),
        name: 'onLeave',
        task: () => this.model.leaveGroupV2(),
      });
    };

    const props = {
      addMembers: this.model.addMembersV2.bind(this.model),
      conversationId: this.model.get('id'),
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
              startConversation(signalAccount.phoneNumber, signalAccount.uuid);
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

  async setQuoteMessage(messageId: string | undefined): Promise<void> {
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
      const quote = await model.makeQuote(message);
      window.reduxActions.composer.setQuotedMessage({
        conversationId: model.id,
        quote,
      });

      window.reduxActions.composer.setComposerFocus(this.model.id);
      window.reduxActions.composer.setComposerDisabledState(false);
    } else {
      window.reduxActions.composer.setQuotedMessage(undefined);
    }
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

  updateAttachmentsView(): void {
    const draftAttachments = this.model.get('draftAttachments') || [];
    window.reduxActions.composer.replaceAttachments(
      this.model.get('id'),
      draftAttachments
    );
    if (hasDraftAttachments(this.model.attributes, { includePending: true })) {
      removeLinkPreview();
    }
  }
}

window.Whisper.ConversationView = ConversationView;
