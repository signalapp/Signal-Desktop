// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import '../sandboxedInit.dom.js';

const message = document.getElementById('message');
if (message) {
  message.innerText = window.SignalContext.i18n('icu:optimizingApplication');
}
