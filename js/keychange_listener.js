/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.KeyChangeListener = {
      init: function(signalProtocolStore) {
        if (!(signalProtocolStore instanceof SignalProtocolStore)) {
          throw new Error('KeyChangeListener requires a SignalProtocolStore');
        }

        signalProtocolStore.on('keychange', function(id) {
          var conversation = ConversationController.add({id: id});
          conversation.fetch().then(function() {
            conversation.addKeyChange(id);
          });
          var groups = new Whisper.GroupCollection();
          return groups.fetchGroups(id).then(function() {
            groups.each(function(conversation) {
              conversation = ConversationController.add(conversation);
              conversation.addKeyChange(id);
            });
          });
        });
      }
    };
}());
