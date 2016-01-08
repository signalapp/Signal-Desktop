/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var URL_REGEX = /(^|[\s\n]|<br\/?>)((?:https?|ftp):\/\/[\-A-Z0-9\u00A0-\uD7FF\uE000-\uFDCF\uFDF0-\uFFFD+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi;

    Whisper.MessageView = Whisper.View.extend({
        tagName:   'li',
        templateName: 'message',
        initialize: function() {
            this.listenTo(this.model, 'change:errors', this.onErrorsChanged);
            this.listenTo(this.model, 'change:body', this.render);
            this.listenTo(this.model, 'change:delivered', this.renderDelivered);
            this.listenTo(this.model, 'change', this.renderSent);
            this.listenTo(this.model, 'change:flags change:group_update', this.renderControl);
            this.listenTo(this.model, 'destroy', this.remove);
            this.listenTo(this.model, 'pending', this.renderPending);
            this.listenTo(this.model, 'done', this.renderDone);
            this.timeStampView = new Whisper.MessageTimestampView();
        },
        events: {
            'click .timestamp': 'select',
            'click .error': 'select'
        },
        select: function(e) {
            this.$el.trigger('select', {message: this.model});
            e.stopPropagation();
        },
        className: function() {
            var classes = [];
            if (this.model.isIncoming()) classes = ['color-' + Math.abs(this.model.getContact().hashCode()) % 15];
            return classes.concat(['entry', this.model.get('type')]).join(' ');
        },
        renderPending: function() {
            this.$el.addClass('pending');
        },
        renderDone: function() {
            this.$el.removeClass('pending');
        },
        renderSent: function() {
            if (this.model.isOutgoing()) {
                this.$el.toggleClass('sent', !!this.model.get('sent'));
            }
        },
        renderDelivered: function() {
            if (this.model.get('delivered')) { this.$el.addClass('delivered'); }
        },
        onErrorsChanged: function() {
            if (this.model.isIncoming()) {
                this.render();
            } else {
                this.renderErrors();
            }
        },
        renderErrors: function() {
            var errors = this.model.get('errors');
            if (_.size(errors) > 0) {
                this.$('.bubble').addClass('error');
                if (this.model.isIncoming()) {
                    this.$('.content').text(this.model.getDescription()).addClass('error-message');
                }
            } else {
                this.$('.bubble').removeClass('error');
            }
        },
        renderControl: function() {
            if (this.model.isEndSession() || this.model.isGroupUpdate()) {
                this.$el.addClass('control');
                this.$('.content').text(this.model.getDescription());
            } else {
                this.$el.removeClass('control');
            }
        },
        render: function() {
            var contact = this.model.getContact();
            this.$el.html(
                Mustache.render(_.result(this, 'template', ''), {
                    message: this.model.get('body'),
                    timestamp: this.model.get('sent_at'),
                    sender: (contact && contact.getTitle()) || '',
                    avatar: (contact && contact.getAvatar())
                }, this.render_partials())
            );
            this.timeStampView.setElement(this.$('.timestamp'));
            this.timeStampView.update();

            this.renderControl();

            twemoji.parse(this.el, { base: '/images/twemoji/', size: 16 });

            var content = this.$('.content');
            var escaped = content.html();
            content.html(escaped.replace(/\n/g, '<br>').replace(URL_REGEX, "$1<a href='$2' target='_blank'>$2</a>"));

            this.renderSent();
            this.renderDelivered();
            this.renderErrors();
            this.loadAttachments();

            return this;
        },
        loadAttachments: function() {
            this.model.get('attachments').forEach(function(attachment) {
                var view = new Whisper.AttachmentView({ model: attachment });
                this.listenTo(view, 'update', function() {
                    this.trigger('beforeChangeHeight');
                    this.$('.attachments').append(view.el);
                    this.trigger('afterChangeHeight');
                });
                view.render();
            }.bind(this));
        }
    });

})();
