/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';

    window.Whisper = window.Whisper || {};

    extension.windows.getBackground(function(bg) {
        if (bg.textsecure.storage.user.getNumber() === undefined) {
            window.location = '/options.html';
        } else {
            extension.windows.getCurrent(function(appWindow) {
                var view = new bg.Whisper.InboxView({appWindow: appWindow});
                view.$el.prependTo(bg.$('body',document));
                window.openConversation = function(conversation) {
                    if (conversation) {
                        view.openConversation(null, conversation);
                    }
                };
                openConversation(bg.getOpenConversation());
            });
        }
    });
}());
