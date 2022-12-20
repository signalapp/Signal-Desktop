// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type * as Backbone from 'backbone';
import { render } from 'mustache';

import type { ConversationModel } from '../models/conversations';
import { getMessageById } from '../messages/getMessageById';
import { getContactId } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import type { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import { isGroup } from '../util/whatTypeOfConversation';
import { getActiveCallState } from '../state/selectors/calling';
import { ReactWrapperView } from './ReactWrapperView';
import * as log from '../logging/log';
import { createConversationView } from '../state/roots/createConversationView';
import { ToastConversationArchived } from '../components/ToastConversationArchived';
import { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';
import { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { showToast } from '../util/showToast';
import { UUIDKind } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
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

type BackbonePanelType = { panelType: PanelType; view: Backbone.View };

const { getMessagesBySentAt } = window.Signal.Data;

type MessageActionsType = {
  showMessageDetail: (messageId: string) => unknown;
  startConversation: (e164: string, uuid: UUIDStringType) => unknown;
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
    const showMessageDetail = (messageId: string) => {
      this.showMessageDetail(messageId);
    };

    return {
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
    if (panel.type === PanelType.MessageDetails) {
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
