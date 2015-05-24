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

    Whisper.FileSizeToast = Whisper.ToastView.extend({
        template: $('#file-size-modal').html()
    });

    Whisper.FileInputView = Backbone.View.extend({
        tagName: 'span',
        className: 'file-input',
        initialize: function(options) {
            this.$input = this.$('input[type=file]');
            this.thumb = new Whisper.AttachmentPreviewView();
            this.$el.addClass('file-input');
            this.$default = this.$('.default');
            this.window = options.window;
        },

        events: {
            'change': 'previewImages',
            'click .close': 'deleteFiles',
            'click .thumbnail': 'open'
        },

        open: function() {
            // hack
            if (this.window && this.window.chrome && this.window.chrome.fileSystem) {
                this.window.chrome.fileSystem.chooseEntry({type: 'openFile'}, function(entry) {
                    entry.file(function(file) {
                        this.file = file;
                        this.previewImages();
                    }.bind(this));
                }.bind(this));
            } else {
                this.$input.click();
            }
        },

        addThumb: function(src) {
            this.$default.hide();
            this.thumb.src = src;
            this.$('.thumbnail').append(this.thumb.render().el);
        },

        autoScale: function(file) {
            if (file.type.split('/')[0] !== 'image' || file.type === 'image/gif') {
                // nothing to do
                return Promise.resolve(file);
            }

            return new Promise(function(resolve, reject) {
                var url = URL.createObjectURL(file);
                var img = document.createElement('img');
                img.onerror = reject;
                img.onload = function () {
                    URL.revokeObjectURL(url);

                    var maxSize = 420 * 1024;
                    var maxHeight = 1920;
                    var maxWidth = 1920;
                    if (img.width <= maxWidth && img.height <= maxHeight &&
                        file.size <= maxSize) {
                        resolve(file);
                        return;
                    }

                    // loadImage.scale -> components/blueimp-load-image
                    var canvas = loadImage.scale(img, {
                        canvas: true, maxWidth: 1920, maxHeight: 1920
                    });

                    var quality = 0.95;
                    var i = 4;
                    var blob;
                    do {
                        i = i - 1;
                        // dataURLtoBlob -> components/blueimp-canvas-to-blob
                        blob = dataURLtoBlob(
                            canvas.toDataURL('image/jpeg', quality)
                        );
                        quality = quality * maxSize / blob.size;
                        if (quality < 50) {
                            quality = 50;
                            i = 1;
                        }
                    } while (i > 0 && blob.size > maxSize);

                    resolve(blob);
                };
                img.src = url;
            });
        },

        previewImages: function() {
            this.clearForm();
            var file = this.file || this.$input.prop('files')[0];
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
            var files = this.file ? [this.file] : this.$input.prop('files');
            return files && files.length && files.length > 0;
        },

        getFiles: function() {
            var promises = [];
            var files = this.file ? [this.file] : this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                promises.push(this.getFile(files[i]));
            }
            this.clearForm();
            return Promise.all(promises);
        },

        getFile: function(file) {
            file = file || this.file || this.$input.prop('files')[0];
            if (file === undefined) { return Promise.resolve(); }
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
            this.$default.show();
        },

        deleteFiles: function(e) {
            if (e) { e.stopPropagation(); }
            this.clearForm();
            this.$input.wrap('<form>').parent('form').trigger('reset');
            this.$input.unwrap();
            this.file = null;
        }
    });
})();
