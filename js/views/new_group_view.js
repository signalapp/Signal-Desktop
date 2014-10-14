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
    initialize: function() {
      this.template = $('#new-group-form').html();
      Mustache.parse(this.template);
      this.render();
      this.input = this.$el.find('input.number');
      new Whisper.GroupRecipientsInputView({el: this.$el.find('input.numbers')}).$el.appendTo(this.$el);
    },
    events: {
      'submit .send': 'send'
    },

    send: function(e) {
      e.preventDefault();
      var numbers = this.$el.find('input.numbers').val().split(',');
      var name = this.$el.find('input.name').val();
      var thread = Whisper.Threads.createGroup(numbers, name);
      thread.sendMessage(this.input.val());
      // close this, select the new thread
    },

    render: function() {
      this.$el.prepend($(Mustache.render(this.template)));
      Whisper.Layout.setContent(this.$el.show());
      return this;
    }
  });

})();
