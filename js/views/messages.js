var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListView = new (Backbone.View.extend({ // singleton

    tagName: 'ul',
    id: 'conversations',
    initialize: function() {
      this.views = [];
      this.threads = Whisper.Threads;
      this.listenTo(this.threads, 'change:completed', this.render); // auto update
      this.listenTo(this.threads, 'add', this.addThread);
      this.listenTo(this.threads, 'reset', this.addAll);
      this.listenTo(this.threads, 'all', this.render);

      // Suppresses 'add' events with {reset: true} and prevents the app view
      // from being re-rendered for every model. Only renders when the 'reset'
      // event is triggered at the end of the fetch.
      //this.messages.threads({reset: true});
      Whisper.Messages.fetch();
      Whisper.Threads.fetch({reset: true});

      this.$el.appendTo($('#inbox'));

      $('#send_link').click(function(e) {
        $('#send').fadeIn().find('input[type=text]').focus();
      });

      $('#send').click(function() {
        $('#send input[type=text]').focus();
      });

      $("#compose-cancel").click(function(e) {
        $('#send').hide();
        e.preventDefault();
      });
      $("#send").submit((function(e) {
        e.preventDefault();
        var numbers = [];
        var splitString = $("#send_numbers").val().split(",");
        for (var i = 0; i < splitString.length; i++) {
          try {
            numbers.push(verifyNumber(splitString[i]));
          } catch (numberError) {
            alert(numberError);
          }
        }
        $("#send_numbers").val('');
        numbers = _.filter(numbers, _.identity); // rm undefined, null, "", etc...
        if (numbers.length) {
          $('#send').hide();
          Whisper.Threads.findOrCreateForRecipients(numbers).trigger('select');
        } else {
          Whisper.notify('recipient missing or invalid');
          $('#send input[type=text]').focus();
        }
      }).bind(this));

    },

    addThread: function(thread) {
      this.views[thread.id] = new Whisper.ConversationView({model: thread});
      this.$el.prepend(this.views[thread.id].render().el);
    },

    addAll: function() {
      this.$el.html('');
      this.threads.each(this.addThread, this);
    },
  }))();
})();
