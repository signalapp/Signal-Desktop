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
