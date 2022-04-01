/* global $: false */

// Add version and commit hash
$('.version').text(`v${window.getVersion()}`);
$('.commitHash').text(window.getCommitHash() || '');

// Add debugging metadata - environment if not production, app instance name
const states = [];

if (window.getEnvironment() !== 'production') {
  states.push(window.getEnvironment());
}
if (window.getAppInstance()) {
  states.push(window.getAppInstance());
}

$('.environment').text(states.join(' - '));

// Install the 'dismiss with escape key' handler
// $(document).on('keyup', e => {
//   'use strict';

//   if (e.keyCode === 27) {
//     window.closeAbout();
//   }
// });
