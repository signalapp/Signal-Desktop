/*
  global
  ConversationController,
  extension,
  ConversationController
  getInboxCollection,
  i18n,
  Whisper,
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.InboxViewWhisper = Whisper.View.extend({
    templateName: 'two-column',
    className: 'inbox index',
    initialize(options = {}) {
      this.ready = false;
      this.render();
      this.$el.attr('tabindex', '1');
      // ConversationCollection

      extension.expired(expired => {
        if (expired) {
          const banner = new Whisper.ExpiredAlertBanner().render();
          banner.$el.prependTo(this.$el);
          this.$el.addClass('expired');
        }
      });

      this.openSettings = this.openSettings.bind(this);
      this.openSessionConversation = this.openSessionConversation.bind(this);
      // FIXME: Fix this for new react views
      this.setupLeftPane();
    },

    onEmpty() {
      const view = this.appLoadingScreen;
      if (view) {
        this.appLoadingScreen = null;
        view.remove();
      }
    },
    async openConversation(id, messageId) {
      // If we call this to create a new conversation, it can only be private
      // (group conversations are created elsewhere)
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );

      if (this.openConversationAction) {
        this.openConversationAction(id, messageId);
      }

      if (conversation) {
        conversation.updateProfileName();
      }

      this.open(conversation);
    },
  });

  Whisper.ExpiredAlertBanner = Whisper.View.extend({
    templateName: 'expired_alert',
    className: 'expiredAlert',
    render_attributes() {
      return {
        expiredWarning: i18n('expiredWarning'),
        upgrade: i18n('upgrade'),
      };
    },
  });
})();
