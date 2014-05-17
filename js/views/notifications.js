var Whisper = Whisper || {};
(function () {
  'use strict';

  // This is an ephemeral collection of global notification messages to be
  // presented in some nice way to the user. In this case they will fade in/out
  // one at a time.

  var queue = new Backbone.Collection();
  var view  = new (Backbone.View.extend({
    className: 'help',
    initialize: function() {
      this.$el.appendTo($('body'));
      this.listenToOnce(queue, 'add', this.presentNext);
    },
    presentNext: function() {
      var next = queue.shift();
      if (next) {
        this.$el.text(next.get('message')).fadeIn(this.setFadeOut.bind(this));
      } else {
        this.listenToOnce(queue, 'add', this.presentNext);
      }
    },
    setFadeOut: function() {
      setTimeout(this.fadeOut.bind(this), 1500);
    },
    fadeOut: function() {
      this.$el.fadeOut(this.presentNext.bind(this));
    },
  }))();

  Whisper.notify = function(str) { queue.add({message: str}); }

})();
