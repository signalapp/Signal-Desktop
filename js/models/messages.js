var Whisper = Whisper || {};

(function () {
  'use strict';

  var Message  = Backbone.Model.extend({
    validate: function(attributes, options) {
      var required = ['body', 'timestamp', 'threadId'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { return "Message must have " + missing; }
    },

    toProto: function() {
      return new textsecure.protos.PushMessageContentProtobuf({body: this.get('body')});
    },

    thread: function() {
      return Whisper.Threads.get(this.get('threadId'));
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

      var thread = Whisper.Threads.findOrCreateForIncomingMessage(decrypted);
      var m = Whisper.Messages.add({
        person: decrypted.pushMessage.source,
        threadId: thread.id,
        body: decrypted.message.body,
        attachments: attachments,
        type: 'incoming',
        timestamp: decrypted.message.timestamp
      });
      m.save();

      if (decrypted.message.timestamp > thread.get('timestamp')) {
        thread.set('timestamp', decrypted.message.timestamp);
        thread.set('unreadCount', thread.get('unreadCount') + 1);
        thread.save();
      }
      thread.trigger('message', m);
      return m;
    },

    addOutgoingMessage: function(message, thread) {
      var m = Whisper.Messages.add({
        threadId: thread.id,
        body: message,
        type: 'outgoing',
        timestamp: new Date().getTime()
      });
      m.save();
      thread.trigger('message', m);
      return m;
    }
  }))();
})()
