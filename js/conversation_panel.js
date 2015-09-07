/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';

    window.Whisper = window.Whisper || {};

    extension.windows.getCurrent(function (windowInfo) {
        extension.windows.getBackground(function(bg) {
            window.$ = bg.$;
            var body = $('body', document);
            var conversation = bg.getConversationForWindow(windowInfo.id);
            if (conversation) {
                window.document.title = conversation.getTitle();
                var view = new bg.Whisper.ConversationView({
                    model: conversation,
                    appWindow: windowInfo
                });
                view.$el.prependTo(body);
                view.$('input.send-message').focus();
            } else {
                $('<div>').text('Error').prependTo(body);
            }
        });
    });
}());
