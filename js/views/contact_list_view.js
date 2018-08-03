/* global Whisper: false */
/* global textsecure: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ContactListView = Whisper.ListView.extend({
    tagName: 'div',
    itemView: Whisper.View.extend({
      tagName: 'div',
      className: 'contact',
      templateName: 'contact',
      initialize(options) {
        this.ourNumber = textsecure.storage.user.getNumber();
        this.listenBack = options.listenBack;

        this.listenTo(this.model, 'change', this.render);
      },
      render() {
        if (this.contactView) {
          this.contactView.remove();
          this.contactView = null;
        }

        const avatar = this.model.getAvatar();
        const avatarPath = avatar && avatar.url;
        const color = avatar && avatar.color;
        const isMe = this.ourNumber === this.model.id;

        this.contactView = new Whisper.ReactWrapperView({
          className: 'contact-wrapper',
          Component: window.Signal.Components.ContactListItem,
          props: {
            isMe,
            color,
            avatarPath,
            phoneNumber: this.model.getNumber(),
            name: this.model.getName(),
            profileName: this.model.getProfileName(),
            verified: this.model.isVerified(),
            onClick: this.showIdentity.bind(this),
          },
        });
        this.$el.append(this.contactView.el);
        return this;
      },
      showIdentity() {
        if (this.model.id === this.ourNumber) {
          return;
        }
        const view = new Whisper.KeyVerificationPanelView({
          model: this.model,
        });
        this.listenBack(view);
      },
    }),
  });
})();
