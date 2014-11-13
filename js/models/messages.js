var Whisper = Whisper || {};

(function () {
  'use strict';

  var Message  = Backbone.Model.extend({
    validate: function(attributes, options) {
      var required = ['timestamp', 'threadId'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { console.log("Message missing attributes: " + missing); }
    },

    thread: function() {
      return Whisper.Threads.get(this.get('threadId'));
    }
  });

  Whisper.MessageCollection = Backbone.Collection.extend({
    model: Message,
    comparator: 'timestamp',
    initialize: function(models, options) {
      this.localStorage = new Backbone.LocalStorage("Messages-" + options.threadId);
    }
  });
})()
