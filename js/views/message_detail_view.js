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
            this.errors = _.reject(options.errors, function(e) {
                return (e.name === 'OutgoingIdentityKeyError' ||
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
            'click button.retry': 'onRetry'
        },
        onRetry: function(e) {
            var number = _.find(e.target.attributes, function(attribute) {
                return attribute.name === 'data-number';
            });
            if (number) {
                this.model.resend(number.value);
            }
        },
        getContact: function(number) {
            var c = ConversationController.get(number);
            return {
                number: number,
                title: c ? c.getTitle() : number
            };
        },
        buildRetryTargetList: function() {
            var targets = _.filter(this.model.get('errors'), function(e) {
                return e.number && e.name === 'OutgoingIdentityKeyError';
            });

            return _.map(targets, function(e) {
                return this.getContact(e.number);
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
            var grouped = _.groupBy(this.model.get('errors'), 'number');

            var view = new ContactView({
                model: contact,
                errors: grouped[contact.id]
            }).render();
            this.$('.contacts').append(view.el);
        },
        render: function() {
            var retryTargets = this.buildRetryTargetList();
            var allowRetry = retryTargets.length > 0;

            this.$el.html(Mustache.render(_.result(this, 'template', ''), {
                sent_at         : moment(this.model.get('sent_at')).format('LLLL'),
                received_at     : this.model.isIncoming() ? moment(this.model.get('received_at')).format('LLLL') : null,
                tofrom          : this.model.isIncoming() ? i18n('from') : i18n('to'),
                errors          : this.model.get('errors'),
                allowRetry      : allowRetry,
                retryTargets    : retryTargets,
                title           : i18n('messageDetail'),
                sent            : i18n('sent'),
                received        : i18n('received'),
                errorLabel      : i18n('error'),
                retryDescription: i18n('retryDescription')
            }));
            this.view.$el.prependTo(this.$('.message-container'));

            if (this.model.isOutgoing()) {
                this.conversation.contactCollection.reject(function(c) {
                    return c.isMe();
                }).forEach(this.renderContact.bind(this));
            } else {
                this.renderContact(
                    this.conversation.contactCollection.get(this.model.get('source'))
                );
            }
        }
    });

})();
