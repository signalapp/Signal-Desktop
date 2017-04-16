/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.FileSizeToast = Whisper.ToastView.extend({
        templateName: 'file-size-modal',
        render_attributes: function() {
            return {
                'file-size-warning': i18n('fileSizeWarning'),
                limit: this.model.limit,
                units: this.model.units
            };
        }
    });
    Whisper.UnsupportedFileTypeToast = Whisper.ToastView.extend({
        template: i18n('unsupportedFileType')
    });

    Whisper.FileInputView = Backbone.View.extend({
        tagName: 'span',
        className: 'file-input',
        initialize: function(options) {
            this.$input = this.$('input[type=file]');
            this.thumb = new Whisper.AttachmentPreviewView();
            this.$el.addClass('file-input');
            this.window = options.window;
        },

        events: {
            'change .choose-file': 'previewImages',
            'click .close': 'deleteFiles',
            'click .choose-file': 'open',
            'drop': 'openDropped',
            'dragover': 'showArea',
            'dragleave': 'hideArea',
            'paste': 'onPaste'
        },

        open: function(e) {
            e.preventDefault();
            // hack
            if (this.window && this.window.chrome && this.window.chrome.fileSystem) {
                this.window.chrome.fileSystem.chooseEntry({type: 'openFile'}, function(entry) {
                    if (!entry) {
                        return;
                    }
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
            this.$('.avatar').hide();
            this.thumb.src = src;
            this.$('.attachment-previews').append(this.thumb.render().el);
            this.thumb.$('img')[0].onload = function() {
                this.$el.trigger('force-resize');
            }.bind(this);
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

                    var maxSize = 6000 * 1024;
                    var maxHeight = 4096;
                    var maxWidth = 4096;
                    if (img.width <= maxWidth && img.height <= maxHeight &&
                        file.size <= maxSize) {
                        resolve(file);
                        return;
                    }

                    // loadImage.scale -> components/blueimp-load-image
                    var canvas = loadImage.scale(img, {
                        canvas: true, maxWidth: maxWidth, maxHeight: maxHeight
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
                        if (quality < 0.5) {
                            quality = 0.5;
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
                case 'audio': this.addThumb('/images/audio.svg'); break;
                case 'video': this.addThumb('/images/video.svg'); break;
                case 'image':
                    this.oUrl = URL.createObjectURL(file);
                    this.addThumb(this.oUrl);
                    break;
                default:
                    this.addThumb('/images/file.svg'); break;
            }

            this.autoScale(file).then(function(blob) {
                var limitKb = 1000000;
                var blobType = file.type === 'image/gif' ? 'gif' : type;
                switch (blobType) {
                    case 'image':
                        limitKb = 6000; break;
                    case 'gif':
                        limitKb = 25000; break;
                    case 'audio':
                        limitKb = 100000; break;
                    case 'video':
                        limitKb = 100000; break;
                }
                if ((blob.size/1024).toFixed(4) >= limitKb) {
                    var units = ['kB','MB','GB'];
                    var u = -1;
                    var limit = limitKb * 1000;
                    do {
                      limit /= 1000;
                      ++u;
                    } while (limit >= 1000 && u < units.length - 1);
                    var toast = new Whisper.FileSizeToast({
                        model: {limit: limit, units: units[u]}
                    });
                    toast.$el.insertAfter(this.$el);
                    toast.render();
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

        getThumbnail: function() {
            // Scale and crop an image to 256px square
            var size = 256;
            var file = this.file || this.$input.prop('files')[0];
            if (file === undefined || file.type.split('/')[0] !== 'image' || file.type === 'image/gif') {
                // nothing to do
                return Promise.resolve();
            }

            return new Promise(function(resolve, reject) {
                var url = URL.createObjectURL(file);
                var img = document.createElement('img');
                img.onerror = reject;
                img.onload = function () {
                    URL.revokeObjectURL(url);
                    // loadImage.scale -> components/blueimp-load-image
                    // scale, then crop.
                    var canvas = loadImage.scale(img, {
                        canvas: true, maxWidth: size, maxHeight: size,
                        cover: true, minWidth: size, minHeight: size
                    });
                    canvas = loadImage.scale(canvas, {
                        canvas: true, maxWidth: size, maxHeight: size,
                        crop: true, minWidth: size, minHeight: size
                    });

                    // dataURLtoBlob -> components/blueimp-canvas-to-blob
                    var blob = dataURLtoBlob(canvas.toDataURL('image/png'));

                    resolve(blob);
                };
                img.src = url;
            }).then(this.readFile);
        },

        readFile: function(file) {
            return new Promise(function(resolve, reject) {
                var FR = new FileReader();
                FR.onload = function(e) {
                    resolve({
                      data: e.target.result,
                      contentType: file.type,
                      fileName: file.name,
                      size: file.size
                    });
                };
                FR.onerror = reject;
                FR.onabort = reject;
                FR.readAsArrayBuffer(file);
            });
        },

        clearForm: function() {
            if (this.oUrl) {
                URL.revokeObjectURL(this.oUrl);
                this.oUrl = null;
            }
            this.thumb.remove();
            this.$('.avatar').show();
            this.$el.trigger('force-resize');
        },

        deleteFiles: function(e) {
            if (e) { e.stopPropagation(); }
            this.clearForm();
            this.$input.wrap('<form>').parent('form').trigger('reset');
            this.$input.unwrap();
            this.file = null;
            this.$input.trigger('change');
        },

        openDropped: function(e) {
            if (e.originalEvent.dataTransfer.types[0] != 'Files') {
                return;
            }

            e.stopPropagation();
            e.preventDefault();
            this.file = e.originalEvent.dataTransfer.files[0];
            this.previewImages();
            this.$el.removeClass('dropoff');
        },

        showArea: function(e) {
            if (e.originalEvent.dataTransfer.types[0] != 'Files') {
                return;
            }

            e.stopPropagation();
            e.preventDefault();
            this.$el.addClass('dropoff');
        },

        hideArea: function(e) {
            if (e.originalEvent.dataTransfer.types[0] != 'Files') {
                return;
            }

            e.stopPropagation();
            e.preventDefault();
            this.$el.removeClass('dropoff');
        },
        onPaste: function(e) {
            var items = e.originalEvent.clipboardData.items;
            var imgBlob = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.split('/')[0] === 'image') {
                   imgBlob = items[i].getAsFile();
                }
            }
            if (imgBlob !== null) {
                this.file = imgBlob;
                this.previewImages();
            }
        }
    });
})();
