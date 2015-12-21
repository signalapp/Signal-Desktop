/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';

  Whisper.FileTypeToast = Whisper.ToastView.extend({
    template: $('#attachment-type-modal').html()
  });

  var ImageView = Backbone.View.extend({
      tagName: 'img',
      initialize: function(dataUrl) {
          this.dataUrl = dataUrl;
      },
      events: {
          'load': 'update',
          'click': 'open'
      },
      update: function() {
        this.trigger('update');
      },
      open: function () {
        window.open(this.dataUrl, '_blank');
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

  Whisper.AttachmentView = Backbone.View.extend({
    tagName: 'span',
    className: 'attachment',
    render: function() {
        var View;
        var isUnsupportedType = false;
        switch(this.model.contentType.split('/')[0]) {
            case 'image': View = ImageView; break;
            case 'audio': View = AudioView; break;
            case 'video': View = VideoView; break;
            default:
              isUnsupportedType = true;
        }
        
        if (isUnsupportedType) {
            var toast = new Whisper.FileTypeToast({
                model: {type: this.model.contentType.split('/')[0]}
            });
            toast.$el.insertAfter(this.$el);
            toast.render();
            return toast;
        } else {
          var blob = new Blob([this.model.data], {type: this.model.contentType});
          var view = new View(window.URL.createObjectURL(blob), this.model.contentType);
          view.$el.appendTo(this.$el);
          view.render();
          view.on('update', this.trigger.bind(this, 'update'));
          return this;
        }
    },
    deleteView: function(e) {
      if (e) { e.stopPropagation(); }
    }
  });

})();
