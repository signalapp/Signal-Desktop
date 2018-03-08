(function () {
  'use strict';

  var windowFocused = false;
  window.addEventListener('blur', function() {
    windowFocused = false;
  });
  window.addEventListener('focus', function() {
    windowFocused = true;
  });

  window.isFocused = function() {
    return windowFocused;
  };
})();
