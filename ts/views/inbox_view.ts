// Copyright 2014-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Backbone from 'backbone';
import * as log from '../logging/log';
import type { ConversationModel } from '../models/conversations';
import { showToast } from '../util/showToast';
import { strictAssert } from '../util/assert';
import { ToastStickerPackInstallFailed } from '../components/ToastStickerPackInstallFailed';

window.Whisper = window.Whisper || {};
const { Whisper } = window;

class ConversationStack extends Backbone.View {
  public override className = 'conversation-stack';

  private conversationStack: Array<ConversationModel> = [];

  private getTopConversation(): undefined | ConversationModel {
    return this.conversationStack[this.conversationStack.length - 1];
  }

  public open(conversation: ConversationModel, messageId: string): void {
    const topConversation = this.getTopConversation();

    if (!topConversation || topConversation.id !== conversation.id) {
      const view = new Whisper.ConversationView({
        model: conversation,
      });
      this.listenTo(conversation, 'unload', () => this.onUnload(conversation));
      this.listenTo(conversation, 'showSafetyNumber', () =>
        view.showSafetyNumber()
      );
      view.$el.appendTo(this.el);

      if (topConversation) {
        topConversation.trigger('unload', 'opened another conversation');
      }

      this.conversationStack.push(conversation);

      conversation.trigger('opened', messageId);
    } else if (messageId) {
      conversation.trigger('scroll-to-message', messageId);
    }

    this.render();
  }

  public unload(): void {
    this.getTopConversation()?.trigger('unload', 'force unload requested');
  }

  private onUnload(conversation: ConversationModel) {
    this.stopListening(conversation);
    this.conversationStack = this.conversationStack.filter(
      (c: ConversationModel) => c !== conversation
    );

    this.render();
  }

  public override render(): ConversationStack {
    const isAnyConversationOpen = Boolean(this.conversationStack.length);
    this.$('.no-conversation-open').toggle(!isAnyConversationOpen);

    // Make sure poppers are positioned properly
    window.dispatchEvent(new Event('resize'));

    return this;
  }
}

const AppLoadingScreen = Whisper.View.extend({
  template: () => $('#app-loading-screen').html(),
  className: 'app-loading-screen',
  updateProgress(count: number) {
    if (count > 0) {
      const message = window.i18n('loadingMessages', [count.toString()]);
      this.$('.message').text(message);
    }
  },
  render_attributes: {
    message: window.i18n('loading'),
  },
});

Whisper.InboxView = Whisper.View.extend({
  template: () => $('#two-column').html(),
  className: 'Inbox',
  initialize(
    options: {
      initialLoadComplete?: boolean;
      window?: typeof window;
    } = {}
  ) {
    this.ready = false;
    this.render();

    this.conversation_stack = new ConversationStack({
      el: this.$('.conversation-stack'),
    });

    this.renderWhatsNew();

    Whisper.events.on('refreshConversation', ({ oldId, newId }) => {
      const convo = this.conversation_stack.lastConversation;
      if (convo && convo.get('id') === oldId) {
        this.conversation_stack.open(newId);
      }
    });

    // Close current opened conversation to reload the group information once
    // linked.
    Whisper.events.on('setupAsNewDevice', () => {
      this.conversation_stack.unload();
    });

    window.Whisper.events.on('showConversation', (id, messageId) => {
      const conversation = window.ConversationController.get(id);
      strictAssert(conversation, 'Conversation must be found');

      conversation.setMarkedUnread(false);

      const { openConversationExternal } = window.reduxActions.conversations;
      if (openConversationExternal) {
        openConversationExternal(conversation.id, messageId);
      }

      this.conversation_stack.open(conversation, messageId);
    });

    window.Whisper.events.on('loadingProgress', count => {
      const view = this.appLoadingScreen;
      if (view) {
        view.updateProgress(count);
      }
    });

    if (!options.initialLoadComplete) {
      this.appLoadingScreen = new AppLoadingScreen();
      this.appLoadingScreen.render();
      this.appLoadingScreen.$el.prependTo(this.el);
      this.startConnectionListener();
    } else {
      this.setupLeftPane();
    }

    Whisper.events.on('pack-install-failed', () => {
      showToast(ToastStickerPackInstallFailed);
    });
  },
  render_attributes: {
    welcomeToSignal: window.i18n('welcomeToSignal'),
    // TODO DESKTOP-1451: add back the selectAContact message
    selectAContact: '',
  },
  events: {
    click: 'onClick',
  },
  renderWhatsNew() {
    if (this.whatsNewLink) {
      return;
    }
    const { showWhatsNewModal } = window.reduxActions.globalModals;
    this.whatsNewLink = new Whisper.ReactWrapperView({
      Component: window.Signal.Components.WhatsNewLink,
      props: {
        i18n: window.i18n,
        showWhatsNewModal,
      },
    });
    this.$('.whats-new-placeholder').append(this.whatsNewLink.el);
  },
  setupLeftPane() {
    if (this.leftPaneView) {
      return;
    }
    this.leftPaneView = new Whisper.ReactWrapperView({
      className: 'left-pane-wrapper',
      JSX: window.Signal.State.Roots.createLeftPane(window.reduxStore),
    });

    this.$('.left-pane-placeholder').replaceWith(this.leftPaneView.el);
  },
  startConnectionListener() {
    this.interval = setInterval(() => {
      const status = window.getSocketStatus();
      switch (status) {
        case 'CONNECTING':
          break;
        case 'OPEN':
          clearInterval(this.interval);
          // if we've connected, we can wait for real empty event
          this.interval = null;
          break;
        case 'CLOSING':
        case 'CLOSED':
          clearInterval(this.interval);
          this.interval = null;
          // if we failed to connect, we pretend we got an empty event
          this.onEmpty();
          break;
        default:
          log.warn(
            `startConnectionListener: Found unexpected socket status ${status}; calling onEmpty() manually.`
          );
          this.onEmpty();
          break;
      }
    }, 1000);
  },
  onEmpty() {
    this.setupLeftPane();

    const view = this.appLoadingScreen;
    if (view) {
      this.appLoadingScreen = null;
      view.remove();

      const searchInput = document.querySelector(
        '.LeftPaneSearchInput__input'
      ) as HTMLElement;
      searchInput?.focus?.();
    }
  },
});
