// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join, resolve } from 'path';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

import { readJsonSync } from 'fs-extra';
import type { LocaleMessagesType } from '../types/I18N';
import * as Errors from '../types/errors';

console.log('Getting latest strings!');

// Note: we continue after tx failures so we always restore placeholders on json files
let failed = false;

console.log();
console.log('Getting strings, allow for new ones over 80% translated');
try {
  execSync('tx pull --all --use-git-timestamps --minimum-perc=80', {
    stdio: [null, process.stdout, process.stderr],
  });
} catch (error: unknown) {
  failed = true;
  console.log(
    'Failed first tx fetch, continuing...',
    Errors.toLogFormat(error)
  );
}

console.log();
console.log('Getting strings, updating everything previously missed');
try {
  execSync('tx pull --use-git-timestamps', {
    stdio: [null, process.stdout, process.stderr],
  });
} catch (error: unknown) {
  failed = true;
  console.log(
    'Failed second tx fetch, continuing...',
    Errors.toLogFormat(error)
  );
}

const BASE_DIR = join(__dirname, '../../_locales');
const en: LocaleMessagesType = readJsonSync(
  join(BASE_DIR, '/en/messages.json')
);
const locales = readdirSync(join(BASE_DIR, ''));

console.log();
console.log('Re-adding placeholders to non-en locales');
locales.forEach((locale: string) => {
  if (locale === 'en') {
    return;
  }
  const target = resolve(join(BASE_DIR, locale, 'messages.json'));
  if (!existsSync(target)) {
    throw new Error(`File not found for ${locale}: ${target}`);
  }

  const messages: LocaleMessagesType = readJsonSync(target);
  Object.keys(messages).forEach(key => {
    if (!en[key]) {
      return;
    }

    messages[key].placeholders = en[key].placeholders;
  });

  console.log(`Writing ${target}`);
  writeFileSync(target, `${JSON.stringify(messages, null, 4)}\n`);
});

if (failed) {
  process.exit(1);
}
