/* global BlockedNumberController: false */
/* global Whisper: false */
/* global storage: false */
/* global $: false */

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
          this.$('.content').append(this.listView.el);
        });
      },
      render_attributes() {
        return {
          blockedHeader: 'Blocked Users',
        };
      },
    });


  Whisper.BlockedNumberListView = Whisper.ListView.extend({
    tagName: 'div',
    itemView: Whisper.View.extend({
      tagName: 'div',
      templateName: 'blockedNumber',
      initialize() {
        this.listenTo(this.model, 'change', this.render);
      },
      render_attributes() {
        const number = (this.model && this.model.get('number')) || '-';
        return {
          number,
        }
      },
    }),
  });
  })();
  