/* global $: false */
/* global _: false */
/* global Backbone: false */
/* global filesize: false */
/* global moment: false */

/* global i18n: false */
/* global Signal: false */
/* global textsecure: false */
/* global Whisper: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  const FileView = Whisper.View.extend({
    tagName: 'div',
    className: 'fileView',
    templateName: 'file-view',
    render_attributes() {
      return this.model;
    },
  });

  const ImageView = Backbone.View.extend({
    tagName: 'img',
    initialize(blobUrl) {
      this.blobUrl = blobUrl;
    },
    events: {
      load: 'update',
    },
    update() {
      this.trigger('update');
    },
    render() {
      this.$el.attr('src', this.blobUrl);
      return this;
    },
  });

  const MediaView = Backbone.View.extend({
    initialize(dataUrl, { contentType } = {}) {
      this.dataUrl = dataUrl;
      this.contentType = contentType;
      this.$el.attr('controls', '');
    },
    events: {
      canplay: 'canplay',
    },
    canplay() {
      this.trigger('update');
    },
    render() {
      const $el = $('<source>');
      $el.attr('src', this.dataUrl);
      this.$el.append($el);
      return this;
    },
  });

  const AudioView = MediaView.extend({ tagName: 'audio' });
  const VideoView = MediaView.extend({ tagName: 'video' });

  // Blacklist common file types known to be unsupported in Chrome
  const unsupportedFileTypes = [
    'audio/aiff',
    'video/quicktime',
  ];

  Whisper.AttachmentView = Backbone.View.extend({
    tagName: 'div',
    className() {
      if (this.isImage()) {
        return 'attachment';
      }
      return 'attachment bubbled';
    },
    initialize(options) {
      this.blob = new Blob([this.model.data], { type: this.model.contentType });
      if (!this.model.size) {
        this.model.size = this.model.data.byteLength;
      }
      if (options.timestamp) {
        this.timestamp = options.timestamp;
      }
    },
    events: {
      click: 'onClick',
    },
    unload() {
      this.blob = null;

      if (this.lightboxView) {
        this.lightboxView.remove();
      }
      if (this.fileView) {
        this.fileView.remove();
      }
      if (this.view) {
        this.view.remove();
      }

      this.remove();
    },
    getFileType() {
      switch (this.model.contentType) {
        case 'video/quicktime': return 'mov';
        default: return this.model.contentType.split('/')[1];
      }
    },
    onClick() {
      if (!this.isImage()) {
        this.saveFile();
        return;
      }

      const props = {
        imageURL: this.objectUrl,
        onSave: () => this.saveFile(),
        // implicit: `close`
      };
      this.lightboxView = new Whisper.ReactWrapperView({
        Component: Signal.Components.Lightbox,
        props,
        onClose: () => Signal.Backbone.Views.Lightbox.hide(),
      });
      Signal.Backbone.Views.Lightbox.show(this.lightboxView.el);
    },
    isVoiceMessage() {
      // eslint-disable-next-line no-bitwise
      if (this.model.flags & textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE) {
        return true;
      }

      // Support for android legacy voice messages
      if (this.isAudio() && this.model.fileName === null) {
        return true;
      }

      return false;
    },
    isAudio() {
      const { contentType } = this.model;
      return Signal.Types.MIME.isAudio(contentType);
    },
    isVideo() {
      const { contentType } = this.model;
      return Signal.Types.MIME.isVideo(contentType);
    },
    isImage() {
      const { contentType } = this.model;
      return Signal.Types.MIME.isImage(contentType);
    },
    mediaType() {
      if (this.isVoiceMessage()) {
        return 'voice';
      } else if (this.isAudio()) {
        return 'audio';
      } else if (this.isVideo()) {
        return 'video';
      } else if (this.isImage()) {
        return 'image';
      }

      // NOTE: The existing code had no `return` but ESLint insists. Thought
      // about throwing an error assuming this was unreachable code but it turns
      // out that content type `image/tiff` falls through here:
      return undefined;
    },
    displayName() {
      if (this.isVoiceMessage()) {
        return i18n('voiceMessage');
      }
      if (this.model.fileName) {
        return this.model.fileName;
      }
      if (this.isAudio() || this.isVideo()) {
        return i18n('mediaMessage');
      }

      return i18n('unnamedFile');
    },
    suggestedName() {
      if (this.model.fileName) {
        return this.model.fileName;
      }

      let suggestion = 'signal';
      if (this.timestamp) {
        suggestion += moment(this.timestamp).format('-YYYY-MM-DD-HHmmss');
      }
      const fileType = this.getFileType();
      if (fileType) {
        suggestion += `.${fileType}`;
      }
      return suggestion;
    },
    saveFile() {
      const url = window.URL.createObjectURL(this.blob, { type: 'octet/stream' });
      const a = $('<a>').attr({ href: url, download: this.suggestedName() });
      a[0].click();
      window.URL.revokeObjectURL(url);
    },
    render() {
      if (!this.isImage()) {
        this.renderFileView();
      }
      let View;
      if (this.isImage()) {
        View = ImageView;
      } else if (this.isAudio()) {
        View = AudioView;
      } else if (this.isVideo()) {
        View = VideoView;
      }

      if (!View || _.contains(unsupportedFileTypes, this.model.contentType)) {
        this.update();
        return this;
      }

      if (!this.objectUrl) {
        this.objectUrl = window.URL.createObjectURL(this.blob);
      }

      const { blob } = this;
      const { contentType } = this.model;
      this.view = new View(this.objectUrl, { blob, contentType });
      this.view.$el.appendTo(this.$el);
      this.listenTo(this.view, 'update', this.update);
      this.view.render();
      if (View !== ImageView) {
        this.timeout = setTimeout(this.onTimeout.bind(this), 5000);
      }
      return this;
    },
    onTimeout() {
      // Image or media element failed to load. Fall back to FileView.
      this.stopListening(this.view);
      this.update();
    },
    renderFileView() {
      this.fileView = new FileView({
        model: {
          mediaType: this.mediaType(),
          fileName: this.displayName(),
          fileSize: filesize(this.model.size),
          altText: i18n('clickToSave'),
        },
      });

      this.fileView.$el.appendTo(this.$el.empty());
      this.fileView.render();
      return this;
    },
    update() {
      clearTimeout(this.timeout);
      this.trigger('update');
    },
  });
}());
