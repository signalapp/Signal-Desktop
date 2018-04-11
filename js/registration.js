/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    Whisper.Registration = {
        markEverDone: function() {
            storage.put('chromiumRegistrationDoneEver', '');
        },
        markDone: function () {
            this.markEverDone();
            storage.put('chromiumRegistrationDone', '');
        },
        isDone: function () {
            return storage.get('chromiumRegistrationDone') === '';
        },
        everDone: function() {
            return storage.get('chromiumRegistrationDoneEver') === '' ||
                   storage.get('chromiumRegistrationDone') === '';
        },
        remove: function() {
            storage.remove('chromiumRegistrationDone');
        }
    };
}());
