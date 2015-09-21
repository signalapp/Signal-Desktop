/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var ContactsTypeahead = Backbone.TypeaheadCollection.extend({
        typeaheadAttributes: [
            'name',
            'e164_number',
            'national_number',
            'international_number'
        ],
        database: Whisper.Database,
        storeName: 'conversations',
        model: Whisper.Conversation,
        fetchContacts: function() {
            return this.fetch({ reset: true, conditions: { type: 'private' } });
        }
    });

    Whisper.ContactPillView = Whisper.View.extend({
        tagName: 'span',
        className: 'recipient',
        events: {
            'click .remove': 'removeModel'
        },
        templateName: 'contact_pill',
        initialize: function() {
            var error = this.model.validate(this.model.attributes);
            if (error) {
                this.$el.addClass('error');
            }
        },
        removeModel: function() {
            this.$el.trigger('remove', {modelId: this.model.id});
            this.remove();
        },
        render_attributes: function() {
            return { name: this.model.getTitle() };
        }
    });

    Whisper.RecipientListView = Whisper.ListView.extend({
        itemView: Whisper.ContactPillView
    });

    Whisper.SuggestionView = Whisper.ConversationListItemView.extend({
        className: 'contact-details contact',
        templateName: 'contact_name_and_number',
    });

    Whisper.SuggestionListView = Whisper.ConversationListView.extend({
        itemView: Whisper.SuggestionView
    });

    Whisper.RecipientsInputView = Whisper.View.extend({
        className: 'recipients-input',
        templateName: 'recipients-input',
        initialize: function(options) {
            if (options) {
                this.placeholder = options.placeholder;
            }
            this.render();
            this.$input = this.$('input.search');
            this.$new_contact = this.$('.new-contact');

            // Collection of recipients selected for the new message
            this.recipients = new Whisper.ConversationCollection([], {
                comparator: false
            });

            // View to display the selected recipients
            this.recipients_view = new Whisper.RecipientListView({
                collection: this.recipients,
                el: this.$('.recipients')
            });

            // Collection of contacts to match user input against
            this.typeahead = new ContactsTypeahead();
            this.typeahead.fetchContacts();

            // View to display the matched contacts from typeahead
            this.typeahead_view = new Whisper.SuggestionListView({
                collection : new Whisper.ConversationCollection([], {
                    comparator: function(m) { return m.getTitle().toLowerCase(); }
                })
            });
            this.$('.contacts').append(this.typeahead_view.el);
            this.initNewContact();
            this.listenTo(this.typeahead, 'reset', this.filterContacts);

        },

        render_attributes: function() {
            return { placeholder: this.placeholder || "name or phone number" };
        },

        events: {
            'input input.search': 'filterContacts',
            'select .new-contact': 'addNewRecipient',
            'select .contacts': 'addRecipient',
            'remove .recipient': 'removeRecipient',
        },

        filterContacts: function(e) {
            var query = this.$input.val();
            if (query.length) {
                if (this.maybeNumber(query)) {
                    this.new_contact_view.model.set('id', query);
                    this.new_contact_view.render().$el.show();
                } else {
                    this.new_contact_view.$el.hide();
                }
                this.typeahead_view.collection.reset(
                    this.typeahead.typeahead(query)
                );
            } else {
                this.resetTypeahead();
            }
        },

        initNewContact: function() {
            if (this.new_contact_view) {
                this.new_contact_view.undelegateEvents();
                this.new_contact_view.$el.hide();
            }
            // Creates a view to display a new contact
            this.new_contact_view = new Whisper.ConversationListItemView({
                el: this.$new_contact,
                model: ConversationController.create({
                    type: 'private',
                    newContact: true
                })
            }).render();
        },

        addNewRecipient: function() {
            this.recipients.add(this.new_contact_view.model);
            this.initNewContact();
            this.resetTypeahead();
        },

        addRecipient: function(e, conversation) {
            this.recipients.add(this.typeahead.remove(conversation.id));
            this.resetTypeahead();
        },

        removeRecipient: function(e, data) {
            var model = this.recipients.remove(data.modelId);
            if (!model.get('newContact')) {
                this.typeahead.add(model);
            }
            this.filterContacts();
        },

        reset: function() {
            this.delegateEvents();
            this.typeahead_view.delegateEvents();
            this.recipients_view.delegateEvents();
            this.new_contact_view.delegateEvents();
            this.typeahead.add(
                this.recipients.filter(function(model) {
                    return !model.get('newContact');
                })
            );
            this.recipients.reset([]);
            this.resetTypeahead();
            this.typeahead.fetchContacts();
        },

        resetTypeahead: function() {
            this.new_contact_view.$el.hide();
            this.$input.val('').focus();
            this.typeahead_view.collection.reset([]);
        },


        maybeNumber: function(number) {
            return number.match(/^\+?[0-9]*$/);
        }
    });

})();
