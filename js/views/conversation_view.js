var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.stopListening); // auto update
      this.template = $('#conversation').html();
      Mustache.parse(this.template);
      this.$el.html(Mustache.render(this.template));

      this.view = new Whisper.MessageListView({collection: this.model.messages()});
      this.listenTo(this.model.messages(), 'add', this.scrollToBottom);

      this.fileInput = new Whisper.FileInputView({el: this.$el.find('.attachments')});

      this.model.messages().fetch({reset: true});
      this.$el.find('.discussion-container').append(this.view.el);
      window.addEventListener('storage', (function(){
        this.model.messages().fetch();
      }).bind(this));
    },
    events: {
      'submit .send': 'sendMessage',
      'close': 'remove'
    },

    sendMessage: function(e) {
      e.preventDefault();
      var input = this.$el.find('.send input');
      var message = input.val();
      var thread = this.model;

      if (message.length > 0 || this.fileInput.hasFiles()) {
        this.fileInput.getFiles().then(function(attachments) {
          thread.sendMessage(message, attachments);
        });
        input.val("");
      }
    },

    scrollToBottom: function() {
        this.view.$el.scrollTop(this.view.el.scrollHeight);
    },

    render: function() {
      Whisper.Layout.setContent(this.$el.show());
      this.scrollToBottom();
      return this;
    }
  });
})();
