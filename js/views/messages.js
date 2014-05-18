var Whisper = Whisper || {};

(function () {
  'use strict';

  var MessageView = Backbone.View.extend({
    tagName:   "li",
    className: "message",

    initialize: function() {
      this.$el.
        append($('<div class="bubble">').
          append($('<span class="message-text">')).
          append($('<span class="metadata">'))
        );
      this.$el.addClass(this.model.get('type'));
      this.listenTo(this.model, 'change:completed', this.render); // auto update
    },

    render: function() {
      this.$el.find('.message-text').text(this.model.get('body'));
      this.$el.find('.metadata').text(this.formatTimestamp());
      return this;
    },

    formatTimestamp: function() {
      var timestamp = this.model.get('timestamp');
      var now = new Date().getTime() / 1000;
      var date = new Date();
      date.setTime(timestamp*1000);
      if (now - timestamp > 60*60*24*7) {
        return date.toLocaleDateString({month: 'short', day: 'numeric'});
      }
      if (now - timestamp > 60*60*24) {
        return date.toLocaleDateString({weekday: 'short'});
      }
      return date.toTimeString();
    }
  });

  var ConversationView = Backbone.View.extend({
    tagName: 'li',
    className: 'conversation',

    initialize: function(options) {
      this.$el.addClass('closed');
      this.$header = $('<div class="header">').
        append($('<span>').text(options.name)).appendTo(this.$el);
      this.$header.prepend($('<div class="avatar">'));
      this.$collapsable = $('<div class="collapsable">').hide();
      this.$messages = $('<ul>').addClass('messages').appendTo(this.$collapsable);

      this.$button = $('<button class="btn">').attr('id', 'button' + this.id).
        append($('<span>').text('Send'));
      this.$input = $('<input type="text">').attr('autocomplete','off');
      this.$form = $("<form class='container'>").append(this.$input, this.$button);
      this.$form.appendTo(this.$collapsable);
      this.$collapsable.appendTo(this.$el);

      this.$header.click(function(e) {
        var $conversation = $(e.target).closest('.conversation');
        if (!$conversation.hasClass('closed')) {
          $conversation.addClass('closed');
          $conversation.find('.collapsable').slideUp(600);
          e.stopPropagation();
        }
      });

      this.$el.click(function(e) {
        var $conversation = $(e.target).closest('.conversation');
        if ($conversation.hasClass('closed')) {
          $conversation.removeClass('closed');
          $conversation.find('.collapsable').slideDown(600);
          $conversation.find('input').focus();
        }
      });

      this.$button.click(function(e) {
        var $button = $(e.target).closest('.btn');
        var $input = $button.closest('form').find('input');
        $button.attr("disabled", "disabled");
        $button.find('span').text("Sending");

        var messageProto = new PushMessageContentProtobuf();
        messageProto.body = $input.val();

        Whisper.Messages.addOutgoingMessage(messageProto, options.recipients);

        textsecure.sendMessage(options.recipients, messageProto, function(result) {
          console.log(result);
          $button.removeAttr("disabled");
          $button.find('span').text("Send");
          $input.val("");
        });
      });
    },

    addMessage: function (message) {
      var view = new MessageView({ model: message });
      this.$messages.append(view.render().el);
    },

  });

  Whisper.ConversationListView = new (Backbone.View.extend({ // singleton

    tagName: 'ul',
    id: 'conversations',
    initialize: function() {
      this.views = [];
      this.messages = Whisper.Messages;
      this.listenTo(this.messages, 'change:completed', this.render);
      this.listenTo(this.messages, 'add', this.addMessage);
      this.listenTo(this.messages, 'reset', this.addAll);
      this.listenTo(this.messages, 'all', this.render);

      // Suppresses 'add' events with {reset: true} and prevents the app view
      // from being re-rendered for every model. Only renders when the 'reset'
      // event is triggered at the end of the fetch.
      //this.messages.fetch({reset: true});

      this.$el.appendTo($('#inbox'));
    },

    addMessage: function (message) {
      // todo: find the right existing view
      var threadId = message.get('person'); // TODO: groups
      if (this.views[threadId] === undefined) {
        this.views[threadId] = new ConversationView({
          name: threadId, recipients: [threadId]
        });
        this.$el.append(this.views[threadId].render().el);
      }

      this.views[threadId].addMessage(message);
    },

    // Add all items in the collection at once
    addAll: function () {
      this.$el.html('');
      this.messages.each(this.addMessage, this);
    },
  }))();
})();
