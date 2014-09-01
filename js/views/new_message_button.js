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

  Whisper.Header = Backbone.View.extend({
    events: {
      'click #new-message': 'new_message',
      'click #new-group': 'new_group'
    },

    new_message: function(e) {
      e.preventDefault();
      $('.conversation').hide().trigger('close'); // detach any existing conversation views
      this.view = new Whisper.NewConversationView();
      //todo: less new
    },

    new_group: function(e) {
      e.preventDefault();
      $('.conversation').trigger('close'); // detach any existing conversation views
      new Whisper.NewGroupView({ el: $('.conversation') });
    }
  });

})();
