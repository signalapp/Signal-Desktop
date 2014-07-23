var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListItemView = Backbone.View.extend({
    tagName: 'li',
    className: 'conversation',

    events: {
      'click': 'open',
    },
    initialize: function() {
      this.template = $('#contact').html();
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update

      this.$el.addClass('closed');
    },

    open: function(e) {
      $('#main').trigger('close'); // detach any existing conversation views
      var v = new Whisper.ConversationView({el: $('#main'), model: this.model});
    },

    render: function() {
      this.$el.html(
        Mustache.render(this.template, {
          name: this.model.get('name')
        })
      );

      return this;
    },

  });
})();
