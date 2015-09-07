/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.KeyConflictDialogueView = Backbone.View.extend({
        className: 'key-conflict-dialogue',
        initialize: function(options) {
            this.template = $('#key-conflict-dialogue').html();
            Mustache.parse(this.template);
            this.conversation = options.conversation;
        },
        events: {
            'click .verify': 'triggerVerify',
            'click .resolve': 'resolve',
            'click .cancel': 'remove',
            'click': 'clickOut'
        },
        triggerVerify: function() {
            this.trigger('verify', {identityKey: this.model.identityKey});
        },
        clickOut: function(e) {
            if (!$(e.target).closest('.content').length) {
                this.remove();
            }
        },
        resolve: function() {
            new Promise(function(resolve) {
                this.conversation.resolveConflicts(this.model).then(resolve);
            }.bind(this));
            this.trigger('resolve');
            this.remove();
        },
        render: function() {
            this.$el.html(Mustache.render(this.template, this.model));
            return this;
        }
    });
})();
