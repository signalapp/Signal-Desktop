// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This file doesn't check the format of license files, just the end year. See
//   `license_comments_test.ts` for those checks, which are meant to be run more often.

import assert from 'assert';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import * as childProcess from 'child_process';
import pMap from 'p-map';

const exec = promisify(childProcess.exec);

const rootPath = path.join(__dirname, '..', '..');

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

// This is not technically the real extension.
function getExtension(file: string): string {
  if (file.startsWith('.')) {
    return getExtension(`x.${file}`);
  }
  return path.extname(file);
}

export async function forEachRelevantFile(
  fn: (_: string) => Promise<unknown>
): Promise<void> {
  const gitFiles = (
    await exec('git ls-files', { cwd: rootPath, env: {} })
  ).stdout
    .split(/\n/g)
    .map(line => line.trim())
    .filter(Boolean)
    .map(file => path.join(rootPath, file));

  await pMap(
    gitFiles,
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

      await fn(file);
    },
    // Without this, we may run into "too many open files" errors.
    { concurrency: 100 }
  );
}

export function readFirstLines(
  file: string,
  count: number
): Promise<Array<string>> {
  return new Promise(resolve => {
    const lines: Array<string> = [];

    const lineReader = readline.createInterface({
      input: fs.createReadStream(file),
    });
    lineReader.on('line', line => {
      lines.push(line);
      if (lines.length >= count) {
        lineReader.close();
      }
    });
    lineReader.on('close', () => {
      resolve(lines);
    });
  });
}

async function getLatestCommitYearForFile(file: string): Promise<number> {
  const dateString = (
    await new Promise<string>((resolve, reject) => {
      let result = '';
      // We use the more verbose `spawn` to avoid command injection, in case the filename
      //   has strange characters.
      const gitLog = childProcess.spawn(
        'git',
        ['log', '-1', '--format=%as', file],
        {
          cwd: rootPath,
          env: { PATH: process.env.PATH },
        }
      );
      gitLog.stdout?.on('data', data => {
        result += data.toString('utf8');
      });
      gitLog.on('close', code => {
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`git log failed with exit code ${code}`));
        }
      });
    })
  ).trim();

  const result = new Date(dateString).getFullYear();
  assert(!Number.isNaN(result), `Could not read commit year for ${file}`);
  return result;
}

async function main() {
  const currentYear = new Date().getFullYear() + 1;

  await forEachRelevantFile(async file => {
    const [firstLine] = await readFirstLines(file, 1);
    const { groups = {} } =
      firstLine.match(/(?:\d{4}-)?(?<endYearString>\d{4})/) || [];
    const { endYearString } = groups;
    const endYear = Number(endYearString);

    assert(
      endYear === currentYear ||
        endYear === (await getLatestCommitYearForFile(file)),
      `${file} has an invalid end license year`
    );
  });
}

// Note: this check will fail if we switch to ES modules. See
//  <https://stackoverflow.com/a/60309682>.
if (require.main === module) {
  main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
