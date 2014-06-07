var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListView = Backbone.View.extend({

    tagName: 'ul',
    id: 'conversations',
    initialize: function() {
      this.views = [];
      this.threads = Whisper.Threads;
      this.listenTo(this.threads, 'change:completed', this.render); // auto update
      this.listenTo(this.threads, 'add', this.addThread);
      this.listenTo(this.threads, 'reset', this.addAll);
      this.listenTo(this.threads, 'all', this.render);
      this.listenTo(Whisper.Messages, 'add', this.addMessage);

      // Suppresses 'add' events with {reset: true} and prevents the app view
      // from being re-rendered for every model. Only renders when the 'reset'
      // event is triggered at the end of the fetch.
      //this.messages.threads({reset: true});
      Whisper.Threads.fetch({reset: true});
      Whisper.Messages.fetch();

      this.$el.appendTo($('#inbox'));
    },

    addThread: function(thread) {
      this.views[thread.id] = new Whisper.ConversationView({model: thread});
      this.$el.prepend(this.views[thread.id].render().el);
    },

    addAll: function() {
      this.$el.html('');
      this.threads.each(this.addThread, this);
    },

    addMessage: function(message) {
      message.thread().trigger('message', message);
    }
  });
})();
