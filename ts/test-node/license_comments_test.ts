// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import * as readline from 'readline';
import * as childProcess from 'child_process';
import pMap from 'p-map';

const exec = promisify(childProcess.exec);

const EXTENSIONS_TO_CHECK = new Set([
  '.eslintignore',
  '.gitattributes',
  '.gitignore',
  '.nvmrc',
  '.prettierignore',
  '.sh',
  '.snyk',
  '.yarnclean',
  '.yml',
  '.js',
  '.scss',
  '.ts',
  '.tsx',
  '.html',
  '.md',
  '.plist',
]);
const FILES_TO_IGNORE = new Set([
  'ISSUE_TEMPLATE.md',
  'Mp3LameEncoder.min.js',
  'PULL_REQUEST_TEMPLATE.md',
  'WebAudioRecorderMp3.js',
]);

const rootPath = path.join(__dirname, '..', '..');

async function getGitFiles(): Promise<Array<string>> {
  return (await exec('git ls-files', { cwd: rootPath, env: {} })).stdout
    .split(/\n/g)
    .map(line => line.trim())
    .filter(Boolean)
    .map(file => path.join(rootPath, file));
}

// This is not technically the real extension.
function getExtension(file: string): string {
  if (file.startsWith('.')) {
    return getExtension(`x.${file}`);
  }
  return path.extname(file);
}

function readFirstTwoLines(file: string): Promise<Array<string>> {
  return new Promise(resolve => {
    const lines: Array<string> = [];

    const lineReader = readline.createInterface({
      input: fs.createReadStream(file),
    });
    lineReader.on('line', line => {
      lines.push(line);
      if (lines.length >= 2) {
        lineReader.close();
      }
    });
    lineReader.on('close', () => {
      resolve(lines);
    });
  });
}

describe('license comments', () => {
  it('includes a license comment at the top of every relevant file', async function test() {
    // This usually executes quickly but can be slow in some cases, such as Windows CI.
    this.timeout(10000);

    const currentYear = new Date().getFullYear();

    await pMap(
      await getGitFiles(),
      async (file: string) => {
        if (
          FILES_TO_IGNORE.has(path.basename(file)) ||
          path.relative(rootPath, file).startsWith('components')
        ) {
          return;
        }

        const extension = getExtension(file);
        if (!EXTENSIONS_TO_CHECK.has(extension)) {
          return;
        }

        const [firstLine, secondLine] = await readFirstTwoLines(file);

        assert.match(
          firstLine,
          RegExp(`Copyright (?:\\d{4}-)?${currentYear} Signal Messenger, LLC`),
          `First line of ${file} is missing correct license header comment`
        );
        assert.include(
          secondLine,
          'SPDX-License-Identifier: AGPL-3.0-only',
          `Second line of ${file} is missing correct license header comment`
        );
      },
      // Without this, we may run into "too many open files" errors.
      { concurrency: 100 }
    );
  });
});
