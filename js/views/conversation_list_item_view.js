/* global Whisper, Signal, Backbone */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  // list of conversations, showing user/group and last message sent
  Whisper.ConversationListItemView = Whisper.View.extend({
    tagName: 'div',
    className() {
      return `conversation-list-item contact ${this.model.cid}`;
    },
    templateName: 'conversation-preview',
    initialize() {
      this.listenTo(this.model, 'destroy', this.remove);
      this.model.updateLastMessage();
    },

    remove() {
      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }
      Backbone.View.prototype.remove.call(this);
    },

    render() {
      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }

      const props = this.model.getPropsForListItem();
      this.childView = new Whisper.ReactWrapperView({
        className: 'list-item-wrapper',
        Component: Signal.Components.ConversationListItem,
        props,
      });

      const update = () =>
        this.childView.update(this.model.getPropsForListItem());

      this.listenTo(this.model, 'change', update);

      this.$el.append(this.childView.el);

      return this;
    },
  });
})();
