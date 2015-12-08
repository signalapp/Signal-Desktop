/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.KeyConflictDialogueView = Whisper.View.extend({
        className: 'key-conflict-dialogue',
        templateName: 'key-conflict-dialogue',
        initialize: function(options) {
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
            this.trigger('resolve');
            this.remove();
            this.conversation.resolveConflicts(this.model);
        },
        render_attributes: function() {
            return this.model;
        }
    });
})();
