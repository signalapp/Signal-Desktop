// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createIntl } from '@formatjs/intl';
import path from 'node:path';
import fs from 'node:fs';

// Note: if this warning appears and build fails:
//
// "warning 6040: LangString "MUI_TEXT_INSTALLING_TITLE" is not set in language..."
//
// Make sure to sync up the values in `util/nsis` with upstream
// `app-builder-lib`.
import { REQUIRED_LANGUAGES, LCID } from '../util/nsis.std.js';

const STRING_VARS = new Map([
  [
    'signalMinWinVersionErr',
    {
      id: 'icu:UnsupportedOSErrorToast',
      replacements: {
        OS: 'Windows',
      },
    },
  ],
  [
    'signalMinAppVersionErr',
    {
      id: 'icu:NSIS__semver-downgrade',
      replacements: {},
    },
  ],
]);

console.log('Generating updates NSIS script');
console.log();

const USED = new Set<number>();

const ROOT_DIR = path.join(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT_DIR, '_locales');

const fallbackMessages = JSON.parse(
  fs.readFileSync(path.join(LOCALES_DIR, 'en', 'messages.json')).toString()
);

const nsisStrings = new Array<string>();
for (const lang of REQUIRED_LANGUAGES) {
  const langId = LCID[lang] ?? LCID.en_US;
  if (USED.has(langId)) {
    continue;
  }
  USED.add(langId);

  // We use "-" in folder names
  const folder = lang.replace(/_/g, '-');
  const fallbacks = [folder, folder.replace(/-.*/g, ''), 'en'];
  if (lang === 'zh_TW') {
    fallbacks.unshift('zh-Hant');
  }
  let json: Buffer | undefined;
  for (const f of fallbacks) {
    try {
      json = fs.readFileSync(path.join(LOCALES_DIR, f, 'messages.json'));
      if (f !== folder) {
        console.error(`Fallback from ${folder} to ${f}`);
      }
      break;
    } catch {
      // no-op
    }
  }
  if (!json) {
    throw new Error(`No messages for ${folder}`);
  }

  const messages = JSON.parse(json.toString());

  nsisStrings.push(`# ${lang}`);
  for (const [varName, { id, replacements }] of STRING_VARS) {
    let message = messages[id];
    if (!message) {
      console.error(`No string for ${id} in ${folder}, using english version`);
      message = fallbackMessages[id];
    }

    const intl = createIntl({
      locale: folder,
      messages: {
        message: message.messageformat,
      },
    });

    const text = intl.formatMessage({ id: 'message' }, replacements);
    nsisStrings.push(`LangString ${varName} ${langId} ${JSON.stringify(text)}`);
  }
}

// See: https://www.electron.build/configuration/nsis.html#custom-nsis-script
//   for description of what `build/installer.nsh` does.
fs.writeFileSync(
  path.join(ROOT_DIR, 'build', 'SignalStrings.nsh'),
  [
    '# Copyright 2023 Signal Messenger, LLC',
    '# SPDX-License-Identifier: AGPL-3.0-only',
    '#',
    '# DO NOT EDIT. This is a generated file.',
    '',
    ...nsisStrings,
    '',
  ].join('\n')
);
