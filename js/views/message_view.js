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

      if (this.model.isExpirationTimerUpdate()) {
        return {
          Component: Components.TimerNotification,
          props: this.model.getPropsForTimerNotification(),
        };
      } else if (this.model.isKeyChange()) {
        return {
          Component: Components.SafetyNumberNotification,
          props: this.model.getPropsForSafetyNumberNotification(),
        };
      } else if (this.model.isVerifiedChange()) {
        return {
          Component: Components.VerificationNotification,
          props: this.model.getPropsForVerificationNotification(),
        };
      } else if (this.model.isEndSession()) {
        return {
          Component: Components.ResetSessionNotification,
          props: this.model.getPropsForResetSessionNotification(),
        };
      } else if (this.model.isGroupUpdate()) {
        return {
          Component: Components.GroupNotification,
          props: this.model.getPropsForGroupNotification(),
        };
      } else if (this.model.isFriendRequest()) {
        return {
          Component: Components.FriendRequest,
          props: this.model.getPropsForFriendRequest(),
        };
      }

      return {
        Component: Components.Message,
        props: this.model.getPropsForMessage(),
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
        this.childView.update(info.props);
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
