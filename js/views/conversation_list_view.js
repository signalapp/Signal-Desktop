var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListView = Whisper.ListView.extend({
    tagName: 'div',
    id: 'contacts',
    itemView: Whisper.ConversationListItemView,
    collection: Whisper.Threads,

    events: {
      'click .contact': 'select',
    },

    select: function(e) {
      var target = $(e.target).closest('.contact');
      target.siblings().removeClass('selected');
      return false;
    },
  });
})();
