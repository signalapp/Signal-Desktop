// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as moment from 'moment';
// @ts-expect-error -- no types
import 'moment/min/locales.min.js';

import { initialize as initializeLogging } from '../../logging/set_up_renderer_logging.preload.js';
import { setup } from '../../signal.preload.js';
import { addSensitivePath } from '../../util/privacy.node.js';
import * as dns from '../../util/dns.node.js';
import {
  ATTACHMENTS_PATH,
  STICKERS_PATH,
  DRAFT_PATH,
} from '../../util/basePaths.preload.js';
import { SignalContext } from '../context.preload.js';

initializeLogging();

window.nodeSetImmediate = setImmediate;

const { config, i18n } = window.SignalContext;

const { resolvedTranslationsLocale, preferredSystemLocales, localeOverride } =
  config;

moment.updateLocale(localeOverride ?? resolvedTranslationsLocale, {
  relativeTime: {
    s: i18n('icu:timestamp_s'),
    m: i18n('icu:timestamp_m'),
    h: i18n('icu:timestamp_h'),
  },
});
moment.locale(
  localeOverride != null ? [localeOverride] : preferredSystemLocales
);

addSensitivePath(ATTACHMENTS_PATH);
addSensitivePath(STICKERS_PATH);
addSensitivePath(DRAFT_PATH);
if (config.crashDumpsPath) {
  addSensitivePath(config.crashDumpsPath);
}

if (SignalContext.config.disableIPv6) {
  dns.setIPv6Enabled(false);
}
dns.setFallback(SignalContext.config.dnsFallback);

window.Signal = setup();
