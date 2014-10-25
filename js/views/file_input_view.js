var Whisper = Whisper || {};

(function () {
    'use strict';
    Whisper.FileInputView = Backbone.View.extend({
        tagName: 'span',
        className: 'file-input',
        initialize: function() {
            this.$input = this.$el.find('input[type=file]');
        },

        events: {
            'change': 'previewImages'
        },

        addThumb: function(e) {
          this.$el.append($('<img>').attr( "src", e.target.result ));
        },

        previewImages: function() {
            this.$el.find('img').remove();
            var files = this.$input.prop('files');
            var onload = this.addThumb.bind(this);
            for (var i = 0; i < files.length; i++) {
                var FR = new FileReader();
                FR.onload = onload;
                FR.readAsDataURL(files[i]);
            }
        },

        hasFiles: function() {
            var files = this.$input.prop('files');
            return files && files.length && files.length > 0;
        },

        getFiles: function() {
            var promises = [];
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                var contentType = files[i].type;
                var p = new Promise(function(resolve, reject) {
                  var FR = new FileReader();
                  FR.onload = function(e) {
                    resolve({data: e.target.result, contentType: contentType});
                  };
                  FR.readAsArrayBuffer(files[i]);
                }.bind(this));
                promises.push(p);
            }
            this.$el.find('img').remove();
            return Promise.all(promises);
        }

    });
})();
