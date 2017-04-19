/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';

    extension.windows.getBackground(function(bg) {
        var view = new bg.StandaloneRegistrationView({el: $('body')});
    });

})();
