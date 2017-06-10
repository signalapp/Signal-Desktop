/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    // Contact list view is used in the list group members senario, as well as the NewGroupUpdate view
    Whisper.ContactListView = Whisper.ListView.extend({
        tagName: 'div',
        itemView: Whisper.View.extend({
            tagName: 'div',
            className: 'contact',
            templateName: 'contact',
            events: {
                'click': 'showIdentity'
            },
            initialize: function(options) {
                this.ourNumber = textsecure.storage.user.getNumber();
                this.listenBack = options.listenBack;

                this.listenTo(this.model, 'change', this.render);
            },
            render_attributes: function() {
                if (this.model.id === this.ourNumber) {
                    return {
                        class: 'not-clickable',
                        title: i18n('me'),
                        number: this.model.getNumber(),
                        avatar: this.model.getAvatar()
                    };
                }

                return {
                    class: '',
                    title: this.model.getTitle(),
                    number: this.model.getNumber(),
                    avatar: this.model.getAvatar(),
                    verified: this.model.isVerified()
                };
            },
            showIdentity: function() {
                if (this.model.id === this.ourNumber) {
                    return;
                }
                var view = new Whisper.KeyVerificationPanelView({
                    model: this.model
                });
                this.listenBack(view);
            }
        })
    });
})();
