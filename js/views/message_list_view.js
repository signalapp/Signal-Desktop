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
            'reset-scroll': 'resetScrollPosition'
        },
        onScroll: function() {
            this.measureScrollPosition();
            if (this.$el.scrollTop() === 0) {
                this.$el.trigger('loadMore');
            }
        },
        measureScrollPosition: function() {
            if (this.el.scrollHeight === 0) { // hidden
                return;
            }
            this.scrollPosition = this.$el.scrollTop() + this.$el.outerHeight();
            this.scrollHeight = this.el.scrollHeight;
            this.shouldStickToBottom = this.scrollPosition === this.scrollHeight;
            if (this.shouldStickToBottom) {
                this.bottomOffset = 0;
            } else {
                this.bottomOffset = this.scrollHeight - this.$el.scrollTop();
            }
        },
        resetScrollPosition: function() {
            var scrollPosition = this.scrollPosition;
            if (this.scrollHeight !== this.el.scrollHeight) {
               scrollPosition = this.el.scrollHeight * this.scrollPosition / this.scrollHeight;
            }
            this.$el.scrollTop(scrollPosition - this.$el.outerHeight());
        },
        scrollToBottomIfNeeded: function() {
            this.$el.scrollTop(this.el.scrollHeight - this.bottomOffset);
        },
        addOne: function(model) {
            var view;
            if (model.isExpirationTimerUpdate()) {
                view = new Whisper.ExpirationTimerUpdateView({model: model}).render();
            } else if (model.get('type') === 'keychange') {
                view = new Whisper.KeyChangeView({model: model}).render();
            } else {
                view = new this.itemView({model: model}).render();
                this.listenTo(view, 'beforeChangeHeight', this.measureScrollPosition);
                this.listenTo(view, 'afterChangeHeight', this.scrollToBottomIfNeeded);
            }
            var index = this.collection.indexOf(model);
            if (index === this.collection.length - 1) {
                // add to the bottom.
                this.$el.append(view.el);
                this.$el.scrollTop(this.el.scrollHeight); // TODO: Avoid scrolling if user has manually scrolled up?
                this.measureScrollPosition();
            } else if (index === 0) {
                // add to top
                this.measureScrollPosition();
                this.$el.prepend(view.el);
                this.scrollToBottomIfNeeded();
            } else {
                // insert
                this.measureScrollPosition();

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
                this.scrollToBottomIfNeeded();
            }
        },
    });
})();
