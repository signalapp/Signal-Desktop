// eslint-disable-next-line func-names
(function() {
  'use strict';

  let windowFocused = false;
  window.addEventListener('blur', () => {
    windowFocused = false;
  });
  window.addEventListener('focus', () => {
    windowFocused = true;
  });

  window.isFocused = () => windowFocused;
})();
