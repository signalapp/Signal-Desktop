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
            this.conflict = options.conflict;
            this.errors = _.reject(options.errors, function(e) {
                return (e.name === 'IncomingIdentityKeyError' ||
                        e.name === 'OutgoingIdentityKeyError' ||
                        e.name === 'OutgoingMessageError' ||
                        e.name === 'SendMessageNetworkError');
            });

        },
        render_attributes: function() {
            return {
                name     : this.model.getTitle(),
                avatar   : this.model.getAvatar(),
                errors   : this.errors
            };
        }
    });

    Whisper.MessageDetailView = Whisper.View.extend({
        className: 'message-detail panel',
        templateName: 'message-detail',
        initialize: function(options) {
            this.view = new Whisper.MessageView({model: this.model});
            this.view.render();
            this.conversation = options.conversation;

            this.listenTo(this.model, 'change', this.render);
        },
        events: {
            'click .back': 'goBack'
        },
        goBack: function() {
            this.trigger('back');
        },
        verify: function(their_key) {
            textsecure.storage.axolotl.getIdentityKey(textsecure.storage.user.getNumber()).then(function(our_key) {
                var view = new Whisper.KeyVerificationView({
                    model: { their_key: their_key, your_key: our_key }
                });
                this.$el.hide();
                view.render().$el.insertAfter(this.el);
                this.listenTo(view, 'back', function() {
                    view.remove();
                    this.$el.show();
                }.bind(this));
            }.bind(this));
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
                errors: this.errors[contact.id]
            }).render();
            this.$('.contacts').append(view.el);

            var conflict = this.model.getKeyConflict(contact.id);
            if (conflict) {
                this.renderConflict(contact, conflict);
            }
        },
        renderConflict: function(contact, conflict) {
            var view = new Whisper.KeyConflictDialogueView({
                model: conflict,
                contact: contact,
                conversation: this.conversation
            }).render();
            this.$('.conflicts').append(view.el);
            this.listenTo(view, 'verify', function(data) {
                this.verify(conflict.identityKey);
            });
            /*
            this.listenTo(view, 'resolve', function() {
                this.render();
            });
            */
        },
        render: function() {
            this.errors = _.groupBy(this.model.get('errors'), 'number');
            var unknownErrors = this.errors['undefined'];
            if (unknownErrors) {
                unknownErrors = unknownErrors.filter(function(e) {
                    return (e.name !== 'MessageError');
                });
            }
            this.$el.html(Mustache.render(_.result(this, 'template', ''), {
                sent_at     : moment(this.model.get('sent_at')).toString(),
                received_at : this.model.isIncoming() ? moment(this.model.get('received_at')).toString() : null,
                tofrom      : this.model.isIncoming() ? i18n('from') : i18n('to'),
                errors      : unknownErrors,
                title       : i18n('messageDetail'),
                sent        : i18n('sent'),
                received    : i18n('received'),
                errorLabel  : i18n('error'),
                hasConflict : this.model.hasKeyConflicts()
            }));
            this.view.$el.prependTo(this.$('.message-container'));

            if (this.model.isOutgoing()) {
                this.conversation.contactCollection.reject(function(c) {
                    return c.id === textsecure.storage.user.getNumber();
                }).forEach(this.renderContact.bind(this));
            } else {
                this.renderContact(
                    this.conversation.contactCollection.get(this.model.get('source'))
                );
            }
        }
    });

})();
