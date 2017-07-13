/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var ContactView = Whisper.View.extend({
        className: 'contact-detail',
        templateName: 'contact-detail',
        initialize: function(options) {
            this.listenBack = options.listenBack;
            this.resetPanel = options.resetPanel;
            this.message = options.message;

            var newIdentity = i18n('newIdentity');
            this.errors = _.map(options.errors, function(error) {
                if (error.name === 'OutgoingIdentityKeyError') {
                    error.message = newIdentity;
                }
                return error;
            });
            this.outgoingKeyError = _.find(this.errors, function(error) {
                return error.name === 'OutgoingIdentityKeyError';
            });
        },
        events: {
            'click': 'onClick'
        },
        onClick: function() {
            if (this.outgoingKeyError) {
                var view = new Whisper.IdentityKeySendErrorPanelView({
                    model: this.model,
                    listenBack: this.listenBack,
                    resetPanel: this.resetPanel
                });

                this.listenTo(view, 'send-anyway', this.onSendAnyway);

                view.render();

                this.listenBack(view);
                view.$('.cancel').focus();
            }
        },
        forceSend: function() {
            this.model.updateVerified().then(function() {
                if (this.model.isUnverified()) {
                    return this.model.setVerifiedDefault();
                }
            }.bind(this)).then(function() {
                return this.model.isUntrusted();
            }.bind(this)).then(function(untrusted) {
                if (untrusted) {
                    return this.model.setApproved();
                }
            }.bind(this)).then(function() {
                this.message.resend(this.outgoingKeyError.number);
            }.bind(this));
        },
        onSendAnyway: function() {
            if (this.outgoingKeyError) {
                this.forceSend();
            }
        },
        render_attributes: function() {
            var showButton = Boolean(this.outgoingKeyError);

            return {
                name             : this.model.getTitle(),
                avatar           : this.model.getAvatar(),
                errors           : this.errors,
                showErrorButton  : showButton,
                errorButtonLabel : i18n('view')
            };
        }
    });

    Whisper.MessageDetailView = Whisper.View.extend({
        className: 'message-detail panel',
        templateName: 'message-detail',
        initialize: function(options) {
            this.listenBack = options.listenBack;
            this.resetPanel = options.resetPanel;

            this.view = new Whisper.MessageView({model: this.model});
            this.view.render();
            this.conversation = options.conversation;

            this.listenTo(this.model, 'change', this.render);
        },
        events: {
            'click button.delete': 'onDelete'
        },
        onDelete: function() {
            var dialog = new Whisper.ConfirmationDialogView({
                message: i18n('deleteWarning'),
                okText: i18n('delete'),
                hideCancel: true,
                resolve: function() {
                    this.model.destroy();
                    this.resetPanel();
                }.bind(this)
            });

            this.$el.prepend(dialog.el);
            dialog.focusCancel();
        },
        getContact: function(number) {
            var c = ConversationController.get(number);
            return {
                number: number,
                title: c ? c.getTitle() : number
            };
        },
        contacts: function() {
            if (this.model.isIncoming()) {
                var number = this.model.get('source');
                return [this.conversation.contactCollection.get(number)];
            } else {
                return this.conversation.contactCollection.models;
            }
        },
        renderContact: function(contact) {
            var view = new ContactView({
                model: contact,
                errors: this.grouped[contact.id],
                listenBack: this.listenBack,
                resetPanel: this.resetPanel,
                message: this.model
            }).render();
            this.$('.contacts').append(view.el);
        },
        render: function() {
            var errorsWithoutNumber = _.reject(this.model.get('errors'), function(error) {
                return Boolean(error.number);
            });

            this.$el.html(Mustache.render(_.result(this, 'template', ''), {
                sent_at         : moment(this.model.get('sent_at')).format('LLLL'),
                received_at     : this.model.isIncoming() ? moment(this.model.get('received_at')).format('LLLL') : null,
                tofrom          : this.model.isIncoming() ? i18n('from') : i18n('to'),
                errors          : errorsWithoutNumber,
                title           : i18n('messageDetail'),
                sent            : i18n('sent'),
                received        : i18n('received'),
                errorLabel      : i18n('error'),
                deleteLabel     : i18n('deleteMessage'),
                retryDescription: i18n('retryDescription')
            }));
            this.view.$el.prependTo(this.$('.message-container'));

            this.grouped = _.groupBy(this.model.get('errors'), 'number');
            if (this.model.isOutgoing()) {
                var contacts = this.conversation.contactCollection.reject(function(c) {
                    return c.isMe();
                });

                _.sortBy(contacts, function(c) {
                    var prefix = this.grouped[c.id] ? '0' : '1';
                    // this prefix ensures that contacts with errors are listed first;
                    //   otherwise it's alphabetical
                    return prefix + c.getTitle();
                }.bind(this)).forEach(this.renderContact.bind(this));
            } else {
                var c = this.conversation.contactCollection.get(this.model.get('source'));
                this.renderContact(c);
            }
        }
    });

})();
