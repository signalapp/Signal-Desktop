/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';

    // preload.js loads this, pulling it from main.js (where it was loaded from disk)
    var messages = window.config.localeMessages;
    var locale = window.config.locale;

    window.i18n = function (message, substitutions) {
      if (!messages[message]) {
        return;
      }
      var s = messages[message].message;
      if (substitutions instanceof Array) {
        substitutions.forEach(function(sub) {
          s = s.replace(/\$.+?\$/, sub);
        });
      } else if (substitutions) {
        s = s.replace(/\$.+?\$/, substitutions);
      }
      return s;
    };

    i18n.getLocale = function() {
      return locale;
    };
})();
