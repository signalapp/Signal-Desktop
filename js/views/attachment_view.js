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
      render: function(dataUrl) {
          this.$el.attr('src', dataUrl);
          return this;
      }
  });

  var AudioView = Backbone.View.extend({
      tagName: 'audio',
      initialize: function() {
          this.$el.attr('controls', '');
      },
      render: function(dataUrl) {
          this.$el.attr('src', dataUrl);
          return this;
      }
  });

  var VideoView = Backbone.View.extend({
      tagName: 'video',
      initialize: function() {
          this.$el.attr('controls', '');
      },
      render: function(dataUrl, contentType) {
          var $el = $('<source>');
          $el.attr('src', dataUrl);
          $el.attr('type', contentType);
          this.$el.append($el);
          return this;
      }
  });

  Whisper.AttachmentView = Backbone.View.extend({
    className: 'attachment',
    encodeAsDataUrl: function  () {
        return new Promise(function(resolve, reject) {
            var blob = new Blob([this.model.data], { type: this.model.contentType });
            var FR = new FileReader();
            FR.onload = function(e) {
                resolve(e.target.result);
            };
            FR.onerror = reject;
            FR.readAsDataURL(blob);
        }.bind(this));
    },
    render: function() {
        var view;
        switch(this.model.contentType.split('/')[0]) {
            case 'image': view = new ImageView(); break;
            case 'audio': view = new AudioView(); break;
            case 'video': view = new VideoView(); break;
            default:
                throw 'Unsupported attachment type';
        }
        this.encodeAsDataUrl().then(function(base64) {
            view.render(base64, this.model.contentType);
            view.$el.appendTo(this.$el);
            this.$el.trigger('update');
        }.bind(this));
        return this;
    }
  });

})();
