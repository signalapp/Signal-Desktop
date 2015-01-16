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
    Whisper.FileInputView = Backbone.View.extend({
        tagName: 'span',
        className: 'file-input',
        initialize: function() {
            this.$input = this.$el.find('input[type=file]');
        },

        events: {
            'change': 'previewImages'
        },

        addThumb: function(e) {
          this.$el.append(
            $('<img>').attr( "src", e.target.result ).addClass('preview')
          );
        },

        previewImages: function() {
            this.$el.find('img').remove();
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                var FR = new FileReader();
                FR.onload = this.addThumb.bind(this);
                FR.readAsDataURL(files[i]);
            }
        },

        hasFiles: function() {
            var files = this.$input.prop('files');
            return files && files.length && files.length > 0;
        },

        getFiles: function() {
            var promises = [];
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                var contentType = files[i].type;
                var p = new Promise(function(resolve, reject) {
                  var FR = new FileReader();
                  FR.onload = function(e) {
                    resolve({data: e.target.result, contentType: contentType});
                  };
                  FR.readAsArrayBuffer(files[i]);
                }.bind(this));
                promises.push(p);
            }
            this.$el.find('img').remove();
            return Promise.all(promises);
        }

    });
})();
