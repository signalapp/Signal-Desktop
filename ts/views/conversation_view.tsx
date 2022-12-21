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
import { UUIDKind } from '../types/UUID';

export class ConversationView extends window.Backbone.View<ConversationModel> {
  // Sub-views
  private conversationView?: Backbone.View;

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

      void this.model.updateLastMessage();
    }

    this.conversationView?.remove();

    removeLinkPreview();
    suspendLinkPreviews();

    this.remove();
  }

  async onOpened(messageId: string): Promise<void> {
    this.model.onOpenStart();

    if (messageId) {
      const message = await getMessageById(messageId);

      if (message) {
        void this.model.loadAndScroll(messageId);
        return;
      }

      log.warn(`onOpened: Did not find message ${messageId}`);
    }

    const { retryPlaceholders } = window.Signal.Services;
    if (retryPlaceholders) {
      await retryPlaceholders.findByConversationAndMarkOpened(this.model.id);
    }

    const loadAndUpdate = async () => {
      void Promise.all([
        this.model.loadNewestMessages(undefined, undefined),
        this.model.updateLastMessage(),
        this.model.updateUnread(),
      ]);
    };

    void loadAndUpdate();

    window.reduxActions.composer.setComposerFocus(this.model.id);

    const quotedMessageId = this.model.get('quotedMessageId');
    if (quotedMessageId) {
      window.reduxActions.composer.setQuoteByMessageId(
        this.model.id,
        quotedMessageId
      );
    }

    void this.model.fetchLatestGroupV2Data();
    strictAssert(
      this.model.throttledMaybeMigrateV1Group !== undefined,
      'Conversation model should be initialized'
    );
    void this.model.throttledMaybeMigrateV1Group();
    strictAssert(
      this.model.throttledFetchSMSOnlyUUID !== undefined,
      'Conversation model should be initialized'
    );
    void this.model.throttledFetchSMSOnlyUUID();

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

    void this.model.updateVerified();
  }
}

window.Whisper.ConversationView = ConversationView;
