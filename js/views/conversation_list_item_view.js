/* global Whisper, Signal, Backbone, ConversationController, i18n */

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
    },

    remove() {
      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }
      Backbone.View.prototype.remove.call(this);
    },

    getProps() {
      const modelProps = this.model.getPropsForListItem();
      const props = {
        ...modelProps,
        onDeleteContact: () => {
          Whisper.events.trigger('showConfirmationDialog', {
            message: i18n('deleteContactConfirmation'),
            onOk: () =>
              ConversationController.deleteContact(
                this.model.id,
                this.model.get('type')
              ),
          });
        },
        onDeleteMessages: () => {
          Whisper.events.trigger('showConfirmationDialog', {
            message: i18n('deleteConversationConfirmation'),
            onOk: () => this.model.destroyMessages(),
          });
        },
      };
      return props;
    },

    render() {
      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }

      const props = this.getProps();
      this.childView = new Whisper.ReactWrapperView({
        className: 'list-item-wrapper',
        Component: Signal.Components.ConversationListItem,
        props,
      });

      const update = () => this.childView.update(this.getProps());

      this.listenTo(this.model, 'change', update);

      this.$el.append(this.childView.el);

      return this;
    },
  });

  // list of conversations, showing user/group and last message sent
  Whisper.ConversationContactListItemView = Whisper.ConversationListItemView.extend(
    {
      getProps() {
        // We don't want to show a timestamp or a message
        const props = this.model.getPropsForListItem();
        delete props.lastMessage;
        delete props.lastUpdated;
        delete props.isSelected;

        return props;
      },
    }
  );
})();
