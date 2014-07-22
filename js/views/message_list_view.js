var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.MessageListView = Whisper.ListView.extend({
    tagName: 'ul',
    className: 'messages',
    itemView: Whisper.MessageView,

    render: function() {
      $('#main').html('').append(this.el);
    }
  });
})();
