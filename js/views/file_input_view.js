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
            this.modal = new Whisper.ModalView({el: $('#file-modal')});
            this.thumb = new Whisper.AttachmentPreviewView();
        },

        events: {
            'change': 'previewImages',
            'click .close': 'deleteFiles',
            'click .paperclip': 'open'
        },

        open: function() {
            this.$input.click();
        },

        addThumb: function(e) {
            this.thumb.src = e.target.result;
            this.$el.find('.paperclip').append(this.thumb.render().el);
        },

        previewImages: function() {
            this.clearForm();
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                var FR = new FileReader();
                if ((files[i].size/1024).toFixed(4) >= 420) {
                    this.modal.open();
                    this.deleteFiles();
                }
                else {
                    FR.onload = this.addThumb.bind(this);
                    FR.readAsDataURL(files[i]);
                }
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
            this.clearForm();
            return Promise.all(promises);
        },

        clearForm: function() {
            this.thumb.remove();
        },

        deleteFiles: function(e) {
            if (e) { e.stopPropagation(); }
            this.clearForm();
            this.$input.wrap('<form>').parent('form').trigger('reset');
            this.$input.unwrap();
        }
    });
})();
