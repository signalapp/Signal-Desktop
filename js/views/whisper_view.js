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

    Whisper.View = Backbone.View.extend({
        constructor: function() {
            Backbone.View.apply(this, arguments);
            Mustache.parse(_.result(this, 'template'));
        },
        render_attributes: function() {
            return _.result(this.model, 'attributes', {});
        },
        render_partials: function() {
            return {
                avatar: this.avatar_template
            };
        },
        render: function() {
            var attrs = _.result(this, 'render_attributes', {});
            var template = _.result(this, 'template', '');
            var partials = _.result(this, 'render_partials', '');
            this.$el.html(Mustache.render(template, attrs, partials));
            return this;
        },
        avatar_template: $('#avatar').html()
    });
})();
