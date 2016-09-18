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
            this.conversation = options.conversation;
            this.render();
            var view = new Whisper.KeyVerificationView({
                model  : this.contact,
                newKey : this.model.identityKey
            });
            view.$el.appendTo(this.$('.keys'));
        },
        events: {
            'click .showKeys': 'showKeys',
            'click .hideKeys': 'hideKeys',
            'click .resolve' : 'resolve'
        },
        hideKeys: function() {
            this.$('.keys, .hideKeys').hide();
            this.$('.showKeys').show();
        },
        showKeys: function() {
            this.$('.keys, .hideKeys').show();
            this.$('.showKeys').hide();
        },
        resolve: function() {
            this.remove();
            this.conversation.resolveConflicts(this.model);
        },
        render_attributes: function() {
            return {
                name         : this.contact.getTitle(),
                avatar       : this.contact.getAvatar(),
                conflict     : this.model,
                newIdentity  : i18n('newIdentity'),
                message      : i18n('identityChanged'),
                resolve      : i18n('acceptNewKey'),
                showKeys     : i18n('showMore'),
                hideKeys     : i18n('showLess'),
                learnMore    : i18n('learnMore')
            };
        }
    });
})();
