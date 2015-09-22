/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.NewConversationView = Whisper.View.extend({
        className: 'new-conversation',
        template: $('#new-conversation').html(),
        initialize: function(options) {
            this.render();
            this.$group_update = this.$('.group-info-input');
            this.$create = this.$('.create');

            // Group avatar file input
            this.appWindow = options.appWindow;
            this.avatarInput = new Whisper.FileInputView({
                el: this.$('.group-avatar'),
                window: this.appWindow.contentWindow
            });

            this.recipients_view = new Whisper.RecipientsInputView();
            this.recipients_view.$el.insertAfter(this.$('.group-info-input'));
            this.$input = this.$('input.search');

            this.listenTo(this.getRecipients(), 'add', this.updateControls);
            this.listenTo(this.getRecipients(), 'remove', this.updateControls);
        },

        render_attributes: function() {
            return {
                avatar: { url: '/images/group_default.png', color: 'gray' }
            };
        },

        events: {
            'click .create': 'create',
            'click .back': 'goBack',
            'keyup': 'keyup'
        },

        keyup: function(e) {
            if (e.keyCode === 27) {
                this.goBack();
            }
        },

        goBack: function() {
            this.trigger('back');
        },

        getRecipients: function() {
            return this.recipients_view.recipients;
        },

        updateControls: function() {
            if (this.getRecipients().length > 0) {
                this.$create.show();
            } else {
                this.$create.hide();
            }
            if (this.getRecipients().length > 1) {
                this.$group_update.slideDown();
            } else {
                this.$group_update.slideUp();
            }
            this.$input.focus();
        },

        create: function() {
            var errors = this.recipients_view.$('.error');
            if (errors.length) {

                // TODO: css animation or error notification
                errors.removeClass('error');
                setTimeout(function(){ errors.addClass('error'); }, 300);

                return;
            }
            if (this.getRecipients().length > 1) {
                this.createGroup();
            } else {
                var id = this.getRecipients().at(0).id;
                ConversationController.findOrCreatePrivateById(id).then(function(conversation) {
                    conversation.save('active_at', Date.now());
                    this.trigger('open', conversation);
                }.bind(this));
            }
        },

        createGroup: function() {
            var name = this.$('.group-info-input .name').val();
            if (!name.trim().length) {
                return;
            }

            return this.avatarInput.getThumbnail().then(function(avatarFile) {
                var members = this.getRecipients().pluck('id');
                members.push(textsecure.storage.user.getNumber());
                textsecure.storage.groups.createNewGroup(members).then(function(group) {
                    return group.id;
                }).then(function(groupId) {
                    var now = Date.now();
                    var group = ConversationController.create({
                        id: groupId,
                        groupId: groupId,
                        type: 'group',
                        name: name,
                        avatar: avatarFile,
                        members: members,
                        active_at: now,
                    });
                    group.save().then(function() {
                        this.trigger('open', group);
                    }.bind(this));
                    group.updateGroup();
                }.bind(this));
            }.bind(this));
        },

        reset: function() {
            this.delegateEvents();
            this.avatarInput.delegateEvents();
            this.$create.hide();
            this.$('.group-info-input .name').val('');
            this.$group_update.hide();
            this.recipients_view.reset();
        },
    });

})();
