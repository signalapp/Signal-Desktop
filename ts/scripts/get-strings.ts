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
const locales = readdirSync(join(BASE_DIR, ''));

console.log();
console.log('Deleting placeholders for all locales');
locales.forEach((locale: string) => {
  const target = resolve(join(BASE_DIR, locale, 'messages.json'));
  if (!existsSync(target)) {
    console.warn(`File not found for ${locale}: ${target}`);
    return;
  }

  const messages: LocaleMessagesType = readJsonSync(target);
  Object.keys(messages).forEach(key => {
    delete messages[key].placeholders;

    if (!messages[key].description) {
      delete messages[key].description;
    }
  });

  console.log(`Writing ${target}`);
  writeFileSync(target, `${JSON.stringify(messages, null, 4)}\n`);
});

execSync('yarn format', {
  stdio: [null, process.stdout, process.stderr],
});

if (failed) {
  process.exit(1);
}
