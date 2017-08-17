/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';

    // preload.js loads this, pulling it from main.js (where it was loaded from disk)
    var messages = window.config.localeMessages;
    var failover = window.config.localeFailover;
    var locale = window.config.locale;

    function loadString(message, substitutions, strings) {
      if (!strings[message]) {
        return;
      }
      var s = strings[message].message;
      if (substitutions instanceof Array) {
        substitutions.forEach(function(sub) {
          s = s.replace(/\$.+?\$/, sub);
        });
      } else if (substitutions) {
        s = s.replace(/\$.+?\$/, substitutions);
      }
      return s;
    }

    window.i18n = function (message, substitutions) {
      var result = loadString(message, substitutions, messages);

      if (result) {
        return result;
      }
      console.log('Missing string', message, 'for locale', locale);

      // If a language doesn't include a given string, we use our failover strings
      return loadString(message, substitutions, failover);
    };

    i18n.getLocale = function() {
      return locale;
    };
})();
