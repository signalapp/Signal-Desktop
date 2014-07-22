var Whisper = Whisper || {};

(function () {
  'use strict';

  var destroyer = Backbone.View.extend({
    tagName: 'button',
    className: 'btn btn-square btn-sm destroy',
    events: {
      'click': 'destroy'
    },
    initialize: function() {
      this.$el.html('&times;');
    },

    destroy: function() {
      this.model.messages().each(function(message) { message.destroy(); });
      this.model.set('active', false);
      this.model.save();
      this.model.trigger('destroy');
    }
  });

  var menu = Backbone.View.extend({
    tagName: 'ul',
    className: 'menu',
    initialize: function() {
      this.$el.html("<li>delete</li>");
    }
  });

  Whisper.ConversationView = Backbone.View.extend({
    tagName: 'li',
    className: 'conversation',

    events: {
      'click': 'open',
      'submit form': 'sendMessage'
    },
    initialize: function() {
      this.template = $('#contact').html();
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'message', this.addMessage); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update
      this.listenTo(Whisper.Messages, 'reset', this.addAllMessages); // auto update

      this.$el.addClass('closed');
      this.$destroy = (new destroyer({model: this.model})).$el;

      this.$image  = $('<div class="image">');
      this.$name   = $('<span class="name">');
      this.$header = $('<div class="header">').append(this.$image, this.$name);

      this.$el.append(this.$header, this.$collapsable);
    },

    sendMessage: function(e) {
      if (!this.$input.val().length) { return false; }
      this.model.sendMessage(this.$input.val());
      this.$input.val("");
      e.preventDefault();
    },

    remove: function() {
      this.$el.remove();
    },

    close: function() {
      if (!this.$el.hasClass('closed')) {
        this.$el.addClass('closed');
      }
    },

    open: function(e) {
      this.$el.siblings().addClass('closed');
      this.$el.removeClass('closed');
      var v = new Whisper.MessageListView({collection: this.model.messages()});
      v.render();
    },

    toggle: function() {
      if (this.$el.hasClass('closed')) {
        this.open();
      } else {
        this.close();
      }
    },

    addMessage: function (message) {
      var view = new Whisper.MessageView({ model: message });
      this.$messages.append(view.render().el);
    },

    addAllMessages: function () {
      this.model.messages().each(this.addMessage, this);
      this.render();
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
