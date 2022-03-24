/* global $: false */
/* global Whisper: false */

$(document).on('keyup', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closeDebugLog();
  }
});

window.ReactDOM.render(<window.Views.DebugLogView />, document.getElementById('app'));
