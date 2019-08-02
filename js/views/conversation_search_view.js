/* global ConversationController, i18n, textsecure, Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const isSearchable = conversation => conversation.isSearchable();

  Whisper.NewContactView = Whisper.View.extend({
    templateName: 'new-contact',
    className: 'conversation-list-item contact',
    events: {
      click: 'validate',
    },
    initialize() {
      this.listenTo(this.model, 'change', this.render); // auto update
    },
    render_attributes() {
      // Show the appropriate message based on model validity
      const message =
        this.model && this.model.isValid()
          ? i18n('startConversation')
          : i18n('invalidNumberError');
      return {
        number: message,
        title: this.model.getNumber(),
        avatar: this.model.getAvatar(),
      };
    },
    validate() {
      if (this.model.isValid()) {
        this.$el.addClass('valid');
      } else {
        this.$el.removeClass('valid');
      }
    },
  });

  Whisper.ConversationSearchView = Whisper.View.extend({
    className: 'conversation-search',
    initialize(options) {
      this.$input = options.input;
      this.$new_contact = this.$('.new-contact');

      this.typeahead = new Whisper.ConversationCollection();
      this.collection = new Whisper.ConversationCollection([], {
        comparator(m) {
          return m.getTitle().toLowerCase();
        },
      });
      this.listenTo(this.collection, 'select', conversation => {
        this.resetTypeahead();
        this.trigger('open', conversation);
      });

      // View to display the matched contacts from typeahead
      this.typeahead_view = new Whisper.ConversationListView({
        collection: this.collection,
      });
      this.$el.append(this.typeahead_view.el);
      this.initNewContact();
      this.pending = Promise.resolve();
    },

    events: {
      'click .new-contact': 'createConversation',
    },

    filterContacts() {
      const query = this.$input.val().trim();
      if (query.length) {
        // Update the contact model
        this.new_contact_view.model.set('id', query);
        this.new_contact_view.render().$el.hide();
        this.new_contact_view.validate();
        this.hideHints();

        // NOTE: Temporarily allow `then` until we convert the entire file
        // to `async` / `await`:
        /* eslint-disable more/no-then */
        this.pending = this.pending.then(() =>
          this.typeahead.search(query).then(() => {
            let results = this.typeahead.filter(isSearchable);
            const noteToSelf = i18n('noteToSelf');
            if (noteToSelf.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
              const ourNumber = textsecure.storage.user.getNumber();
              const conversation = ConversationController.get(ourNumber);
              if (conversation) {
                // ensure that we don't have duplicates in our results
                results = results.filter(item => item.id !== ourNumber);
                results.unshift(conversation);
              }
            }

            this.typeahead_view.collection.reset(results);

            // This will allow us to show the last message when searching
            this.typeahead_view.collection.forEach(c => c.updateLastMessage());

            // Show the new contact view if we already have results
            if (this.typeahead_view.collection.length === 0) {
              this.new_contact_view.$el.show();
            }
          })
        );
        /* eslint-enable more/no-then */
        this.trigger('show');
      } else {
        this.resetTypeahead();
      }
    },

    initNewContact() {
      if (this.new_contact_view) {
        this.new_contact_view.undelegateEvents();
        this.new_contact_view.$el.hide();
      }
      const model = new Whisper.Conversation({ type: 'private' });
      this.new_contact_view = new Whisper.NewContactView({
        el: this.$new_contact,
        model,
      }).render();
    },

    async createConversation() {
      const isValidNumber = this.new_contact_view.model.isValid();
      if (!isValidNumber) {
        this.$input.focus();
        return;
      }

      const newConversationId = this.new_contact_view.model.id;
      const conversation = await ConversationController.getOrCreateAndWait(
        newConversationId,
        'private'
      );
      this.trigger('open', conversation);
      this.initNewContact();
      this.resetTypeahead();
    },

    reset() {
      this.delegateEvents();
      this.typeahead_view.delegateEvents();
      this.new_contact_view.delegateEvents();
      this.resetTypeahead();
    },

    resetTypeahead() {
      this.hideHints();
      this.new_contact_view.$el.hide();
      this.$input.val('').focus();
      this.typeahead_view.collection.reset([]);
      this.trigger('hide');
    },

    showHints() {
      if (!this.hintView) {
        this.hintView = new Whisper.HintView({
          className: 'contact placeholder',
          content: i18n('newPhoneNumber'),
        }).render();
        this.hintView.$el.insertAfter(this.$input);
      }
      this.hintView.$el.show();
    },

    hideHints() {
      if (this.hintView) {
        this.hintView.remove();
        this.hintView = null;
      }
    },
  });
})();
