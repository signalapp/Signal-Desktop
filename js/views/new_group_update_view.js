/* global Whisper, _ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.NewGroupUpdateView = Whisper.View.extend({
    tagName: 'div',
    className: 'new-group-update',
    templateName: 'new-group-update',
    initialize(options) {
      this.render();
      this.avatarInput = new Whisper.FileInputView({
        el: this.$('.group-avatar'),
        window: options.window,
      });

      this.recipients_view = new Whisper.RecipientsInputView();
      this.listenTo(this.recipients_view.typeahead, 'sync', () =>
        this.model.contactCollection.models.forEach(model => {
          if (this.recipients_view.typeahead.get(model)) {
            this.recipients_view.typeahead.remove(model);
          }
        })
      );
      this.recipients_view.$el.insertBefore(this.$('.container'));

      this.member_list_view = new Whisper.ContactListView({
        collection: this.model.contactCollection,
        className: 'members',
      });
      this.member_list_view.render();
      this.$('.scrollable').append(this.member_list_view.el);
    },
    events: {
      'click .back': 'goBack',
      'click .send': 'send',
      'focusin input.search': 'showResults',
      'focusout input.search': 'hideResults',
    },
    hideResults() {
      this.$('.results').hide();
    },
    showResults() {
      this.$('.results').show();
    },
    goBack() {
      this.trigger('back');
    },
    render_attributes() {
      return {
        name: this.model.getTitle(),
        avatar: this.model.getAvatar(),
      };
    },
    async send() {
      // When we turn this view on again, need to handle avatars in the new way

      // const avatarFile = await this.avatarInput.getThumbnail();
      const now = Date.now();
      const attrs = {
        timestamp: now,
        active_at: now,
        name: this.$('.name').val(),
        members: _.union(
          this.model.get('members'),
          this.recipients_view.recipients.pluck('id')
        ),
      };

      // if (avatarFile) {
      //   attrs.avatar = avatarFile;
      // }

      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so model.changed is accurate.
      this.model.changed = {};
      this.model.set(attrs);
      const groupUpdate = this.model.changed;

      await window.Signal.Data.updateConversation(
        this.model.id,
        this.model.attributes,
        { Conversation: Whisper.Conversation }
      );

      if (groupUpdate.avatar) {
        this.model.trigger('change:avatar');
      }

      this.model.updateGroup(groupUpdate);
      this.goBack();
    },
  });
})();
