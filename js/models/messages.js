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
        person: decrypted.pushMessage.source,
        group: decrypted.message.group,
        body: decrypted.message.body,
        type: 'incoming',
        timestamp: decrypted.message.timestamp
      }).save();
    },

    addOutgoingMessage: function(messageProto, recipients) {
      Whisper.Messages.add({
        person: recipients[0], // TODO: groups
        body: messageProto.body,
        type: 'outgoing',
        timestamp: new Date().getTime()
      }).save();
    }
  }))();

})()
