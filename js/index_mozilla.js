/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    var view;

    function render() {
        var $body = $('body', document).empty();
        extension.windows.getCurrent(function(appWindow) {
          view = new Whisper.InboxView({appWindow: appWindow});
          $body.append(view.$el);

          window.openConversation = function(conversation) {
              if (conversation) {
                  view.openConversation(null, conversation);
              }
          };
          openConversation(getOpenConversation());
        });
    }

    //window.addEventListener('onload', render);
    window.onload = render;
    //render();
}());
