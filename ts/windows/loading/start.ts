// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { setupI18n } from '../../util/setupI18n';

window.i18n = setupI18n(
  window.SignalContext.getI18nLocale(),
  window.SignalContext.getI18nLocaleMessages()
);

const message = document.getElementById('message');
if (message) {
  message.innerHTML = window.i18n('icu:optimizingApplication');
}
