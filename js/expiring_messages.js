
/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};
    Whisper.ExpiringMessages = new (Whisper.MessageCollection.extend({
        initialize: function() {
            this.on('expired', this.remove);
            this.fetchExpiring();
        }
    }))();
})();
