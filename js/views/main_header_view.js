/* global Whisper, textsecure, ConversationController, Signal */

// eslint-disable-next-line func-names
(function() {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.MainHeaderView = Whisper.View.extend({
      templateName: 'main-header-placeholder',
      events: {
        'click .main-header-title-wrapper': 'onClick',
      },
      initialize() {
        const ourNumber = textsecure.storage.user.getNumber();
        const me = ConversationController.getOrCreate(ourNumber, 'private');

        this.mainHeaderView = new Whisper.ReactWrapperView({
          className: 'main-header-wrapper',
          Component: Signal.Components.MainHeader,
          props: me.format(),
        });
        const update = () => this.mainHeaderView.update(me.format());
        this.listenTo(me, 'change', update);

        this.render();

        this.$('.main-header-title-wrapper').prepend(this.mainHeaderView.el);
        this.$content = this.$('.main-header-content-wrapper');
        this.$toggle = this.$('.main-header-content-toggle');
      },
      onClick() {
        // Toggle section visibility
        this.$content.slideToggle('fast');
        this.$toggle.toggleClass('main-header-content-toggle-visible');
      },
    });
  })();
