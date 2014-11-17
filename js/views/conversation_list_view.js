var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListView = Whisper.ListView.extend({
    tagName: 'div',
    id: 'contacts',
    itemView: Whisper.ConversationListItemView,

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
