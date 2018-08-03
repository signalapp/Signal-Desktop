/* global Whisper, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MessageListView = Whisper.ListView.extend({
    tagName: 'ul',
    className: 'message-list',
    itemView: Whisper.MessageView,
    events: {
      scroll: 'onScroll',
    },
    initialize() {
      Whisper.ListView.prototype.initialize.call(this);

      this.triggerLazyScroll = _.debounce(() => {
        this.$el.trigger('lazyScroll');
      }, 500);
    },
    onScroll() {
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
    atBottom() {
      return this.bottomOffset < 30;
    },
    measureScrollPosition() {
      if (this.el.scrollHeight === 0) {
        // hidden
        return;
      }
      this.outerHeight = this.$el.outerHeight();
      this.scrollPosition = this.$el.scrollTop() + this.outerHeight;
      this.scrollHeight = this.el.scrollHeight;
      this.bottomOffset = this.scrollHeight - this.scrollPosition;
    },
    resetScrollPosition() {
      this.$el.scrollTop(this.scrollPosition - this.$el.outerHeight());
    },
    scrollToBottomIfNeeded() {
      // This is counter-intuitive. Our current bottomOffset is reflective of what
      //   we last measured, not necessarily the current state. And this is called
      //   after we just made a change to the DOM: inserting a message, or an image
      //   finished loading. So if we were near the bottom before, we _need_ to be
      //   at the bottom again. So we scroll to the bottom.
      if (this.atBottom()) {
        this.scrollToBottom();
      }
    },
    scrollToBottom() {
      this.$el.scrollTop(this.el.scrollHeight);
      this.measureScrollPosition();
    },
    addOne(model) {
      // eslint-disable-next-line new-cap
      const view = new this.itemView({ model }).render();
      this.listenTo(view, 'beforeChangeHeight', this.measureScrollPosition);
      this.listenTo(view, 'afterChangeHeight', this.scrollToBottomIfNeeded);

      const index = this.collection.indexOf(model);
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
        const next = this.$(`#${this.collection.at(index + 1).id}`);
        const prev = this.$(`#${this.collection.at(index - 1).id}`);
        if (next.length > 0) {
          view.$el.insertBefore(next);
        } else if (prev.length > 0) {
          view.$el.insertAfter(prev);
        } else {
          // scan for the right spot
          const elements = this.$el.children();
          if (elements.length > 0) {
            for (let i = 0; i < elements.length; i += 1) {
              const m = this.collection.get(elements[i].id);
              const mIndex = this.collection.indexOf(m);
              if (mIndex > index) {
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
    },
  });
})();
