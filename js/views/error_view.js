/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    var ErrorView = Whisper.View.extend({
        className: 'error',
        templateName: 'generic-error',
        render_attributes: function() {
            return this.model;
        }
    });

    var KeyConflictView = ErrorView.extend({
        className: 'key-conflict',
        templateName: 'key-conflict',
        initialize: function(options) {
            this.message = options.message;
        },
        events: {
            'click': 'select'
        },
        render_attributes: function() {
            var errorMessage;
            if (this.message.isIncoming()) {
                errorMessage = 'incomingKeyConflict';
            } else {
                errorMessage = 'outgoingKeyConflict';
            }
            return { message: i18n(errorMessage) };
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
