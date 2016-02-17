/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.KeyConflictDialogueView = Whisper.View.extend({
        templateName: 'key-conflict-dialogue',
        className: 'key-conflict-dialogue clearfix',
        initialize: function(options) {
            this.contact = options.contact;
            this.conflict = options.conflict;
            this.conversation = options.conversation;
        },
        events: {
            'click .conflict': 'showDialog',
            'click .cancel'  : 'cancel',
            'click .verify'  : 'triggerVerify',
            'click .resolve' : 'resolve'
        },
        triggerVerify: function() {
            this.trigger('verify', {identityKey: this.model.identityKey});
        },
        resolve: function() {
            this.trigger('resolve');
            this.remove();
            this.conversation.resolveConflicts(this.model);
        },
        showDialog: function() {
            this.$('.conflict').hide();
            this.$('.cancel, .content').show();
        },
        cancel: function() {
            this.$('.cancel, .content').hide();
            this.$('.conflict').show();
        },
        render_attributes: function() {
            return {
                name         : this.contact.getTitle(),
                avatar       : this.contact.getAvatar(),
                conflict     : this.conflict,
                verify       : i18n('verify'),
                cancel       : i18n('cancel'),
                newIdentity  : i18n('newIdentity'),
                message      : i18n('identityChanged'),
                resolve      : i18n('acceptNewKey'),
                verifyContact: i18n('verifyContact')
            };
        }
    });
})();
