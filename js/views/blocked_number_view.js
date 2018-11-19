/* global BlockedNumberController: false */
/* global Whisper: false */
/* global storage: false */
/* global i18n: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.BlockedNumberView = Whisper.View.extend({
      templateName: 'blockedUserSettings',
      className: 'blockedUserSettings',
      events: {
        'click .sync': 'sync',
      },
      initialize() {
        storage.onready(() => {
          this.collection = BlockedNumberController.getAll();
          this.listView = new Whisper.BlockedNumberListView({
            collection: this.collection,
          });

          this.listView.render();
          this.$('.blocked-user-settings').append(this.listView.el);
        });
      },
      render_attributes() {
        return {
          blockedHeader: i18n('settingsUnblockHeader'),
        };
      },
    });


  Whisper.BlockedNumberListView = Whisper.ListView.extend({
    itemView: Whisper.View.extend({
      tagName: 'li',
      templateName: 'blockedNumber',
      events: {
        'click .unblock-button': 'onUnblock',
      },
      render_attributes() {
        const number = (this.model && this.model.get('number')) || '-';
        return {
          number,
          unblockMessage: i18n('unblockUser'),
        }
      },
      onUnblock() {
        const number = this.model && this.model.get('number');
        if (!number) return;

        if (BlockedNumberController.isBlocked(number)) {
          BlockedNumberController.unblock(number);
          window.onUnblockNumber(number);
          this.remove();
        }
      },
    }),
  });
  })();
