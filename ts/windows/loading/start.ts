// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const message = document.getElementById('message');
if (message) {
  message.innerHTML = window.SignalContext.i18n('icu:optimizingApplication');
}
