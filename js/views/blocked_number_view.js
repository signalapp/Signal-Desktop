/* global BlockedNumberController: false */
/* global getBlockedNumbers: false */
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
      'click .unblock-button': 'onUnblock',
    },
    initialize() {
      storage.onready(() => {
        BlockedNumberController.refresh();
        this.collection = getBlockedNumbers();
        this.listView = new Whisper.BlockedNumberListView({
          collection: this.collection,
        });

        this.listView.render();
        this.blockedUserSettings = this.$('.blocked-user-settings');
        this.blockedUserSettings.prepend(this.listView.el);
      });
    },
    render_attributes() {
      return {
        blockedHeader: i18n('settingsUnblockHeader'),
        unblockMessage: i18n('unblockUser'),
      };
    },
    onUnblock() {
      const number = this.$('select option:selected').val();
      if (!number) {
        return;
      }

      if (BlockedNumberController.isBlocked(number)) {
        BlockedNumberController.unblock(number);
        window.onUnblockNumber(number);
        this.listView.collection.remove(
          this.listView.collection.where({ number })
        );
      }
    },
  });

  Whisper.BlockedNumberListView = Whisper.View.extend({
    tagName: 'select',
    initialize(options) {
      this.options = options || {};
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.addAll);
    },
    addOne(model) {
      const number = model.get('number');
      if (number) {
        this.$el.append(
          `<option value="${number}">${this.truncate(number, 25)}</option>`
        );
      }
    },
    addAll() {
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },
    truncate(string, limit) {
      // Make sure an element and number of items to truncate is provided
      if (!string || !limit) {
        return string;
      }

      // Get the inner content of the element
      let content = string.trim();

      // Convert the content into an array of words
      // Remove any words above the limit
      content = content.slice(0, limit);

      // Convert the array of words back into a string
      // If there's content to add after it, add it
      if (string.length > limit) {
        content = `${content}...`;
      }

      return content;
    },
    render() {
      this.addAll();
      return this;
    },
  });
})();
