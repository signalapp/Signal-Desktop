(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.AppView = Backbone.View.extend({
        initialize: function(options) {
          this.inboxView = null;
          this.installView = null;
        },
        events: {
            'openInstaller': 'openInstaller',
            'openInbox': 'openInbox',
        },
        openView: function(view) {
          this.el.innerHTML = "";
          this.el.append(view.el);
          this.delegateEvents();
        },
        openInstaller: function() {
          this.closeInstaller();
          this.installView = new Whisper.InstallView();
          if (Whisper.Registration.everDone()) {
              this.installView.selectStep(3);
              this.installView.hideDots();
          }
          this.openView(this.installView);
        },
        openStandalone: function() {
          if (window.config.environment !== 'production') {
            this.closeInstaller();
            this.installView = new Whisper.StandaloneRegistrationView();
            this.openView(this.installView);
          }
        },
        closeInstaller: function() {
          if (this.installView) {
            this.installView.remove();
            this.installView = null;
          }
        },
        openInbox: function(options) {
          options = options || {};
          _.defaults(options, {initialLoadComplete: false});

          console.log('open inbox');
          this.closeInstaller();

          if (!this.inboxView) {
            return ConversationController.loadPromise().then(function() {
                this.inboxView = new Whisper.InboxView({
                  model: self,
                  window: window,
                  initialLoadComplete: initialLoadComplete
                });
                this.openView(this.inboxView);
            }.bind(this));
          } else {
            if (!$.contains(this.$el, this.inboxView.$el)) {
                this.openView(this.inboxView);
            }
            window.focus(); // FIXME
            return Promise.resolve();
          }
        },
        onEmpty: function() {
          var view = this.inboxView;
          if (view) {
            view.onEmpty();
          }
        },
        onProgress: function(count) {
          var view = this.inboxView;
          if (view) {
            view.onProgress(count);
          }
        },
        openConversation: function(conversation) {
          if (conversation) {
            this.openInbox().then(function() {
              this.inboxView.openConversation(null, conversation);
            }.bind(this));
          }
        },
    });
})();
