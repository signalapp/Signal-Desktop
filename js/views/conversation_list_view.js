var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListView = Whisper.ListView.extend({
    tagName: 'ul',
    id: 'contacts',
    itemView: Whisper.ConversationView,
    collection: Whisper.Threads,

    events: {
      'select .conversation': 'select',
      'deselect': 'deselect'
    },

    select: function(e) {
      var target = $(e.target).closest('.conversation');
      target.siblings().addClass('closed');
      target.addClass('selected').trigger('open');
      return false;
    },

    deselect: function() {
      this.$el.find('.selected').removeClass('selected').trigger('close');
      this.$el.find('.conversation').show();
    }
  });
})();
