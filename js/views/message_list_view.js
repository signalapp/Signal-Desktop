/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.MessageListView = Whisper.ListView.extend({
        tagName: 'ul',
        className: 'message-list',
        itemView: Whisper.MessageView,
        events: {
            'scroll': 'onScroll',
        },
        initialize: function(options) {
            this.conversation = options.conversation;

            Whisper.ListView.prototype.initialize.call(this);

            this.triggerLazyScroll = _.debounce(function() {
                this.$el.trigger('lazyScroll');
            }.bind(this), 500);
        },
        onScroll: function() {
            this.measureScrollPosition();
            if (this.$el.scrollTop() === 0) {
                this.$el.trigger('loadMore');
            }
            if (this.atBottom()) {
                this.$el.trigger('atBottom');
            } else if (this.bottomOffset > this.outerHeight) {
                this.$el.trigger('farFromBottom');
            }

            this.triggerLazyScroll();
        },
        atBottom: function() {
            return this.bottomOffset < 30;
        },
        measureScrollPosition: function() {
            if (this.el.scrollHeight === 0) { // hidden
                return;
            }
            this.outerHeight = this.$el.outerHeight();
            this.scrollPosition = this.$el.scrollTop() + this.outerHeight;
            this.scrollHeight = this.el.scrollHeight;
            this.bottomOffset = this.scrollHeight - this.scrollPosition;
        },
        resetScrollPosition: function() {
            this.$el.scrollTop(this.scrollPosition - this.$el.outerHeight());
        },
        scrollToBottomIfNeeded: function() {
            if (this.atBottom()) {
                this.scrollToBottom();
            }
        },
        scrollToBottom: function() {
            this.$el.scrollTop(this.el.scrollHeight);
            this.measureScrollPosition();
        },
        withinFiveMinutes: function(left, right) {
            if (left >= right) {
                return right >= (left - 1000 * 60 * 5);
            } else {
                return this.withinFiveMinutes(right, left);
            }
        },
        isTargetTypeForTimeHeader: function(model) {
            return model.get('type') === 'keychange' || model.get('type') === 'verified-change';
        },
        addTimeHeader: function(model, index) {
            var prev = this.collection.at(index - 1);
            var next = this.collection.at(index + 1);
            var currentTime = model.get('received_at');

            // we put a message above if it's not the right type, or if it's too far away
            if (prev
                && this.isTargetTypeForTimeHeader(model)
                && prev.get('type') !== 'timer-header'
                && (!this.isTargetTypeForTimeHeader(prev)
                    || !this.withinFiveMinutes(currentTime, prev.get('received_at')))) {

                this.conversation.addTimeHeader(model);
            }

            // We don't want to put a time header between us and a normal message below
            if (next
                && this.isTargetTypeForTimeHeader(next)
                && next.get('type') !== 'timer-header'
                && !this.withinFiveMinutes(currentTime, next.get('received_at'))) {

                this.conversation.addTimeHeader(next);
            }
        },
        addOne: function(model) {
            var view;

            if (model.isExpirationTimerUpdate()) {
                view = new Whisper.ExpirationTimerUpdateView({model: model}).render();
            } else if (model.get('type') === 'timer-header') {
                view = new Whisper.TimeHeaderView({model: model}).render();
            } else if (model.get('type') === 'keychange') {
                view = new Whisper.KeyChangeView({model: model}).render();
            } else if (model.get('type') === 'verified-change') {
                view = new Whisper.VerifiedChangeView({model: model}).render();
            } else {
                view = new this.itemView({model: model}).render();
                this.listenTo(view, 'beforeChangeHeight', this.measureScrollPosition);
                this.listenTo(view, 'afterChangeHeight', this.scrollToBottomIfNeeded);
            }

            var index = this.collection.indexOf(model);
            this.measureScrollPosition();

            if (model.get('unread') && !this.atBottom()) {
                this.$el.trigger('newOffscreenMessage');
            }

            if (index === this.collection.length - 1) {
                // add to the bottom.
                this.$el.append(view.el);
            } else if (index === 0) {
                // add to top
                this.$el.prepend(view.el);
            } else {
                // insert
                var next = this.$('#' + this.collection.at(index + 1).id);
                var prev = this.$('#' + this.collection.at(index - 1).id);
                if (next.length > 0) {
                    view.$el.insertBefore(next);
                } else if (prev.length > 0) {
                    view.$el.insertAfter(prev);
                } else {
                    // scan for the right spot
                    var elements = this.$el.children();
                    if (elements.length > 0) {
                        for (var i = 0; i < elements.length; ++i) {
                            var m = this.collection.get(elements[i].id);
                            var m_index = this.collection.indexOf(m);
                            if (m_index > index) {
                                view.$el.insertBefore(elements[i]);
                                break;
                            }
                        }
                    } else {
                        this.$el.append(view.el);
                    }
                }
            }
            this.scrollToBottomIfNeeded();

            this.addTimeHeader(model, index);
        },
    });
})();
