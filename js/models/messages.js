var Whisper = Whisper || {};

(function () {
  'use strict';

  var Message  = Backbone.Model.extend();
  Whisper.Messages = new (Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage("Messages"),
    model: Message,
    comparator: 'timestamp',

    addIncomingMessage: function(decrypted) {
      Whisper.Messages.add({
        sender: decrypted.pushMessage.source,
        group: decrypted.message.group,
        body: decrypted.message.body,
        type: 'incoming',
        timestamp: decrypted.message.timestamp
      }).save();
    },

    addOutgoingMessage: function(messageProto, sender) {
      Whisper.Messages.add({
        sender: sender,
        body: messageProto.body,
        type: 'outgoing',
        timestamp: new Date().getTime()
      }).save();
    }
  }))();

})()
