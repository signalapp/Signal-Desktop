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
            'update *': 'scrollToBottomIfNeeded',
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
        },
        resetScrollPosition: function() {
            var scrollPosition = this.scrollPosition;
            if (this.scrollHeight !== this.el.scrollHeight) {
               scrollPosition = this.el.scrollHeight * this.scrollPosition / this.scrollHeight;
            }
            this.$el.scrollTop(scrollPosition - this.$el.outerHeight());
        },
        scrollToBottomIfNeeded: function() {
            if (this.shouldStickToBottom) {
                this.$el.scrollTop(this.scrollHeight);
            }
        },
        scrollToBottom: function() {
            // TODO: Avoid scrolling if user has manually scrolled up?
            this.$el.scrollTop(this.el.scrollHeight);
            this.measureScrollPosition();
        },
        addAll: function() {
            Whisper.ListView.prototype.addAll.apply(this, arguments); // super()
            this.scrollToBottom();
        },
        addOne: function(model) {
            if (this.itemView) {
                var view = new this.itemView({model: model}).render();
                if (this.collection.indexOf(model) === this.collection.length - 1) {
                    // add to the bottom.
                    this.$el.append(view.el);
                    this.scrollToBottom();
                } else {
                    // add to the top.
                    var offset = this.el.scrollHeight - this.$el.scrollTop();
                    this.$el.prepend(view.el);
                    this.$el.scrollTop(this.el.scrollHeight - offset);
                }
            }
            this.$el.removeClass('loading');
        },
    });
})();
