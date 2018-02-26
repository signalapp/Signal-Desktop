/* global ConversationController: false */
/* global i18n: false */
/* global Whisper: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const isSearchable = conversation =>
    conversation.isSearchable();

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
      return {
        number: i18n('newContact'),
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
      // View to display the matched contacts from typeahead
      this.typeahead_view = new Whisper.ConversationListView({
        collection: new Whisper.ConversationCollection([], {
          comparator(m) { return m.getTitle().toLowerCase(); },
        }),
      });
      this.$el.append(this.typeahead_view.el);
      this.initNewContact();
      // this.listenTo(this.collection, 'reset', this.filterContacts);
      this.pending = Promise.resolve();
    },

    events: {
      'click .new-contact': 'createConversation',
    },

    filterContacts() {
      const query = this.$input.val().trim();
      if (query.length) {
        if (this.maybeNumber(query)) {
          this.new_contact_view.model.set('id', query);
          this.new_contact_view.render().$el.show();
          this.new_contact_view.validate();
          this.hideHints();
        } else {
          this.new_contact_view.$el.hide();
        }
        // NOTE: Temporarily allow `then` until we convert the entire file
        // to `async` / `await`:
        /* eslint-disable more/no-then */
        this.pending = this.pending.then(() => this.typeahead.search(query).then(() => {
          this.typeahead_view.collection.reset(this.typeahead.filter(isSearchable));
        }));
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
      // Creates a view to display a new contact
      this.new_contact_view = new Whisper.NewContactView({
        el: this.$new_contact,
        model: ConversationController.createTemporary({
          type: 'private',
        }),
      }).render();
    },

    createConversation() {
      if (this.new_contact_view.model.isValid()) {
        // NOTE: Temporarily allow `then` until we convert the entire file
        // to `async` / `await`:
        // eslint-disable-next-line more/no-then
        ConversationController.getOrCreateAndWait(
          this.new_contact_view.model.id,
          'private'
        ).then((conversation) => {
          this.trigger('open', conversation);
          this.initNewContact();
          this.resetTypeahead();
        });
      } else {
        this.new_contact_view.$('.number').text(i18n('invalidNumberError'));
        this.$input.focus();
      }
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
      if (this.showAllContacts) {
        // NOTE: Temporarily allow `then` until we convert the entire file
        // to `async` / `await`:
        // eslint-disable-next-line more/no-then
        this.typeahead.fetchAlphabetical().then(() => {
          if (this.typeahead.length > 0) {
            this.typeahead_view.collection.reset(this.typeahead.filter(isSearchable));
          } else {
            this.showHints();
          }
        });
        this.trigger('show');
      } else {
        this.typeahead_view.collection.reset([]);
        this.trigger('hide');
      }
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

    maybeNumber(number) {
      return number.replace(/[\s-.()]*/g, '').match(/^\+?[0-9]*$/);
    },
  });
}());
