/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';

  var ImageView = Backbone.View.extend({
      tagName: 'img',
      events: {
          'load': 'update'
      },
      update: function() {
        this.$el.trigger('update');
      },
      render: function(dataUrl) {
          this.$el.attr('src', dataUrl);
          return this;
      }
  });

  var MediaView = Backbone.View.extend({
      initialize: function() {
          this.$el.attr('controls', '');
      },
      events: {
          'loadeddata': 'update'
      },
      update: function() {
        this.$el.trigger('update');
      },
      render: function(dataUrl, contentType) {
          var $el = $('<source>');
          $el.attr('src', dataUrl);
          $el.attr('type', contentType);
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
        var view;
        switch(this.model.contentType.split('/')[0]) {
            case 'image': view = new ImageView(); break;
            case 'audio': view = new AudioView(); break;
            case 'video': view = new VideoView(); break;
            default:
                throw 'Unsupported attachment type';
        }
        view.$el.appendTo(this.$el);
        var blob = new Blob([this.model.data], {type: this.model.contentType});
        view.render(window.URL.createObjectURL(blob), this.model.contentType);
        return this;
    }
  });

})();
