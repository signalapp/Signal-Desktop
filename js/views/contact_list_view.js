// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper: false */
/* global textsecure: false */

// eslint-disable-next-line func-names
(function() {
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
        this.loading = false;

        this.listenTo(this.model, 'change', this.render);
      },
      render() {
        if (this.contactView) {
          this.contactView.remove();
          this.contactView = null;
        }

        this.contactView = new Whisper.ReactWrapperView({
          className: 'contact-wrapper',
          Component: window.Signal.Components.ContactListItem,
          props: {
            ...this.model.format(),
            onClick: this.showIdentity.bind(this),
          },
        });
        this.$el.append(this.contactView.el);
        return this;
      },
      showIdentity() {
        if (this.model.isMe() || this.loading) {
          return;
        }

        this.loading = true;
        this.render();

        this.panelView = new Whisper.KeyVerificationPanelView({
          model: this.model,
          onLoad: view => {
            this.loading = false;
            this.listenBack(view);
            this.render();
          },
        });
      },
    }),
  });
})();
