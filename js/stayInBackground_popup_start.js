// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global $, Whisper */

$(document).on('keydown', e => {
  if (e.keyCode === /* escape key */27) {
    window.closeStayInBackgroundPopup();
  }
});

const $body = $(document.body);

window.view = new Whisper.StayInBackgroundView();
window.view.$el.appendTo($body);
