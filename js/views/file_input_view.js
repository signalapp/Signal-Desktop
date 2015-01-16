var Whisper = Whisper || {};

(function () {
    'use strict';
    Whisper.FileInputView = Backbone.View.extend({
        tagName: 'span',
        className: 'file-input',
        initialize: function() {
            this.$input = this.$el.find('input[type=file]');
            this.modal = new Whisper.ModalView({el: $('#file-modal')});
        },

        events: {
            'change': 'previewImages',
            'click .close': 'deleteFiles'
        },

        addThumb: function(e) {
            var attachmentPreview = $('#attachment-preview').html();
            Mustache.parse(attachmentPreview);
            this.$el.append($(Mustache.render(attachmentPreview, {source: e.target.result})));
        },

        previewImages: function() {
            this.clearForm();
            var files = this.$input.prop('files');
            for (var i = 0; i < files.length; i++) {
                var FR = new FileReader();
                if ((files[i].size/1024).toFixed(4) >= 420) {
                    this.modal.open();
                    this.deleteFiles();
                }
                else {
                    FR.onload = this.addThumb.bind(this);
                    FR.readAsDataURL(files[i]);
                }
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
            this.clearForm();
            return Promise.all(promises);
        },

        clearForm: function() {
            this.$el.find('div.imageAttachment').remove();
        }, 

        deleteFiles: function() {
            this.clearForm();
            this.$input.wrap('<form>').parent('form').trigger('reset');
            this.$input.unwrap();
        }
    });
})();
