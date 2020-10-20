/* global Whisper: false */
/* global Backbone: false */
/* global _: false */
/* global Signal: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { MIME, VisualAttachment } = window.Signal.Types;

  Whisper.FileInputView = Backbone.View.extend({
    tagName: 'span',
    className: 'file-input',
    initialize() {
      this.attachments = [];

      this.attachmentListView = new Whisper.ReactWrapperView({
        el: this.el,
        Component: window.Signal.Components.AttachmentList,
        props: this.getPropsForAttachmentList(),
      });
    },

    render() {
      this.attachmentListView.update(this.getPropsForAttachmentList());
      this.trigger('staged-attachments-changed');
    },

    getPropsForAttachmentList() {
      const { attachments } = this;

      // We never want to display voice notes in our attachment list
      if (_.any(attachments, attachment => Boolean(attachment.isVoiceNote))) {
        return {
          attachments: [],
        };
      }

      return {
        attachments,
        onAddAttachment: this.onAddAttachment.bind(this),
        onClickAttachment: this.onClickAttachment.bind(this),
        onCloseAttachment: this.onCloseAttachment.bind(this),
        onClose: this.onClose.bind(this),
      };
    },

    onClickAttachment(attachment) {
      const getProps = () => ({
        url: attachment.videoUrl || attachment.url,
        caption: attachment.caption,
        attachment,
        onSave,
      });

      const onSave = caption => {
        // eslint-disable-next-line no-param-reassign
        attachment.caption = caption;
        this.captionEditorView.remove();
        Signal.Backbone.Views.Lightbox.hide();
        this.render();
      };

      this.captionEditorView = new Whisper.ReactWrapperView({
        className: 'attachment-list-wrapper',
        Component: window.Signal.Components.CaptionEditor,
        props: getProps(),
        onClose: () => Signal.Backbone.Views.Lightbox.hide(),
      });
      Signal.Backbone.Views.Lightbox.show(this.captionEditorView.el);
    },

    onCloseAttachment(attachment) {
      this.attachments = _.without(this.attachments, attachment);
      this.render();
    },

    onAddAttachment() {
      this.trigger('choose-attachment');
    },

    onClose() {
      this.attachments = [];
      this.render();
    },

    // These event handlers are called by ConversationView, which listens for these events

    onDragOver(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      this.$el.addClass('dropoff');
    },

    onDragLeave(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      this.$el.removeClass('dropoff');
    },

    async onDrop(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const { files } = e.originalEvent.dataTransfer;
      for (let i = 0, max = files.length; i < max; i += 1) {
        const file = files[i];
        // eslint-disable-next-line no-await-in-loop
        await this.maybeAddAttachment(file);
      }

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
        const file = imgBlob;
        this.maybeAddAttachment(file);

        e.stopPropagation();
        e.preventDefault();
      }
    },

    // Public interface
    async maybeAddAttachment(file) {
      if (!file) {
        return;
      }

      const fileName = file.name;
      const contentType = file.type;

      if (window.Signal.Util.isFileDangerous(fileName)) {
        this.showDangerousError();
        return;
      }

      if (this.attachments.length >= 32) {
        this.showMaximumAttachmentsError();
        return;
      }

      const haveNonImage = _.any(
        this.attachments,
        attachment => !MIME.isImage(attachment.contentType)
      );
      // You can't add another attachment if you already have a non-image staged
      if (haveNonImage) {
        this.showMultipleNonImageError();
        return;
      }

      // You can't add a non-image attachment if you already have attachments staged
      if (!MIME.isImage(contentType) && this.attachments.length > 0) {
        this.showCannotMixError();
        return;
      }

      const renderVideoPreview = async () => {
        const objectUrl = URL.createObjectURL(file);

        try {
          const type = 'image/png';
          const thumbnail = await VisualAttachment.makeVideoScreenshot({
            objectUrl,
            contentType: type,
            logger: window.log,
          });
          const data = await VisualAttachment.blobToArrayBuffer(thumbnail);
          const url = Signal.Util.arrayBufferToObjectURL({
            data,
            type,
          });
          this.addAttachment({
            file,
            size: file.size,
            fileName,
            contentType,
            videoUrl: objectUrl,
            url,
          });
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
        }
      };

      const renderImagePreview = async () => {
        if (!MIME.isJPEG(contentType)) {
          const url = URL.createObjectURL(file);
          if (!url) {
            throw new Error('Failed to create object url for image!');
          }
          this.addAttachment({
            file,
            size: file.size,
            fileName,
            contentType,
            url,
          });
          return;
        }

        const url = await window.autoOrientImage(file);
        this.addAttachment({
          file,
          size: file.size,
          fileName,
          contentType,
          url,
        });
      };

      try {
        const blob = await this.autoScale({
          contentType,
          file,
        });
        let limitKb = 10000;
        const blobType =
          file.type === 'image/gif' ? 'gif' : contentType.split('/')[0];

        switch (blobType) {
          case 'image':
            limitKb = 6000;
            break;
          case 'gif':
            limitKb = 10000;
            break;
          case 'audio':
            limitKb = 10000;
            break;
          case 'video':
            limitKb = 10000;
            break;
          default:
            limitKb = 10000;
            break;
        }
        if ((blob.file.size / 1024).toFixed(4) >= limitKb) {
          const units = ['kB', 'MB', 'GB'];
          let u = -1;
          let limit = limitKb * 1000;
          do {
            limit /= 1000;
            u += 1;
          } while (limit >= 1000 && u < units.length - 1);
          this.showFileSizeError(limit, units[u]);
          return;
        }
      } catch (error) {
        window.log.error(
          'Error ensuring that image is properly sized:',
          error && error.stack ? error.stack : error
        );

        this.showLoadFailure();
        return;
      }

      try {
        if (Signal.Util.GoogleChrome.isImageTypeSupported(contentType)) {
          await renderImagePreview();
        } else if (Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)) {
          await renderVideoPreview();
        } else {
          this.addAttachment({
            file,
            size: file.size,
            contentType,
            fileName,
          });
        }
      } catch (e) {
        window.log.error(
          `Was unable to generate thumbnail for file type ${contentType}`,
          e && e.stack ? e.stack : e
        );
        this.addAttachment({
          file,
          size: file.size,
          contentType,
          fileName,
        });
      }
    },
  });
})();
