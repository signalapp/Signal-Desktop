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
            } else {
                view = new this.itemView({model: model}).render();
                this.listenTo(view, 'beforeChangeHeight', this.measureScrollPosition);
                this.listenTo(view, 'afterChangeHeight', this.scrollToBottomIfNeeded);
            }
            if (this.collection.indexOf(model) === this.collection.length - 1) {
                // add to the bottom.
                this.$el.append(view.el);
                this.$el.scrollTop(this.el.scrollHeight); // TODO: Avoid scrolling if user has manually scrolled up?
                this.measureScrollPosition();
            } else {
                // add to the top.
                this.measureScrollPosition();
                this.$el.prepend(view.el);
                this.scrollToBottomIfNeeded();
            }
        },
    });
})();
