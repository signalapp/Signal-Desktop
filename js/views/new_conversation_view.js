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
      typeaheadAttributes: ['name'],
      database: Whisper.Database,
      storeName: 'conversations',
      model: Whisper.Conversation,

      comparator: function(m) {
          return m.get('name');
      },

      _tokenize: function(s) {
          s = $.trim(s);
          if (s.length === 0) {
              return null;
          }

          return s.toLowerCase().split(/[\s\-_+]+/)
      }
  });

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'new-conversation',
    initialize: function() {
      this.template = $('#new-conversation').html();
      Mustache.parse(this.template);
      this.$el.html($(Mustache.render(this.template)));
      this.input = new Whisper.PhoneInputView({
          el: this.$el.find('div.phone-number-input')
      });

      this.typeahead_collection = new typeahead();
      this.typeahead_view = new Whisper.ConversationListView({
          collection : new Whisper.ConversationCollection(),
          className: 'typeahead'
      });

      this.typeahead_view.$el.appendTo(this.$el.find('.contacts'));
      this.typeahead_collection.fetch();
    },

    filterContacts: function(query) {
        if (query.length) {
            this.typeahead_view.collection.reset(
                this.typeahead_collection.typeahead(query)
            );
        }
    }
  });

})();
