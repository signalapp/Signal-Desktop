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
            'click .close': 'deleteFiles'
        },

        addThumb: function(url) {
            this.thumb.src = url;
            this.$el.append(this.thumb.render().el);
        },

        previewImages: function() {
            this.clearForm();
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                var FR = new FileReader();
                var isImage = files[i].type.indexOf('image') >= 0;
                if (!isImage) {
                    this.modal.msg = "This file is not a valid image. Please attach an image.";
                    this.modal.render();
                    this.modal.open();
                    this.deleteFiles();
                } else {
                    var isValidSize = this.compress.bind(this);
                    if (!isValidSize) {
                        this.modal.msg = "This file exceeds 420KB. Please attach a smaller file.";
                        this.modal.render();
                        this.modal.open();
                        this.deleteFiles();
                    } else {
                        FR.onload = isValidSize;
                        FR.readAsDataURL(this.currentBlob);
                    }
                }
            }
        },

        compress: function(e) {
            var image = new Image();
            image.src = e.target.result;
            var currentSize = 0;

            var canvas = $('document').create('canvas');
            var quality = 0.95;
            var previousSize = 0;
            var i = 0;
            var done = false;
            do {
                canvas.width = image.width;
                canvas.height = image.height;
                var maxSize = Math.max(image.width, image.height);
                if (i > 0) {
                    quality = (Math.max(quality * maxSize / previousSize, 50) / 100).toFixed(2);
                }
                var context = canvas.getContext('2d').drawImage(image, 0, 0, image.width, image.height);
                this.currentBlob = canvas.toBlob();
                currentSize = currentBlob.size;
                image.src = canvas.toDataURL("image/jpeg", quality);
                previousSize = maxSize;
                if (image.width <= 1920 && image.height <= 1920) {
                    done = true;
                }
                i++;
            } while (i < 4 && !done)

            if (image.width > 1920 || image.height > 1920 || currentSize/1024 > 420) {
                return false;
            } else {
                this.addThumb(image.src);
                return true;
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

        deleteFiles: function() {
            this.clearForm();
            this.$input.wrap('<form>').parent('form').trigger('reset');
            this.$input.unwrap();
        }
    });
})();
