/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
        model: Whisper.Conversation
    });

    Whisper.ContactPillView = Whisper.View.extend({
        tagName: 'span',
        className: 'recipient',
        events: {
            'click .remove': 'removeModel'
        },
        template: $('#contact_pill').html(),
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

    Whisper.RecipientsInputView = Whisper.View.extend({
        className: 'recipients-input',
        template: $('#recipients-input').html(),
        initialize: function() {
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
            this.typeahead.fetch({ conditions: { type: 'private' } });

            // View to display the matched contacts from typeahead
            this.typeahead_view = new Whisper.ConversationListView({
                collection : new Whisper.ConversationCollection([], {
                    comparator: function(m) { return m.getTitle(); }
                })
            });
            this.$('.contacts').append(this.typeahead_view.el);

            this.initNewContact();
        },

        events: {
            'change input.search': 'filterContacts',
            'keyup input.search': 'filterContacts',
            'select .new-contact': 'addNewRecipient',
            'select .contacts': 'addRecipient',
            'remove .recipient': 'removeRecipient',
        },

        filterContacts: function(e) {
            var query = this.$input.val();
            if (query.length) {
                if (this.maybeNumber(query)) {
                    this.new_contact.model.set('id', query);
                    this.new_contact.render().$el.show();
                } else {
                    this.new_contact.$el.hide();
                }
                this.typeahead_view.collection.reset(
                    this.typeahead.typeahead(query)
                );
            } else {
                this.resetTypeahead();
            }
        },

        initNewContact: function() {
            if (this.new_contact) {
                this.new_contact.undelegateEvents();
                this.new_contact.$el.hide();
            }
            // Creates a view to display a new contact
            this.new_contact = new Whisper.ConversationListItemView({
                el: this.$new_contact,
                model: new Whisper.Conversation({
                    active_at: null,
                    type: 'private',
                    newContact: true
                })
            }).render();
        },

        addNewRecipient: function(e, data) {
            this.recipients.add(this.new_contact.model);
            this.initNewContact();
            this.resetTypeahead();
        },

        addRecipient: function(e, data) {
            this.recipients.add(this.typeahead.remove(data.modelId));
            this.filterContacts();
        },

        removeRecipient: function(e, data) {
            var model = this.recipients.remove(data.modelId);
            if (!model.get('newContact')) {
                this.typeahead.add(model);
            }
            this.filterContacts();
        },

        reset: function() {
            this.typeahead.add(
                this.recipients.filter(function(model) {
                    return !model.get('newContact');
                })
            );
            this.recipients.reset([]);
            this.resetTypeahead();
        },

        resetTypeahead: function() {
            this.new_contact.$el.hide();
            this.$input.val('').focus();
            this.typeahead_view.collection.reset(this.typeahead.models);
        },


        maybeNumber: function(number) {
            return number.match(/^\+?[0-9]*$/);
        }
    });

})();
