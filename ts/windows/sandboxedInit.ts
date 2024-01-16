// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import './applyTheme';
import { setupI18n } from '../util/setupI18n';

document.body.classList.add(window.SignalContext.OS.getClassName());

export const i18n = setupI18n(
  window.SignalContext.getI18nLocale(),
  window.SignalContext.getI18nLocaleMessages()
);

window.i18n = i18n;
