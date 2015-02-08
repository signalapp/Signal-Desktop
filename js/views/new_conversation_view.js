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
var Whisper = Whisper || {};

(function () {
  'use strict';

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

  Whisper.ContactPillView = Backbone.View.extend({
    tagName: 'span',
    className: 'recipient',
    events: {
      'click .remove': 'removeModel'
    },
    initialize: function() {
      this.template = $('#contact_pill').html();
      Mustache.parse(this.template);

      var error = this.model.validate(this.model.attributes);
      if (error) {
        this.$el.addClass('error');
      }
    },
    removeModel: function() {
      this.$el.trigger('remove', {modelId: this.model.id});
      this.remove();
    },
    render: function() {
      this.$el.html(
        Mustache.render(this.template, { name: this.model.getTitle() })
      );
      return this;
    }
  });

  Whisper.RecipientListView = Whisper.ListView.extend({
    itemView: Whisper.ContactPillView
  });

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'new-conversation',
    initialize: function() {
        this.template = $('#new-conversation').html();
        Mustache.parse(this.template);
        this.$el.html($(Mustache.render(this.template)));
        this.$group_update = this.$el.find('.new-group-update-form');
        this.$buttons = this.$el.find('.buttons');
        this.$input = this.$el.find('input.new-message');
        this.$new_contact = this.$el.find('.new-contact');

        // Collection of contacts to match user input against
        this.typeahead = new ContactsTypeahead();
        this.typeahead.fetch({ conditions: { type: 'private' } });

        // View to display the matched contacts from typeahead
        this.typeahead_view = new Whisper.ConversationListView({
            collection : new Whisper.ConversationCollection([], {
                comparator: function(m) { return m.getTitle(); }
            })
        });
        this.$el.find('.contacts').append(this.typeahead_view.el);

        this.initNewContact();

        // Group avatar file input
        this.avatarInput = new Whisper.FileInputView({
            el: this.$el.find('.group-avatar')
        });

        // Collection of recipients selected for the new message
        this.recipients = new Whisper.ConversationCollection([], {
            comparator: false
        });
        // View to display the selected recipients
        this.recipients_view = new Whisper.RecipientListView({
            collection: this.recipients,
            el: this.$el.find('.recipients')
        });
    },

    events: {
        'change input.new-message': 'filterContacts',
        'keyup input.new-message': 'filterContacts',
        'select .new-contact': 'addNewRecipient',
        'select .contacts': 'addRecipient',
        'remove .recipient': 'removeRecipient',
        'click .create': 'create'
    },

    initNewContact: function() {
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
        this.updateControls();
    },

    addRecipient: function(e, data) {
        this.recipients.add(this.typeahead.remove(data.modelId));
        this.filterContacts();
        this.updateControls();
    },

    removeRecipient: function(e, data) {
        var model = this.recipients.remove(data.modelId);
        if (!model.get('newContact')) {
            this.typeahead.add(model);
        }
        this.filterContacts();
        this.updateControls();
    },

    updateControls: function() {
        if (this.recipients.length > 0) {
            this.$buttons.slideDown();
        } else {
            this.$buttons.slideUp();
        }
        if (this.recipients.length > 1) {
            this.$group_update.slideDown();
        } else {
            this.$group_update.slideUp();
        }
        this.$input.focus();
    },

    create: function() {
        var errors = this.recipients_view.$el.find('.error');
        if (errors.length) {

            // TODO: css animation or error notification
            errors.removeClass('error');
            setTimeout(function(){ errors.addClass('error'); }, 300);

            return;
        }
        if (this.recipients.length > 1) {
            this.createGroup();
        } else {
            this.createConversation();
        }
    },

    createConversation: function() {
        var conversation = new Whisper.Conversation({
            active_at: null,
            id: this.recipients.at(0).id,
            type: 'private'
        });
        conversation.fetch().fail(function() {
            if (conversation.save()) {
                this.$el.trigger('open', { modelId: conversation.id });
            }
        });
    },

    createGroup: function() {
        return this.avatarInput.getFiles().then(function(avatarFiles) {
            var attributes = {
                type: 'group',
                name: this.$el.find('.new-group-update-form .name').val(),
                avatar: avatarFiles[0],
                members: this.recipients.pluck('id')
            };
            return textsecure.messaging.createGroup(
                attributes.members, attributes.name, attributes.avatar
            ).then(function(groupId) {
                var id = getString(groupId);
                var group = new Whisper.Conversation(attributes);
                group.save({ id: id, groupId: id }).then(function() {
                    this.$el.trigger('open', {modelId: id});
                }.bind(this));
            }.bind(this));
        }.bind(this));
    },

    resetTypeahead: function() {
        this.new_contact.$el.hide();
        this.$input.val('').focus();
        this.typeahead_view.collection.reset(this.typeahead.models);
    },

    reset: function() {
        this.$buttons.hide();
        this.$group_update.hide();
        this.typeahead.add(
            this.recipients.filter(function(model) {
                return !model.get('newContact');
            })
        );
        this.recipients.reset([]);
        this.resetTypeahead();
    },

    filterContacts: function() {
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

    maybeNumber: function(number) {
        return number.match(/^\+?[0-9]*$/);
    }
  });

})();
