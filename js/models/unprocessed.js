/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var Unprocessed = window.Whisper.Unprocessed = Backbone.Model.extend({
        database  : Whisper.Database,
        storeName : 'unprocessed'
    });

    Whisper.UnprocessedCollection = Backbone.Collection.extend({
        model      : Unprocessed,
        database   : Whisper.Database,
        storeName  : 'unprocessed',
        comparator : 'timestamp'
    });
})();
