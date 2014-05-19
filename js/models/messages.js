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
      //TODO: The data in decrypted (from subscribeToPush) should already be cleaned up
      var attachments = [];
      for (var i = 0; i < decrypted.message.attachments.length; i++)
        attachments[i] = "data:" + decrypted.message.attachments[i].contentType + ";base64," + btoa(getString(decrypted.message.attachments[i].decrypted));

      var m = Whisper.Messages.add({
        person: decrypted.pushMessage.source,
        group: decrypted.message.group,
        body: decrypted.message.body,
        attachments: attachments,
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
