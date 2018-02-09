/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';

  var FileView = Whisper.View.extend({
      tagName: 'div',
      className: 'fileView',
      templateName: 'file-view',
      render_attributes: function() {
        return this.model;
      }
  });

  var ImageView = Backbone.View.extend({
      tagName: 'img',
      initialize: function(objectUrl, contentType, blob) {
        loadImage(blob, autoOrientedCanvas => {
          this.source = autoOrientedCanvas.toDataURL();
          this.render();
        }, {
          orientation: true,
        });
      },
      events: {
          'load': 'update',
      },
      update: function() {
        this.trigger('update');
      },
      render: function() {
        if (this.source === null) {
          return this;
        }

        this.$el.attr('src', this.source);
        return this;
      }
  });

  var MediaView = Backbone.View.extend({
      initialize: function(dataUrl, contentType) {
          this.dataUrl = dataUrl;
          this.contentType = contentType;
          this.$el.attr('controls', '');
      },
      events: {
          'canplay': 'canplay'
      },
      canplay: function() {
          this.trigger('update');
      },
      render: function() {
          var $el = $('<source>');
          $el.attr('src', this.dataUrl);
          this.$el.append($el);
          return this;
      }
  });

  var AudioView = MediaView.extend({ tagName: 'audio' });
  var VideoView = MediaView.extend({ tagName: 'video' });

  // Blacklist common file types known to be unsupported in Chrome
  var UnsupportedFileTypes = [
    'audio/aiff',
    'video/quicktime'
  ];

  Whisper.AttachmentView = Backbone.View.extend({
    tagName: 'span',
    className: function() {
      if (this.isImage()) {
        return 'attachment';
      } else {
        return 'attachment bubbled';
      }
    },
    initialize: function(options) {
        this.blob = new Blob([this.model.data], {type: this.model.contentType});
        if (!this.model.size) {
          this.model.size = this.model.data.byteLength;
        }
        if (options.timestamp) {
          this.timestamp = options.timestamp;
        }
    },
    events: {
        'click': 'onclick'
    },
    unload: function() {
        this.blob = null;

        if (this.lightBoxView) {
            this.lightBoxView.remove();
        }
        if (this.fileView) {
            this.fileView.remove();
        }
        if (this.view) {
            this.view.remove();
        }

        this.remove();
    },
    getFileType: function() {
        switch(this.model.contentType) {
            case 'video/quicktime': return 'mov';
            default: return this.model.contentType.split('/')[1];
        }
    },
    onclick: function(e) {
        if (this.isImage()) {
            this.lightBoxView = new Whisper.LightboxView({ model: this });
            this.lightBoxView.render();
            this.lightBoxView.$el.appendTo(this.el);
            this.lightBoxView.$el.trigger('show');
        } else {
            this.saveFile();
        }
    },
    isVoiceMessage: function() {
        if (this.model.flags & textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE) {
          return true;
        }

        // Support for android legacy voice messages
        if (this.isAudio() && this.model.fileName === null) {
          return true;
        }
    },
    isAudio: function() {
        return this.model.contentType.startsWith('audio/');
    },
    isVideo: function() {
        return this.model.contentType.startsWith('video/');
    },
    isImage: function() {
        var type = this.model.contentType;
        return type.startsWith('image/') && type !== 'image/tiff';
    },
    mediaType: function() {
        if (this.isVoiceMessage()) {
          return 'voice';
        } else if (this.isAudio()) {
          return 'audio';
        } else if (this.isVideo()) {
          return 'video';
        } else if (this.isImage()) {
          return 'image';
        }
    },
    displayName: function() {
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
    suggestedName: function() {
        if (this.model.fileName) {
            return this.model.fileName;
        }

        var suggestion = 'signal';
        if (this.timestamp) {
            suggestion += moment(this.timestamp).format('-YYYY-MM-DD-HHmmss');
        }
        var fileType = this.getFileType();
        if (fileType) {
            suggestion += '.' + fileType;
        }
        return suggestion;
    },
    saveFile: function() {
        var url = window.URL.createObjectURL(this.blob, { type: 'octet/stream' });
        var a = $('<a>').attr({ href: url, download: this.suggestedName() });
        a[0].click();
        window.URL.revokeObjectURL(url);
    },
    render: function() {
        if (!this.isImage()) {
          this.renderFileView();
        }
        var View;
        if (this.isImage()) {
            View = ImageView;
        } else if (this.isAudio()) {
            View = AudioView;
        } else if (this.isVideo()) {
            View = VideoView;
        }

        if (!View || _.contains(UnsupportedFileTypes, this.model.contentType)) {
            this.update();
            return this;
        }

        if (!this.objectUrl) {
            this.objectUrl = window.URL.createObjectURL(this.blob);
        }
        this.view = new View(this.objectUrl, this.model.contentType, this.blob);
        this.view.$el.appendTo(this.$el);
        this.listenTo(this.view, 'update', this.update);
        this.view.render();
        if (View !== ImageView) {
          this.timeout = setTimeout(this.onTimeout.bind(this), 5000);
        }
        return this;
    },
    onTimeout: function() {
        // Image or media element failed to load. Fall back to FileView.
        this.stopListening(this.view);
        this.update();
    },
    renderFileView: function() {
        this.fileView = new FileView({
          model: {
            mediaType: this.mediaType(),
            fileName: this.displayName(),
            fileSize: window.filesize(this.model.size),
            altText: i18n('clickToSave')
          }
        });

        this.fileView.$el.appendTo(this.$el.empty());
        this.fileView.render();
        return this;
    },
    update: function() {
        clearTimeout(this.timeout);
        this.trigger('update');
    }
  });

  Whisper.LightboxView = Whisper.View.extend({
      templateName: 'lightbox',
      className: 'modal lightbox',
      initialize: function() {
          this.window = window;
          this.$document = $(this.window.document);
          this.listener = this.onkeyup.bind(this);
          this.$document.on('keyup', this.listener);
      },
      events: {
          'click .save': 'save',
          'click .close': 'remove',
          'click': 'onclick'
      },
      save: function(e) {
            this.model.saveFile();
      },
      onclick: function(e) {
          var $el = this.$(e.target);
          if (!$el.hasClass('image') && !$el.closest('.controls').length ) {
              e.preventDefault();
              this.remove();
              return false;
          }
      },
      onkeyup: function(e) {
          if (e.keyCode === 27) {
              this.remove();
              this.$document.off('keyup', this.listener);
          }
      },
      render_attributes: function() {
          return { url: this.model.objectUrl };
      }
  });

})();
