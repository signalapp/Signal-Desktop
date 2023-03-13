// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createIntl } from '@formatjs/intl';
import path from 'path';
import fs from 'fs';

// Note: if this warning appears and build fails:
//
// "warning 6040: LangString "MUI_TEXT_INSTALLING_TITLE" is not set in language..."
//
// Make sure to sync up the values in `util/nsis` with upstream
// `app-builder-lib`.
import { REQUIRED_LANGUAGES, LCID } from '../util/nsis';

console.log('Generating updates NSIS script');
console.log();

const USED = new Set<number>();

const ROOT_DIR = path.join(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT_DIR, '_locales');

const nsisStrings = new Array<string>();
for (const lang of REQUIRED_LANGUAGES) {
  const id = LCID[lang] ?? LCID.en_US;
  if (USED.has(id)) {
    continue;
  }
  USED.add(id);

  // We use "-" in folder names
  const folder = lang.replace(/_/g, '-');
  const fallbacks = [folder, folder.replace(/-.*/g, ''), 'en'];
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
  const { 'icu:UnsupportedOSErrorToast': message } = JSON.parse(
    json.toString()
  );

  const intl = createIntl({
    locale: folder,
    messages: {
      message: message.messageformat,
    },
  });

  const text = intl.formatMessage({ id: 'message' }, { OS: 'Windows' });
  nsisStrings.push(`# ${lang}`);
  nsisStrings.push(
    `LangString signalMinWinVersionErr ${id} ${JSON.stringify(text)}`
  );
}

// See: https://www.electron.build/configuration/nsis.html#custom-nsis-script
//   for description of what `build/installer.nsh` does.
fs.writeFileSync(
  path.join(ROOT_DIR, 'build', 'installer.nsh'),
  [
    '# DO NOT EDIT. This is a generated file.',
    '',
    '!include WinVer.nsh',
    '',
    ...nsisStrings,
    '',
    '!macro preInit',
    // TODO: DESKTOP-5092
    // See: https://github.com/NSIS-Dev/Documentation/tree/42d8b48c4706b295b68879f7d83bd174c52ac8d7/docs/Includes/WinVer
    // eslint-disable-next-line no-template-curly-in-string
    '  ${IfNot} ${AtLeastWin7}',
    '    MessageBox MB_OK|MB_ICONEXCLAMATION "$(signalMinWinVersionErr)"',
    '    DetailPrint `Windows version check failed`',
    '    Abort',
    // eslint-disable-next-line no-template-curly-in-string
    '  ${EndIf}',
    '!macroend',
    '',
  ].join('\n')
);
