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

    /*
    * Generic list view that watches a given collection, wraps its members in
    * a given child view and adds the child view elements to its own element.
    */
    Whisper.ListView = Backbone.View.extend({
        tagName: 'ul',
        itemView: Backbone.View,
        initialize: function() {
            this.listenTo(this.collection, 'change', this.render); // auto update
            this.listenTo(this.collection, 'add', this.addOne);
            this.listenTo(this.collection, 'reset', this.addAll);
            this.listenTo(this.collection, 'all', this.render);
        },

        addOne: function(model) {
        if (this.itemView) {
                var view = new this.itemView({model: model});
                this.$el.append(view.render().el);
                this.$el.trigger('add');
            }
        },

        addAll: function() {
            this.$el.html('');
            this.collection.each(this.addOne, this);
            this.resize();
        },

        resize: function() {
            var height = window.innerHeight - $('#header').height() - $('#footer').height();
            if (this.$el.height() > height) {
                this.$el.css('height', height + 'px');
                this.$el.css('overflow-y', 'scroll');
            } else {
                this.$el.css('height', 'auto');
                this.$el.css('overflow-y', 'auto');
            }
        }
    });
})();
