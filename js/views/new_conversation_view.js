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

  var typeahead = Backbone.TypeaheadCollection.extend({
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

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'new-conversation',
    initialize: function() {
        this.template = $('#new-conversation').html();
        Mustache.parse(this.template);
        this.$el.html($(Mustache.render(this.template)));
        this.$input = this.$el.find('input.new-message');
        this.$group_update = this.$el.find('.new-group-update-form');

        this.typeahead_collection = new typeahead();
        this.typeahead_view = new Whisper.ConversationListView({
            collection : new Whisper.ConversationCollection({
                comparator: function(m) { return m.getTitle(); }
            }),
            className: 'typeahead'
        });

        this.typeahead_view.$el.appendTo(this.$el.find('.contacts'));
        this.typeahead_collection.fetch({
            conditions: { type: 'private' }
        });

        this.new_contact = new Whisper.ConversationListItemView({
            model: new Whisper.Conversation({
                active_at: null,
                type: 'private'
            })
        }).render();

        this.newGroupUpdateView = new Whisper.NewGroupUpdateView({
            model: new Whisper.Conversation({ type: 'group' }),
            el: this.$group_update
        });
        this.group_members = new Whisper.ConversationCollection();
        this.$el.find('.new-contact').append(this.new_contact.el);
    },

    events: {
        'change input.new-message': 'filterContacts',
        'keyup input.new-message': 'filterContacts',
        'checkbox .contact': 'updateGroup',
        'click .create-group': 'createGroup'
    },

    updateGroup: function(e, data) {
        this.$input.focus();
        if (data.checked) {
            this.group_members.add({id: data.modelId});
        } else {
            this.group_members.remove({id: data.modelId});
        }
        this.group_members
        if (this.group_members.length) {
            this.$group_update.show();
        } else {
            this.$group_update.hide();
        }
    },

    createGroup: function() {
        return this.newGroupUpdateView.avatarInput.getFiles().then(function(avatarFiles) {
            var attributes = {
                type: 'group',
                name: this.$el.find('.new-group-update-form .name').val(),
                avatar: avatarFiles[0],
                members: this.group_members.pluck('id')
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

    reset: function() {
        this.new_contact.$el.hide();
        this.$input.val('').focus();
        this.typeahead_view.collection.reset(this.typeahead_collection.models);
        this.group_members.reset([]);
    },

    filterContacts: function() {
        var query = this.$input.val();
        if (query.length) {
            if (this.maybeNumber(query)) {
                this.new_contact.model.set('id', query);
                this.new_contact.$el.show();
            } else {
                this.new_contact.$el.hide();
            }
            this.typeahead_view.collection.reset(
                this.typeahead_collection.typeahead(query)
            );
        } else {
            this.reset();
        }
    },

    maybeNumber: function(number) {
        return number.match(/^\+?[0-9]*$/);
    }
  });

})();
