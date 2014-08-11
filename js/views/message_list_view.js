var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.MessageListView = Whisper.ListView.extend({
    tagName: 'ul',
    className: 'discussion',
    itemView: Whisper.MessageView
  });
})();
