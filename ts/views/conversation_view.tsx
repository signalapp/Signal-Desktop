// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type * as Backbone from 'backbone';
import { render } from 'mustache';

import type { ConversationModel } from '../models/conversations';
import { getMessageById } from '../messages/getMessageById';
import { strictAssert } from '../util/assert';
import { isGroup } from '../util/whatTypeOfConversation';
import { ReactWrapperView } from './ReactWrapperView';
import * as log from '../logging/log';
import { createConversationView } from '../state/roots/createConversationView';
import {
  removeLinkPreview,
  suspendLinkPreviews,
} from '../services/LinkPreview';
import { SECOND } from '../util/durations';
import type { BackbonePanelRenderType, PanelRenderType } from '../types/Panels';
import { PanelType, isPanelHandledByReact } from '../types/Panels';
import { UUIDKind } from '../types/UUID';

type BackbonePanelType = { panelType: PanelType; view: Backbone.View };

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
    // setupCompositionArea
    window.reduxActions.composer.resetComposer();

    // createConversationView root
    const JSX = createConversationView(window.reduxStore, {
      conversationId: this.model.id,
    });

    this.conversationView = new ReactWrapperView({ JSX });
    this.$('.ConversationView__template').append(this.conversationView.el);
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

  getMessageDetail({
    messageId,
  }: {
    messageId: string;
  }): Backbone.View | undefined {
    const message = window.MessageController.getById(messageId);
    if (!message) {
      throw new Error(`getMessageDetail: Message ${messageId} missing!`);
    }

    if (!message.isNormalBubble()) {
      return;
    }

    const getProps = () => ({
      ...message.getPropsForMessageDetail(
        window.ConversationController.getOurConversationIdOrThrow()
      ),
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
