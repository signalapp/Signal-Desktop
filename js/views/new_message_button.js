var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.GroupRecipientsInputView = Backbone.View.extend({
    initialize: function() {
      this.$el.tagsinput({ tagClass: this.tagClass });
    },

    tagClass: function(item) {
      try {
        if (textsecure.utils.verifyNumber(item)) {
          return;
        }
      } catch(ex) {}
      return 'error';
    }
  });

  Whisper.NewGroupView = Backbone.View.extend({
    initialize: function() {
      this.template = $('#new-group-form').html();
      Mustache.parse(this.template);
      this.render();
      new Whisper.GroupRecipientsInputView({el: this.$el.find('input.numbers')}).$el.appendTo(this.$el);
    },
    events: {
      'submit .send': 'send'
    },

    send: function(e) {
      var numbers = this.$el.find('input.numbers').val().split(',');
      var name = this.$el.find('input.name').val();
      var thread = Whisper.Threads.createGroup(numbers, name);
      thread.sendMessage(input.val());
      // close this, select the new thread
    },

    render: function() {
      this.$el.prepend($(Mustache.render(this.template)));
      return this;
    }
  });

  Whisper.MessageRecipientInputView = Backbone.View.extend({
    events: {
      'change': 'verifyNumber',
      'focus' : 'removeError'
    },

    removeError: function() {
      this.$el.removeClass('error');
    },

    verifyNumber: function(item) {
      try {
        if (textsecure.utils.verifyNumber(this.$el.val())) {
          this.removeError();
          return;
        }
      } catch(ex) { console.log(ex); }
      this.$el.addClass('error');
    }
  });

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.template = $('#new-message-form').html();
      Mustache.parse(this.template);
      this.render();
      this.input = this.$el.find('input.number');
      new Whisper.MessageRecipientInputView({el: this.input});
    },

    events: {
      'submit .send': 'send',
      'close': 'remove'
    },

    send: function(e) {
      e.preventDefault();
      var number = this.input.val();
      try {
        if (textsecure.utils.verifyNumber(number)) {
          var thread = Whisper.Threads.findOrCreateForRecipient(number);
          var message_input = this.$el.find('input.send-message');
          thread.sendMessage(message_input.val());
          this.remove();
        }
      } catch(ex) {}
    },

    render: function() {
      this.$el.html(Mustache.render(this.template));
      this.$el.show().insertAfter($('#gutter'));
      return this;
    }
  });

  Whisper.Header = Backbone.View.extend({
    events: {
      'click #new-message': 'new_message',
      'click #new-group': 'new_group'
    },

    new_message: function(e) {
      e.preventDefault();
      $('.conversation').hide().trigger('close'); // detach any existing conversation views
      this.view = new Whisper.NewConversationView().$el.insertAfter($('#gutter'));
      //todo: less new
    },

    new_group: function(e) {
      e.preventDefault();
      $('.conversation').trigger('close'); // detach any existing conversation views
      new Whisper.NewGroupView({ el: $('.conversation') });
    }
  });

})();
