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

    Whisper.FileSizeToast = Whisper.ToastView.extend({
        template: $('#file-size-modal').html()
    });

    Whisper.FileInputView = Backbone.View.extend({
        tagName: 'span',
        className: 'file-input',
        initialize: function() {
            this.$input = this.$el.find('input[type=file]');
            this.thumb = new Whisper.AttachmentPreviewView();
            this.$el.addClass('file-input');
        },

        events: {
            'change': 'previewImages',
            'click .close': 'deleteFiles',
            'click .paperclip': 'open'
        },

        open: function() {
            this.$input.click();
        },

        addThumb: function(src) {
            this.thumb.src = src;
            this.$el.find('.paperclip').append(this.thumb.render().el);
        },

        autoScale: function(file) {
            if (file.type.split('/')[0] !== 'image' || file.size/1024 < 420) {
                // nothing to do
                return Promise.resolve(file);
            }

            return new Promise(function(resolve, reject) {
                // components/blueimp-load-image
                window.loadImage(file, resolve, {
                    maxWidth: 1920,
                    maxHeight: 1920,
                    canvas: true,
                    contain: true
                });
            }).then(this.autoCompress.bind(this));
        },

        autoCompress: function(canvas, numRetries, quality) {
            if (numRetries === undefined) { numRetries = 3; }
            if (quality === undefined) { quality = 0.95; }

            var autoCompress = this.autoCompress.bind(this);

            return new Promise(function(resolve, reject) {
                canvas.toBlob(function(blob) {
                    var kb = blob.size/1024;
                    if (kb < 420 || numRetries === 0) {
                        resolve(blob);
                    } else {
                        quality = quality * 420 / kb;
                        if (quality < 50) {
                            quality = 50;
                            numRetries = 1;
                        }
                        resolve(autoCompress(canvas, numRetries - 1, quality));
                    }
                }, 'image/jpeg', quality);
            });
        },

        previewImages: function() {
            this.clearForm();
            var file = this.$input.prop('files')[0];
            if (!file) { return; }

            var type = file.type.split('/')[0];
            switch (type) {
                case 'audio': this.addThumb('/images/audio.png'); break;
                case 'video': this.addThumb('/images/video.png'); break;
                case 'image':
                    this.oUrl = URL.createObjectURL(file);
                    this.addThumb(this.oUrl);
                    break;
            }

            this.autoScale(file).then(function(blob) {
                var limitKb = 1000000;
                switch (type) {
                    case 'image': limitKb = 420; break;
                    case 'audio': limitKb = 32000; break;
                    case 'video': limitKb = 8000; break;
                }
                if ((blob.size/1024).toFixed(4) >= limitKb) {
                    new Whisper.FileSizeToast({
                        model: {limit: limitKb}
                    }).render();
                    this.deleteFiles();
                }
            }.bind(this));
        },

        hasFiles: function() {
            var files = this.$input.prop('files');
            return files && files.length && files.length > 0;
        },

        getFiles: function() {
            var promises = [];
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                promises.push(this.getFile(files[i]));
            }
            this.clearForm();
            return Promise.all(promises);
        },

        getFile: function(file) {
            file = file || this.$input.prop('files')[0];
            if (file === undefined) { throw 'No file'; }
            return this.autoScale(file).then(this.readFile);
        },

        readFile: function(file) {
            var contentType = file.type;
            return new Promise(function(resolve, reject) {
                var FR = new FileReader();
                FR.onload = function(e) {
                    resolve({data: e.target.result, contentType: contentType});
                };
                FR.readAsArrayBuffer(file);
            });
        },

        clearForm: function() {
            if (this.oUrl) {
                URL.revokeObjectURL(this.oUrl);
                this.oUrl = null;
            }
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
