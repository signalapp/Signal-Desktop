/*
 * vim: ts=4:sw=4:expandtab
 */
(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.ContactListView = Whisper.ListView.extend({
    tagName: 'div',
    itemView: Whisper.View.extend({
      tagName: 'div',
      className: 'contact',
      templateName: 'contact',
      events: {
        click: 'showIdentity',
      },
      initialize: function(options) {
        this.ourNumber = textsecure.storage.user.getNumber();
        this.listenBack = options.listenBack;

        this.listenTo(this.model, 'change', this.render);
      },
      render_attributes: function() {
        if (this.model.id === this.ourNumber) {
          return {
            title: i18n('me'),
            number: this.model.getNumber(),
            avatar: this.model.getAvatar(),
          };
        }

        return {
          class: 'clickable',
          title: this.model.getTitle(),
          number: this.model.getNumber(),
          avatar: this.model.getAvatar(),
          profileName: this.model.getProfileName(),
          isVerified: this.model.isVerified(),
          verified: i18n('verified'),
        };
      },
      showIdentity: function() {
        if (this.model.id === this.ourNumber) {
          return;
        }
        var view = new Whisper.KeyVerificationPanelView({
          model: this.model,
        });
        this.listenBack(view);
      },
    }),
  });
})();
