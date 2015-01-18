var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.GroupRecipientsInputView = Backbone.View.extend({
    initialize: function() {
      this.$el.tagsinput({ tagClass: this.tagClass });
    },

    tagClass: function(item) {
      try {
        if (libphonenumber.util.verifyNumber(item)) {
          return;
        }
      } catch(ex) {}
      return 'error';
    }
  });

  Whisper.NewGroupView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.template = $('#new-group-form').html();
      Mustache.parse(this.template);
      this.$el.html($(Mustache.render(this.template)));
      this.input = this.$el.find('input.number');
      new Whisper.GroupRecipientsInputView({el: this.$el.find('input.numbers')}).$el.appendTo(this.$el);
      this.fileInput = new Whisper.FileInputView({el: this.$el.find('.attachments')});
      this.avatarInput = new Whisper.FileInputView({el: this.$el.find('.group-avatar')});
    },

    events: {
      'submit .send': 'send',
      'close': 'remove'
    },

    send: function(e) {
      e.preventDefault();
      var numbers = this.$el.find('input.numbers').val().split(',');
      var name = this.$el.find('input.name').val();
      var message_input = this.$el.find('input.send-message');
      var message = message_input.val();
      var view = this;
      if (message.length > 0 || this.fileInput.hasFiles()) {
        this.avatarInput.getFiles().then(function(avatar_files) {
          view.collection.createGroup(numbers, name, avatar_files[0]).then(function(convo){
            view.fileInput.getFiles().then(function(attachments) {
                convo.sendMessage(view.$el.find('input.send-message').val());
            });
            convo.trigger('open');
          });
        });
      }
      this.remove();
    }
  });

})();
