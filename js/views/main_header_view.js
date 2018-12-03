/* global Whisper, textsecure, ConversationController, Signal, i18n */

// eslint-disable-next-line func-names
(function() {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.MainHeaderView = Whisper.View.extend({
      templateName: 'main-header-placeholder',
      events: {
        'click .main-header-title-wrapper': 'onClick',
        'click .edit-name': 'onEditProfile',
        'click .copy-key': 'onCopyKey',
      },
      initialize(options) {
        this.items = options.items || [];

        this.ourNumber = textsecure.storage.user.getNumber();
        const me = ConversationController.getOrCreate(this.ourNumber, 'private');

        this.mainHeaderView = new Whisper.ReactWrapperView({
          className: 'main-header-wrapper',
          Component: Signal.Components.MainHeader,
          props: me.format(),
        });
        const update = () => this.mainHeaderView.update(me.format());
        this.listenTo(me, 'change', update);

        this.render();
        this.$('.main-header-title-wrapper').prepend(this.mainHeaderView.el);

        this.$toggle = this.$('.main-header-content-toggle');
        this.$content = this.$('.main-header-content-wrapper');
        this.$content.hide();

        this.registerCallbacks();
      },
      registerCallbacks() {
        this.items.forEach(item => {
          if (item.onClick) {
            this.$(`#${item.id}`).click(item.onClick);
          }
        })
      },
      render_attributes() {
        return {
          items: this.items,
        };
      },
      onClick() {
        // Toggle section visibility
        this.$content.slideToggle('fast');
        this.$toggle.toggleClass('main-header-content-toggle-visible');
      },
    });
  })();
