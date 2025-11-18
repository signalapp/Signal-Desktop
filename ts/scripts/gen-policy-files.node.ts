// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'node:fs/promises';
import path from 'node:path';
import fastGlob from 'fast-glob';

import { strictAssert } from '../util/assert.std.js';

const ROOT_DIR = path.join(__dirname, '..', '..');

async function main() {
  const dirEntries = await fastGlob('_locales/*', {
    cwd: ROOT_DIR,
    onlyDirectories: true,
  });

  const english = JSON.parse(
    await fs.readFile(path.join(ROOT_DIR, '_locales/en/messages.json'), 'utf8')
  );
  const templateDir = path.join(ROOT_DIR, 'build/policy-templates');
  const templates = [
    {
      name: 'org.signalapp.enable-backups.policy',
      content: await fs.readFile(
        path.join(templateDir, 'org.signalapp.enable-backups.policy'),
        'utf8'
      ),
      description:
        'icu:Preferences__local-backups--enable--os-prompt-description--linux',
      message:
        'icu:Preferences__local-backups--enable--os-prompt-message--linux',
    },
    {
      name: 'org.signalapp.plaintext-export.policy',
      content: await fs.readFile(
        path.join(templateDir, 'org.signalapp.plaintext-export.policy'),
        'utf8'
      ),
      description: 'icu:PlaintextExport--OSPrompt--description--Linux',
      message: 'icu:PlaintextExport--OSPrompt--message--Linux',
    },
    {
      name: 'org.signalapp.view-aep.policy',
      content: await fs.readFile(
        path.join(templateDir, 'org.signalapp.view-aep.policy'),
        'utf8'
      ),
      description:
        'icu:Preferences--local-backups--view-backup-key--os-prompt-description--linux',
      message:
        'icu:Preferences--local-backups--view-backup-key--os-prompt-message--linux',
    },
  ];

  for (const template of templates) {
    const englishDescription = english[template.description]?.messageformat;
    strictAssert(
      englishDescription,
      `Must have english string for key ${template.description}`
    );
    const englishMessage = english[template.message]?.messageformat;
    strictAssert(
      englishMessage,
      `Must have english string for key ${template.message}`
    );

    let allDescriptions = `<description>${englishDescription}</description>\n`;
    let allMessages = `<message>${englishMessage}</message>\n`;

    for (const dirEntry of dirEntries) {
      const locale = path.basename(dirEntry);
      const data = JSON.parse(
        // eslint-disable-next-line no-await-in-loop
        await fs.readFile(
          path.join(ROOT_DIR, '_locales', locale, 'messages.json'),
          'utf8'
        )
      );

      const localeName = locale.replace('-', '_');
      const description =
        data[template.description]?.messageformat ?? englishDescription;
      allDescriptions += `    <description xml:lang="${localeName}">${description}</description>\n`;

      const message = data[template.message]?.messageformat ?? englishMessage;
      allMessages += `    <message xml:lang="${localeName}">${message}</message>\n`;
    }

    const targetPath = path.join(ROOT_DIR, 'build', template.name);
    let targetContent = template.content;

    targetContent = targetContent.replace(
      '<!-- <description>{description}</description> -->',
      allDescriptions
    );
    targetContent = targetContent.replace(
      '<!-- <message>{message}</message> -->',
      allMessages
    );

    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(targetPath, targetContent);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
