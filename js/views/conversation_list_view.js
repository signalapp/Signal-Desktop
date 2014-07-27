var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListView = Whisper.ListView.extend({
    tagName: 'div',
    id: 'contacts',
    itemView: Whisper.ConversationListItemView,
    collection: Whisper.Threads,

    events: {
      'click .conversation': 'select',
    },

    select: function(e) {
      var target = $(e.target).closest('.conversation');
      if (target.hasClass('closed')) {
        target.siblings().addClass('closed');
        target.removeClass('closed').addClass('selected');
      }
      return false;
    },
  });
})();
