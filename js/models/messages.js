var Whisper = Whisper || {};

(function () {
  'use strict';

  var Message  = Backbone.Model.extend({
    toProto: function() {
      return new PushMessageContentProtobuf({body: this.get('body')});
    }
  });

  Whisper.Messages = new (Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage("Messages"),
    model: Message,
    comparator: 'timestamp',

    addIncomingMessage: function(decrypted) {
      var m = Whisper.Messages.add({
        person: decrypted.pushMessage.source,
        group: decrypted.message.group,
        body: decrypted.message.body,
        type: 'incoming',
        timestamp: decrypted.message.timestamp
      });
      m.save();
      return m;
    },

    addOutgoingMessage: function(message, recipients) {
      var m = Whisper.Messages.add({
        person: recipients[0], // TODO: groups
        body: message,
        type: 'outgoing',
        timestamp: new Date().getTime()
      });
      m.save();
      return m;
    }
  }))();

})()
