// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global i18n: false */
/* global Whisper: false */
/* global $: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function () {
  document
    .getElementById('closeBtn')
    .addEventListener('click', () =>
      window.closeStayInTray()
    )
})()
