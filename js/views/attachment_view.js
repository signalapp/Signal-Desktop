/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';

  var FileView = Backbone.View.extend({
      tagName: 'a',
      initialize: function(dataUrl) {
          this.dataUrl = dataUrl;
          this.$el.text(i18n('unsupportedAttachment'));
      },
      events: {
          'click': 'open'
      },
      open: function (e) {
          e.preventDefault();
          window.open(this.dataUrl, '_blank');
      },
      render: function() {
        this.$el.attr('href', this.dataUrl);
        this.trigger('update');
        return this;
      }
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
        switch(this.model.contentType.split('/')[0]) {
            case 'image': View = ImageView; break;
            case 'audio': View = AudioView; break;
            case 'video': View = VideoView; break;
            default     : View = FileView; break;
        }
        var blob = new Blob([this.model.data], {type: this.model.contentType});
        var view = new View(window.URL.createObjectURL(blob), this.model.contentType);
        view.$el.appendTo(this.$el);
        view.on('update', this.trigger.bind(this, 'update'));
        view.render();
        return this;
    }
  });

})();
