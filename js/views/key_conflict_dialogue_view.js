/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.KeyConflictDialogueView = Whisper.View.extend({
        className: 'key-conflict-dialogue clearfix',
        templateName: 'key-conflict-dialogue',
        initialize: function(options) {
            this.conversation = options.conversation;
        },
        events: {
            'click .verify': 'triggerVerify',
            'click .resolve': 'resolve'
        },
        triggerVerify: function() {
            this.trigger('verify', {identityKey: this.model.identityKey});
        },
        resolve: function() {
            this.trigger('resolve');
            this.remove();
            this.conversation.resolveConflicts(this.model);
        },
        render_attributes: function() {
            return {
                message: i18n('identityChanged'),
                resolve: i18n('acceptNewKey'),
                verifyContact: i18n('verifyContact')
            };
        }
    });
})();
