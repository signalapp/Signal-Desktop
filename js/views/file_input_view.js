/* global textsecure: false */
/* global Whisper: false */
/* global i18n: false */
/* global loadImage: false */
/* global Backbone: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { MIME } = window.Signal.Types;

  Whisper.FileSizeToast = Whisper.ToastView.extend({
    templateName: 'file-size-modal',
    render_attributes() {
      return {
        'file-size-warning': i18n('fileSizeWarning'),
        limit: this.model.limit,
        units: this.model.units,
      };
    },
  });
  Whisper.UnsupportedFileTypeToast = Whisper.ToastView.extend({
    template: i18n('unsupportedFileType'),
  });

  function makeThumbnail(size, objectUrl) {
    return new Promise(((resolve, reject) => {
      const img = document.createElement('img');
      img.onerror = reject;
      img.onload = () => {
        // using components/blueimp-load-image

        // first, make the correct size
        let canvas = loadImage.scale(img, {
          canvas: true,
          cover: true,
          maxWidth: size,
          maxHeight: size,
          minWidth: size,
          minHeight: size,
        });

        // then crop
        canvas = loadImage.scale(canvas, {
          canvas: true,
          crop: true,
          maxWidth: size,
          maxHeight: size,
          minWidth: size,
          minHeight: size,
        });

        const blob = window.dataURLToBlobSync(canvas.toDataURL('image/png'));

        resolve(blob);
      };
      img.src = objectUrl;
    }));
  }

  Whisper.FileInputView = Backbone.View.extend({
    tagName: 'span',
    className: 'file-input',
    initialize(options) {
      this.$input = this.$('input[type=file]');
      this.$input.click((e) => {
        e.stopPropagation();
      });
      this.thumb = new Whisper.AttachmentPreviewView();
      this.$el.addClass('file-input');
      this.window = options.window;
      this.previewObjectUrl = null;
    },

    events: {
      'change .choose-file': 'previewImages',
      'click .close': 'deleteFiles',
      'click .choose-file': 'open',
      drop: 'openDropped',
      dragover: 'showArea',
      dragleave: 'hideArea',
      paste: 'onPaste',
    },

    open(e) {
      e.preventDefault();
      // hack
      if (this.window && this.window.chrome && this.window.chrome.fileSystem) {
        this.window.chrome.fileSystem.chooseEntry({ type: 'openFile' }, (entry) => {
          if (!entry) {
            return;
          }
          entry.file((file) => {
            this.file = file;
            this.previewImages();
          });
        });
      } else {
        this.$input.click();
      }
    },

    addThumb(src) {
      this.$('.avatar').hide();
      this.thumb.src = src;
      this.$('.attachment-previews').append(this.thumb.render().el);
      this.thumb.$('img')[0].onload = () => {
        this.$el.trigger('force-resize');
      };
    },

    autoScale(file) {
      if (file.type.split('/')[0] !== 'image' ||
                file.type === 'image/gif' ||
                file.type === 'image/tiff') {
        // nothing to do
        return Promise.resolve(file);
      }

      return new Promise(((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.onerror = reject;
        img.onload = () => {
          URL.revokeObjectURL(url);

          const maxSize = 6000 * 1024;
          const maxHeight = 4096;
          const maxWidth = 4096;
          if (img.width <= maxWidth && img.height <= maxHeight && file.size <= maxSize) {
            resolve(file);
            return;
          }

          const canvas = loadImage.scale(img, {
            canvas: true, maxWidth, maxHeight,
          });

          let quality = 0.95;
          let i = 4;
          let blob;
          do {
            i -= 1;
            blob = window.dataURLToBlobSync(canvas.toDataURL('image/jpeg', quality));
            quality = (quality * maxSize) / blob.size;
            // NOTE: During testing with a large image, we observed the
            // `quality` value being > 1. Should we clamp it to [0.5, 1.0]?
            // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Syntax
            if (quality < 0.5) {
              quality = 0.5;
            }
          } while (i > 0 && blob.size > maxSize);

          resolve(blob);
        };
        img.src = url;
      }));
    },

    previewImages() {
      this.clearForm();
      const file = this.file || this.$input.prop('files')[0];
      if (!file) { return; }

      let type = file.type.split('/')[0];
      if (file.type === 'image/tiff') {
        type = 'file';
      }
      switch (type) {
        case 'audio': this.addThumb('images/audio.svg'); break;
        case 'video': this.addThumb('images/video.svg'); break;
        case 'image':
          if (!MIME.isJPEG(file.type)) {
            this.previewObjectUrl = URL.createObjectURL(file);
            this.addThumb(this.previewObjectUrl);
            break;
          }

          // NOTE: Temporarily allow `then` until we convert the entire file
          // to `async` / `await`:
          // eslint-disable-next-line more/no-then
          window.autoOrientImage(file)
            .then(dataURL => this.addThumb(dataURL));
          break;
        default:
          this.addThumb('images/file.svg'); break;
      }

      // NOTE: Temporarily allow `then` until we convert the entire file
      // to `async` / `await`:
      // eslint-disable-next-line more/no-then
      this.autoScale(file).then((blob) => {
        let limitKb = 1000000;
        const blobType = file.type === 'image/gif' ? 'gif' : type;
        switch (blobType) {
          case 'image':
            limitKb = 6000; break;
          case 'gif':
            limitKb = 25000; break;
          case 'audio':
            limitKb = 100000; break;
          case 'video':
            limitKb = 100000; break;
          default:
            limitKb = 100000; break;
        }
        if ((blob.size / 1024).toFixed(4) >= limitKb) {
          const units = ['kB', 'MB', 'GB'];
          let u = -1;
          let limit = limitKb * 1000;
          do {
            limit /= 1000;
            u += 1;
          } while (limit >= 1000 && u < units.length - 1);
          const toast = new Whisper.FileSizeToast({
            model: { limit, units: units[u] },
          });
          toast.$el.insertAfter(this.$el);
          toast.render();
          this.deleteFiles();
        }
      });
    },

    hasFiles() {
      const files = this.file ? [this.file] : this.$input.prop('files');
      return files && files.length && files.length > 0;
    },

    getFiles() {
      const files = this.file ? [this.file] : Array.from(this.$input.prop('files'));
      const promise = Promise.all(files.map(file => this.getFile(file)));
      this.clearForm();
      return promise;
    },

    getFile(rawFile) {
      const file = rawFile || this.file || this.$input.prop('files')[0];
      if (file === undefined) {
        return Promise.resolve();
      }
      const attachmentFlags = this.isVoiceNote
        ? textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE
        : null;

      const setFlags = flags => (attachment) => {
        const newAttachment = Object.assign({}, attachment);
        if (flags) {
          newAttachment.flags = flags;
        }
        return newAttachment;
      };

      // NOTE: Temporarily allow `then` until we convert the entire file
      // to `async` / `await`:
      // eslint-disable-next-line more/no-then
      return this.autoScale(file)
        .then(this.readFile)
        .then(setFlags(attachmentFlags));
    },

    getThumbnail() {
      // Scale and crop an image to 256px square
      const size = 256;
      const file = this.file || this.$input.prop('files')[0];
      if (file === undefined ||
        file.type.split('/')[0] !== 'image' ||
        file.type === 'image/gif') {
        // nothing to do
        return Promise.resolve();
      }

      const objectUrl = URL.createObjectURL(file);

      // eslint-disable-next-line more/no-then
      return makeThumbnail(size, objectUrl).then((arrayBuffer) => {
        URL.revokeObjectURL(objectUrl);
        return this.readFile(arrayBuffer);
      });
    },

    // File -> Promise Attachment
    readFile(file) {
      return new Promise(((resolve, reject) => {
        const FR = new FileReader();
        FR.onload = (e) => {
          resolve({
            data: e.target.result,
            contentType: file.type,
            fileName: file.name,
            size: file.size,
          });
        };
        FR.onerror = reject;
        FR.onabort = reject;
        FR.readAsArrayBuffer(file);
      }));
    },

    clearForm() {
      if (this.previewObjectUrl) {
        URL.revokeObjectURL(this.previewObjectUrl);
        this.previewObjectUrl = null;
      }

      this.thumb.remove();
      this.$('.avatar').show();
      this.$el.trigger('force-resize');
    },

    deleteFiles(e) {
      if (e) { e.stopPropagation(); }
      this.clearForm();
      this.$input.wrap('<form>').parent('form').trigger('reset');
      this.$input.unwrap();
      this.file = null;
      this.$input.trigger('change');
      this.isVoiceNote = false;
    },

    openDropped(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      // eslint-disable-next-line prefer-destructuring
      this.file = e.originalEvent.dataTransfer.files[0];
      this.previewImages();
      this.$el.removeClass('dropoff');
    },

    showArea(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      this.$el.addClass('dropoff');
    },

    hideArea(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      this.$el.removeClass('dropoff');
    },
    onPaste(e) {
      const { items } = e.originalEvent.clipboardData;
      let imgBlob = null;
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.split('/')[0] === 'image') {
          imgBlob = items[i].getAsFile();
        }
      }
      if (imgBlob !== null) {
        this.file = imgBlob;
        this.previewImages();
      }
    },
  });

  Whisper.FileInputView.makeThumbnail = makeThumbnail;
}());
