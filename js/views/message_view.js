/* global Whisper: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MessageView = Whisper.View.extend({
    tagName: 'li',
    id() {
      return this.model.id;
    },
    initialize() {
      this.listenTo(this.model, 'change', this.onChange);
      this.listenTo(this.model, 'destroy', this.onDestroy);
      this.listenTo(this.model, 'unload', this.onUnload);
      this.listenTo(this.model, 'expired', this.onExpired);

      this.updateHiddenSticker();
    },
    updateHiddenSticker() {
      const sticker = this.model.get('sticker');
      this.isHiddenSticker = sticker && (!sticker.data || !sticker.data.path);
    },
    onChange() {
      this.addId();
    },
    addId() {
      // The ID is important for other items inserting themselves into the DOM. Because
      //   of ReactWrapperView and this view, there are two layers of DOM elements
      //   between the parent and the elements returned by the React component, so this is
      //   necessary.
      const { id } = this.model;
      this.$el.attr('id', id);
    },
    onExpired() {
      setTimeout(() => this.onUnload(), 1000);
    },
    onUnload() {
      if (this.childView) {
        this.childView.remove();
      }

      this.remove();
    },
    onDestroy() {
      this.onUnload();
    },
    getRenderInfo() {
      const { Components } = window.Signal;
      const { type, data: props } = this.model.props;

      if (type === 'timerNotification') {
        return {
          Component: Components.TimerNotification,
          props,
        };
      } else if (type === 'safetyNumberNotification') {
        return {
          Component: Components.SafetyNumberNotification,
          props,
        };
      } else if (type === 'verificationNotification') {
        return {
          Component: Components.VerificationNotification,
          props,
        };
      } else if (type === 'groupNotification') {
        return {
          Component: Components.GroupNotification,
          props,
        };
      } else if (type === 'resetSessionNotification') {
        return {
          Component: Components.ResetSessionNotification,
          props,
        };
      }

      return {
        Component: Components.Message,
        props,
      };
    },
    render() {
      this.addId();

      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }

      const { Component, props } = this.getRenderInfo();
      this.childView = new Whisper.ReactWrapperView({
        className: 'message-wrapper',
        Component,
        props,
      });

      const update = () => {
        const info = this.getRenderInfo();
        this.childView.update(info.props, () => {
          if (!this.isHiddenSticker) {
            return;
          }

          this.updateHiddenSticker();

          if (!this.isHiddenSticker) {
            this.model.trigger('height-changed');
          }
        });
      };

      this.listenTo(this.model, 'change', update);
      this.listenTo(this.model, 'expired', update);

      const applicableConversationChanges =
        'change:color change:name change:number change:profileName change:profileAvatar';

      this.conversation = this.model.getConversation();
      this.listenTo(this.conversation, applicableConversationChanges, update);

      this.fromContact = this.model.getIncomingContact();
      if (this.fromContact) {
        this.listenTo(this.fromContact, applicableConversationChanges, update);
      }

      this.quotedContact = this.model.getQuoteContact();
      if (this.quotedContact) {
        this.listenTo(
          this.quotedContact,
          applicableConversationChanges,
          update
        );
      }

      this.$el.append(this.childView.el);

      return this;
    },
  });
})();
