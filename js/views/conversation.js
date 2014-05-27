var Whisper = Whisper || {};

(function () {
  'use strict';

  var destroyer = Backbone.View.extend({
    tagName: 'button',
    className: 'btn btn-square btn-sm destroy',
    initialize: function() {
      this.$el.html('&times;');
      this.$el.click(this.destroy.bind(this));
    },

    destroy: function() {
      _.each(this.model.messages(), function(message) { message.destroy(); });
      this.model.destroy();
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

    initialize: function() {
      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'message', this.addMessage); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update
      this.listenTo(this.model, 'select', this.open);

      this.$el.addClass('closed');
      this.$destroy = (new destroyer({model: this.model})).$el;

      this.$image  = $('<div class="image">');
      this.$name   = $('<span class="name">');
      this.$header = $('<div class="header">').append(this.$image, this.$name);

      this.$button = $('<button class="btn">').append($('<span>').text('Send'));
      this.$input  = $('<input type="text">').attr('autocomplete','off');
      this.$form   = $("<form class=''>").append(this.$input);

      this.$messages    = $('<ul class="messages">');
      this.$collapsable = $('<div class="collapsable">').hide();
      this.$collapsable.append(this.$messages, this.$form);

      this.$el.append(this.$destroy, this.$header, this.$collapsable);
      this.addAllMessages();

      this.$form.submit(function(input,thread){ return function(e) {
        if (!input.val().length) { return false; }
        thread.sendMessage(input.val());
        input.val("");
        e.preventDefault();
      };}(this.$input, this.model));

      this.$header.click(function(e) {
        var $conversation = $(e.target).closest('.conversation');
        if (!$conversation.hasClass('closed')) {
          $conversation.addClass('closed');
          $conversation.find('.collapsable').slideUp(600);
          e.stopPropagation();
        }
      });

      this.$button.click(function(button,input,thread){ return function(e) {
        if (!input.val().length) { return false; }
        button.attr("disabled", "disabled");
        button.find('span').text("Sending");

        thread.sendMessage(input.val()).then(function(){
          button.removeAttr("disabled");
          button.find('span').text("Send");
        });

        input.val("");
      };}(this.$button, this.$input, this.model));

      this.$el.click(this.open.bind(this));
    },

	remove: function() {
	  this.$el.remove();
	},

    open: function(e) {
      if (this.$el.hasClass('closed')) {
        this.$el.removeClass('closed');
        this.$collapsable.slideDown(600);
      }
      this.$input.focus();
    },

    addMessage: function (message) {
      var view = new Whisper.MessageView({ model: message });
      this.$messages.append(view.render().el);
    },

    addAllMessages: function () {
      _.each(this.model.messages(), this.addMessage, this);
      this.render();
    },

    render: function() {
      this.$name.text(this.model.get('name'));
      this.$image.css('background-image: ' + this.model.get('image') + ';');
      return this;
    }
  });
})();
