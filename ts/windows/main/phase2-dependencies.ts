// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as moment from 'moment';
// @ts-expect-error -- no types
import 'moment/min/locales.min.js';

import { textsecure } from '../../textsecure/index.js';
import { initialize as initializeLogging } from '../../logging/set_up_renderer_logging.js';
import { setup } from '../../signal.js';
import { addSensitivePath } from '../../util/privacy.js';
import * as dns from '../../util/dns.js';
import { createLogger } from '../../logging/log.js';
import { SignalContext } from '../context.js';
import * as Attachments from './attachments.js';

const log = createLogger('phase2-dependencies');

initializeLogging();

window.nodeSetImmediate = setImmediate;
window.textsecure = textsecure;

const { config } = window.SignalContext;

const { resolvedTranslationsLocale, preferredSystemLocales, localeOverride } =
  config;

moment.updateLocale(localeOverride ?? resolvedTranslationsLocale, {
  relativeTime: {
    s: window.i18n('icu:timestamp_s'),
    m: window.i18n('icu:timestamp_m'),
    h: window.i18n('icu:timestamp_h'),
  },
});
moment.locale(
  localeOverride != null ? [localeOverride] : preferredSystemLocales
);

const userDataPath = SignalContext.getPath('userData');
window.BasePaths = {
  attachments: Attachments.getPath(userDataPath),
  draft: Attachments.getDraftPath(userDataPath),
  stickers: Attachments.getStickersPath(userDataPath),
  temp: Attachments.getTempPath(userDataPath),
};

addSensitivePath(window.BasePaths.attachments);
if (config.crashDumpsPath) {
  addSensitivePath(config.crashDumpsPath);
}

if (SignalContext.config.disableIPv6) {
  dns.setIPv6Enabled(false);
}
dns.setFallback(SignalContext.config.dnsFallback);

window.Signal = setup({
  Attachments,
  getRegionCode: () => window.storage.get('regionCode'),
  logger: log,
  userDataPath,
});
