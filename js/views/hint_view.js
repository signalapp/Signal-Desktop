/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.HintView = Whisper.View.extend({
        className: 'conversation placeholder',
        templateName: 'hint',
    });
})();
