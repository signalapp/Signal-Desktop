// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global i18n: false */
/* global Whisper: false */
/* global $: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  Whisper.StayInBackgroundView = Whisper.View.extend({
    className: 'stayInBackground',
    templateName: 'stayInBackground',
    initialize() {
      this.render();
    },
    events: {
      'click .close': 'onClose',
    },
    render_attributes() {
      return {
        appRunningInBackground: i18n('appRunningInBackground'),
        disableStayInBackgroundInSettings: i18n('disableStayInBackgroundInSettings'),
        okText: i18n('ok'),
      };
    },
    onClose() {
      window.closeStayInBackgroundPopup();
    },
  });
})();
