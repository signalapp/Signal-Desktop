(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.AppView = Backbone.View.extend({
        initialize: function(options) {
          this.inboxView = null;
          this.installView = null;
          this.events = options.events;
          this.events.on('openConversation', this.openConversation, this);
          this.events.on('openInstaller', this.openInstaller, this);
          this.events.on('openInbox', this.openInbox, this);
        },
        openInstaller: function() {
          this.installView = new Whisper.InstallView();
          if (Whisper.Registration.everDone()) {
              this.installView.selectStep(3);
              this.installView.hideDots();
          }
          this.el.innerHTML = "";
          this.el.append(this.installView.el);
        },
        openInbox: function(options) {
          options = options || {};
          _.defaults(options, {initialLoadComplete: false});

          console.log('open inbox');
          if (this.installView) {
            this.installView.remove();
            this.installView = null;
          }

          if (!this.inboxView) {
            return ConversationController.loadPromise().then(function() {
                this.inboxView = new Whisper.InboxView({
                  model: self,
                  window: window,
                  initialLoadComplete: initialLoadComplete
                });
                this.el.innerHTML = "";
                this.el.append(this.inboxView.el);
            }.bind(this));
          } else {
            if (!$.contains(this.$el, this.inboxView.$el)) {
                this.el.innerHTML = "";
                this.el.append(this.inboxView.el);
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
              this.inboxView.openConversation(conversation);
            }.bind(this));
          }
        },
    });
})();
