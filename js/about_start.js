/* global $: false */

// Add version
const version = window.getVersion();
$('.version').text(`v${version}`);

if (/beta/.test(version)) {
  $('.commitHash').text(window.getCommitHash());
}

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
$(document).on('keyup', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closeAbout();
  }
});

// Localize the privacy string
$('.privacy').text(window.i18n('privacyPolicy'));
