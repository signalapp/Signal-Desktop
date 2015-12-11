/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.KeyVerificationView = Whisper.View.extend({
        className: 'key-verification',
        templateName: 'key-verification',
        events: {
            'click .back': 'goBack'
        },
        goBack: function() {
            this.trigger('back');
        },
        splitKey: function(key) {
            // key is an array buffer
            var bytes = new Uint8Array(key);
            var octets = [];
            for (var i = 0; i < bytes.byteLength; ++i) {
                octets.push(('0' + bytes[i].toString(16)).slice(-2));
            }

            return octets;
        },
        render_attributes: function() {
            return {
                your_key: this.splitKey(this.model.your_key),
                their_key: this.splitKey(this.model.their_key)
            };
        }
    });
})();
