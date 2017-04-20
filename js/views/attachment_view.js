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
        return {
            fileName : this.model.fileName,
            altText  : i18n('unsupportedAttachment')
        };
      }
  });

  var ImageView = Backbone.View.extend({
      tagName: 'img',
      initialize: function(dataUrl) {
          this.dataUrl = dataUrl;
      },
      events: {
          'load': 'update',
      },
      update: function() {
        this.trigger('update');
      },
      render: function() {
        this.$el.attr('src', this.dataUrl);
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
          $el.attr('type', this.contentType);
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
    className: 'attachment',
    initialize: function(options) {
        this.blob = new Blob([this.model.data], {type: this.model.contentType});

        var parts = this.model.contentType.split('/');
        this.contentType = parts[0];
        if (options.timestamp) {
          this.timestamp = options.timestamp;
        }
    },
    events: {
        'click': 'onclick'
    },
    getFileType: function() {
        switch(this.model.contentType) {
            case 'video/quicktime': return 'mov';
            default: return this.model.contentType.split('/')[1];
        }
    },
    onclick: function(e) {
        switch (this.contentType) {
            case 'image':
                var view = new Whisper.LightboxView({ model: this });
                view.render();
                view.$el.appendTo(this.el);
                view.$el.trigger('show');
                break;

            default:
                if (this.view instanceof MediaView) {
                    return;
                }
                this.saveFile();
        }
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
        var blob = this.blob;
        var w = extension.windows.getViews()[0];
        if (w && w.chrome && w.chrome.fileSystem) {
            w.chrome.fileSystem.chooseEntry({
                type: 'saveFile', suggestedName: this.suggestedName()
            }, function(entry) {
                if (!entry) {
                    return;
                }
                entry.createWriter(function(fileWriter) {
                    fileWriter.write(blob);
                });
            });
        } else {
            console.log('Failed to get window');
        }
    },
    render: function() {
        var View;
        switch(this.contentType) {
            case 'image': View = ImageView; break;
            case 'video': View = VideoView; break;
            case 'audio': View = AudioView; break;
        }

        if (!View || _.contains(UnsupportedFileTypes, this.model.contentType)) {
            return this.renderFileView();
        }

        if (!this.objectUrl) {
            this.objectUrl = window.URL.createObjectURL(this.blob);
        }
        this.view = new View(this.objectUrl, this.model.contentType);
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
        this.renderFileView();
    },
    renderFileView: function() {
        this.view = new FileView({model: {fileName: this.suggestedName()}});
        this.view.$el.appendTo(this.$el.empty());
        this.view.render();
        this.update();
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
          this.window = extension.windows.getViews()[0];
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
