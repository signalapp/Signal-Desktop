/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';

    // preload.js loads this, pulling it from main.js (where it was loaded from disk)
    var messages = window.config.localeMessages;
    var locale = window.config.locale;

    window.i18n = function (key, values) {
      var data = messages[key];
      if (!data) {
        return;
      }

      var message = data.message;
      var placeholders = data.placeholders;
      if (!values || !placeholders) {
        return message;
      }

      if (!(values instanceof Array)) {
        values = [values];
      }

      var names = Object.keys(placeholders);
      for (var i = 0, max = names.length; i < max; i += 1) {
        var name = names[i];
        var value = values[i]

        var r = new RegExp('\\$' + name + '\\$', 'g');

        message = message.replace(r, value);
      }

      return message;
    };

    i18n.getLocale = function() {
      return locale;
    };
})();
