/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    var json = window.env.locale_json;
    window.i18n = function (message, substitutions) {
      if (!json[message]) {
        return;
      }
      var s = json[message].message;
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
      return window.env.locale;
    };
})();
