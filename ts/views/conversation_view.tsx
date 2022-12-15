// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type * as Backbone from 'backbone';
import * as React from 'react';
import { flatten } from 'lodash';
import { render } from 'mustache';

import type { AttachmentType } from '../types/Attachment';
import type { MIMEType } from '../types/MIME';
import type { ConversationModel } from '../models/conversations';
import type { MessageAttributesType } from '../model-types.d';
import type { MediaItemType } from '../types/MediaItem';
import { getMessageById } from '../messages/getMessageById';
import { getContactId } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import { enqueueReactionForSend } from '../reactions/enqueueReactionForSend';
import type { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import { isGroup } from '../util/whatTypeOfConversation';
import { isIncoming } from '../state/selectors/message';
import { getActiveCallState } from '../state/selectors/calling';
import { ReactWrapperView } from './ReactWrapperView';
import * as log from '../logging/log';
import { createConversationView } from '../state/roots/createConversationView';
import { ToastConversationArchived } from '../components/ToastConversationArchived';
import { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';
import { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import { ToastReactionFailed } from '../components/ToastReactionFailed';
import { ToastTapToViewExpiredIncoming } from '../components/ToastTapToViewExpiredIncoming';
import { ToastTapToViewExpiredOutgoing } from '../components/ToastTapToViewExpiredOutgoing';
import { ToastCannotOpenGiftBadge } from '../components/ToastCannotOpenGiftBadge';
import { retryMessageSend } from '../util/retryMessageSend';
import { isNotNil } from '../util/isNotNil';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { showToast } from '../util/showToast';
import { UUIDKind } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
import { retryDeleteForEveryone } from '../util/retryDeleteForEveryone';
import { MediaGallery } from '../components/conversation/media-gallery/MediaGallery';
import type { ItemClickEvent } from '../components/conversation/media-gallery/types/ItemClickEvent';
import {
  removeLinkPreview,
  suspendLinkPreviews,
} from '../services/LinkPreview';
import { SECOND } from '../util/durations';
import { startConversation } from '../util/startConversation';
import { longRunningTaskWrapper } from '../util/longRunningTaskWrapper';
import { clearConversationDraftAttachments } from '../util/clearConversationDraftAttachments';
import type { BackbonePanelRenderType, PanelRenderType } from '../types/Panels';
import { PanelType, isPanelHandledByReact } from '../types/Panels';

type AttachmentOptions = {
  messageId: string;
  attachment: AttachmentType;
};

const { Message } = window.Signal.Types;

type BackbonePanelType = { panelType: PanelType; view: Backbone.View };

const { getAbsoluteAttachmentPath, upgradeMessageSchema } =
  window.Signal.Migrations;

const { getMessagesBySentAt } = window.Signal.Data;

type MessageActionsType = {
  downloadNewVersion: () => unknown;
  kickOffAttachmentDownload: (
    options: Readonly<{ messageId: string }>
  ) => unknown;
  markAttachmentAsCorrupted: (options: AttachmentOptions) => unknown;
  openGiftBadge: (messageId: string) => unknown;
  openLink: (url: string) => unknown;
  reactToMessage: (
    messageId: string,
    reaction: { emoji: string; remove: boolean }
  ) => unknown;
  retrySend: (messageId: string) => unknown;
  retryDeleteForEveryone: (messageId: string) => unknown;
  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
  showMessageDetail: (messageId: string) => unknown;
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
  private panels: Array<BackbonePanelType> = [];
  private previousFocus?: HTMLElement;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: Array<any>) {
    super(...args);

    // Events on Conversation model
    this.listenTo(this.model, 'destroy', this.stopListening);

    // These are triggered by InboxView
    this.listenTo(this.model, 'opened', this.onOpened);
    this.listenTo(this.model, 'unload', (reason: string) =>
      this.unload(`model trigger - ${reason}`)
    );

    // These are triggered by background.ts for keyboard handling
    this.listenTo(this.model, 'open-all-media', this.showAllMedia);
    this.listenTo(this.model, 'escape-pressed', () => {
      window.reduxActions.conversations.popPanelForConversation(this.model.id);
    });
    this.listenTo(this.model, 'show-message-details', this.showMessageDetail);

    this.listenTo(this.model, 'pushPanel', this.pushPanel);
    this.listenTo(this.model, 'popPanel', this.popPanel);

    this.render();

    this.setupConversationView();

    window.reduxActions.composer.replaceAttachments(
      this.model.get('id'),
      this.model.get('draftAttachments') || []
    );
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
      onGoBack: () => {
        window.reduxActions.conversations.popPanelForConversation(
          this.model.id
        );
      },

      onArchive: () => {
        this.model.setArchived(true);
        this.model.trigger('unload', 'archive');

        showToast(ToastConversationArchived, {
          undo: () => {
            this.model.setArchived(false);
            window.reduxActions.conversations.showConversation({
              conversationId: this.model.id,
            });
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

      window.reduxActions.conversations.scrollToMessage(
        conversationId,
        message.id
      );
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
      onTextTooLong: () => showToast(ToastMessageBodyTooLong),
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

      onClearAttachments: () =>
        clearConversationDraftAttachments(
          this.model.id,
          this.model.get('draftAttachments')
        ),
      onSelectMediaQuality: (isHQ: boolean) => {
        window.reduxActions.composer.setMediaQualitySetting(isHQ);
      },

      onCloseLinkPreview: () => {
        suspendLinkPreviews();
        removeLinkPreview();
      },
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
    const retrySend = retryMessageSend;
    const showMessageDetail = (messageId: string) => {
      this.showMessageDetail(messageId);
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
    const showExpiredIncomingTapToViewToast = () => {
      log.info('Showing expired tap-to-view toast for an incoming message');
      showToast(ToastTapToViewExpiredIncoming);
    };
    const showExpiredOutgoingTapToViewToast = () => {
      log.info('Showing expired tap-to-view toast for an outgoing message');
      showToast(ToastTapToViewExpiredOutgoing);
    };

    return {
      downloadNewVersion,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      openGiftBadge,
      openLink,
      reactToMessage,
      retrySend,
      retryDeleteForEveryone,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showMessageDetail,
      startConversation,
    };
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

      window.Signal.Data.updateConversation(this.model.attributes);

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
    }

    removeLinkPreview();
    suspendLinkPreviews();

    this.remove();
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
      window.reduxActions.composer.setQuoteByMessageId(
        this.model.id,
        quotedMessageId
      );
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

  showAllMedia(): void {
    window.reduxActions.conversations.pushPanelForConversation(this.model.id, {
      type: PanelType.AllMedia,
    });
  }

  getAllMedia(): Backbone.View | undefined {
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
            window.reduxActions.conversations.saveAttachment(
              attachment,
              message.sent_at
            );
            break;
          }

          case 'media': {
            window.reduxActions.lightbox.showLightboxWithMedia(
              attachment.path,
              media
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

    const update = async () => {
      const props = await getProps();
      view.update(<MediaGallery i18n={window.i18n} {...props} />);
    };

    update();

    return view;
  }

  showConversationDetails(): void {
    window.reduxActions.conversations.pushPanelForConversation(this.model.id, {
      type: PanelType.ConversationDetails,
    });
  }

  getConversationDetails(): Backbone.View {
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

    view.render();

    return view;
  }

  showMessageDetail(messageId: string): void {
    window.reduxActions.conversations.pushPanelForConversation(this.model.id, {
      type: PanelType.MessageDetails,
      args: { messageId },
    });
  }

  getMessageDetail({
    messageId,
  }: {
    messageId: string;
  }): Backbone.View | undefined {
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
      window.reduxActions.conversations.popPanelForConversation(this.model.id);
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

    view.render();

    return view;
  }

  pushPanel(panel: PanelRenderType): void {
    if (isPanelHandledByReact(panel)) {
      return;
    }

    this.panels = this.panels || [];

    if (this.panels.length === 0) {
      this.previousFocus = document.activeElement as HTMLElement;
    }

    const { type } = panel as BackbonePanelRenderType;

    let view: Backbone.View | undefined;
    if (type === PanelType.AllMedia) {
      view = this.getAllMedia();
    } else if (type === PanelType.ConversationDetails) {
      view = this.getConversationDetails();
    } else if (panel.type === PanelType.MessageDetails) {
      view = this.getMessageDetail(panel.args);
    }

    if (!view) {
      return;
    }

    this.panels.push({
      panelType: type,
      view,
    });

    view.$el.insertAfter(this.$('.panel').last());
    view.$el.one('animationend', () => {
      if (view) {
        view.$el.addClass('panel--static');
      }
    });
  }

  popPanel(poppedPanel: PanelRenderType): void {
    if (!this.panels || !this.panels.length) {
      return;
    }

    if (
      this.panels.length === 0 &&
      this.previousFocus &&
      this.previousFocus.focus
    ) {
      this.previousFocus.focus();
      this.previousFocus = undefined;
    }

    const panel = this.panels[this.panels.length - 1];

    if (!panel) {
      return;
    }

    if (isPanelHandledByReact(poppedPanel)) {
      return;
    }

    this.panels.pop();

    if (panel.panelType !== poppedPanel.type) {
      log.warn('popPanel: last panel was not of same type');
      return;
    }

    if (this.panels.length > 0) {
      this.panels[this.panels.length - 1].view.$el.fadeIn(250);
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const removePanel = () => {
      if (!timeout) {
        return;
      }

      clearTimeout(timeout);
      timeout = undefined;

      panel.view.remove();
    };
    panel.view.$el.addClass('panel--remove').one('transitionend', removePanel);

    // Backup, in case things go wrong with the transitionend event
    timeout = setTimeout(removePanel, SECOND);
  }
}

window.Whisper.ConversationView = ConversationView;
