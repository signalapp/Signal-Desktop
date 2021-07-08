// eslint-disable-next-line func-names
(function() {
  'use strict';

  let windowFocused = false;
  let windowFocusedListener = function() {}
  window.addEventListener('blur', () => {
    windowFocused = false;
  });
  window.addEventListener('focus', () => {
    windowFocused = true;
    windowFocusedListener();
  });

  window.isFocused = () => windowFocused;
  window.setFocusListener = (listener) => windowFocusedListener = listener;
})();
