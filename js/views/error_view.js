/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    var ErrorView = Backbone.View.extend({
        className: 'error',
        initialize: function() {
            this.template = $('#generic-error').html();
            Mustache.parse(this.template);
        },
        render: function() {
            this.$el.html(Mustache.render(this.template, this.model));
            return this;
        }
    });

    var KeyConflictView = ErrorView.extend({
        className: 'key-conflict',
        initialize: function(options) {
            this.message = options.message;
            if (this.message.isIncoming()) {
                this.template = $('#incoming-key-conflict').html();
            } else if (this.message.isOutgoing()) {
                this.template = $('#outgoing-key-conflict').html();
            }
            Mustache.parse(this.template);
        },
        events: {
            'click': 'select'
        },
        select: function() {
            this.$el.trigger('select', {message: this.message});
        },
    });

    Whisper.MessageErrorView = Backbone.View.extend({
        className: 'error',
        initialize: function(options) {
            if (this.model.name === 'IncomingIdentityKeyError' ||
                this.model.name === 'OutgoingIdentityKeyError') {
                this.view = new KeyConflictView({
                    model   : this.model,
                    message : options.message
                });
            } else {
                this.view = new ErrorView({ model: this.model });
            }
            this.$el.append(this.view.el);
            this.view.render();
        },
        render: function() {
            this.view.render();
            return this;
        }
    });
})();
