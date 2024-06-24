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
// eslint-disable-next-line import/no-extraneous-dependencies
import chalk from 'chalk';

const exec = promisify(childProcess.exec);

const rootPath = path.join(__dirname, '..', '..', '..');

const EXTENSIONS_TO_CHECK = new Set([
  '.eslintignore',
  '.gitattributes',
  '.gitignore',
  '.nvmrc',
  '.prettierignore',
  '.sh',
  '.snyk',
  '.yml',
  '.js',
  '.scss',
  '.ts',
  '.tsx',
  '.html',
  '.md',
  '.plist',
]);
const FILES_TO_IGNORE = new Set(
  [
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.smartling-source.sh',
    'components/mp3lameencoder/lib/Mp3LameEncoder.js',
    'components/recorderjs/recorder.js',
    'components/recorderjs/recorderWorker.js',
    'components/webaudiorecorder/lib/WebAudioRecorder.js',
    'components/webaudiorecorder/lib/WebAudioRecorderMp3.js',
    'js/Mp3LameEncoder.min.js',
    'js/WebAudioRecorderMp3.js',
    'sticker-creator/src/util/protos.d.ts',
    'sticker-creator/src/util/protos.js',
    // ignore calling developer tools licensing which use Chromium license
    'calling_tools.html',
    'js/calling-tools/assert.js',
    'js/calling-tools/candidate_grid.js',
    'js/calling-tools/data_series.js',
    'js/calling-tools/dump_creator.js',
    'js/calling-tools/peer_connection_update_table.js',
    'js/calling-tools/stats_graph_helper.js',
    'js/calling-tools/stats_helper.js',
    'js/calling-tools/stats_rates_calculator.js',
    'js/calling-tools/stats_table.js',
    'js/calling-tools/tab_view.js',
    'js/calling-tools/timeline_graph_view.js',
    'js/calling-tools/user_media_table.js',
    'js/calling-tools/util.js',
    'js/calling-tools/webrtc_internals.js',
  ].map(
    // This makes sure the files are correct on Windows.
    path.normalize
  )
);

// This is not technically the real extension.
export function getExtension(file: string): string {
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
      const repoPath = path.relative(rootPath, file);
      if (FILES_TO_IGNORE.has(repoPath)) {
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
      // `lineReader.close()` does not guarantee 'line' won't be emitted again
      if (lines.length < count) {
        lines.push(line);
      }
      if (lines.length >= count) {
        lineReader.close();
      }
    });
    lineReader.on('close', () => {
      resolve(lines);
    });
  });
}

async function getCommitFileWasAdded(
  file: string
): Promise<{ commitYear: number; commitHash: string }> {
  const logLine = (
    await new Promise<string>((resolve, reject) => {
      let result = '';
      // We use the more verbose `spawn` to avoid command injection, in case the filename
      //   has strange characters.
      const gitLog = childProcess.spawn(
        'git',
        [
          // From: https://stackoverflow.com/questions/11533199/how-to-find-the-commit-in-which-a-given-file-was-added
          'log',
          '-1', // limit number of lines to return to 1
          '--diff-filter=A', // select only files that are added (A)
          '--follow', // continue listing the history of a file beyond renames
          '--find-renames=40%', // consider a delete/add pair to be a rename if less than 40% of the file has changed (default 50%)
          '--format=%as %h', // display commit as date YYYY-MM-DD
          file,
        ],
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

  const [dateString, commitHash] = logLine.split(' ');

  const commitYear = new Date(dateString).getFullYear();
  assert(!Number.isNaN(commitYear), `Could not read commit year for ${file}`);
  return { commitYear, commitHash };
}

type Failure = {
  file: string;
  warnings: Array<string>;
};

function indent(text: string) {
  return text
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

async function main() {
  const currentYear = new Date().getFullYear();
  const failures: Array<Failure> = [];

  await forEachRelevantFile(async file => {
    let lines: Array<string>;
    let firstLine: string | void;
    let secondLine: string | void;

    if (getExtension(file) === '.sh') {
      lines = await readFirstLines(file, 3);
      [, firstLine, secondLine] = lines;
    } else {
      lines = await readFirstLines(file, 2);
      [firstLine, secondLine] = lines;
    }

    const warnings = [];

    if (!/Copyright \d{4} Signal Messenger, LLC/.test(firstLine)) {
      const commit = await getCommitFileWasAdded(file);
      warnings.push(
        chalk.red('Missing/Incorrect copyright line'),
        indent(
          chalk.green(
            `Expected: "Copyright ${commit.commitYear} Signal Messenger, LLC"`
          )
        ),
        indent(chalk.yellow(`Actual: "${firstLine}"`)),
        indent(
          chalk.italic.dim(
            `Tip: Looks like this file was added in ${commit.commitHash} in ${commit.commitYear}`
          )
        ),
        indent(
          chalk.italic.dim(
            `Tip: You can also use the current year (${currentYear})`
          )
        )
      );
    } else if (/\d{4}-\d{4}/.test(firstLine)) {
      warnings.push(
        chalk.red('Copyright should not include end year'),
        indent(chalk.yellow(`Actual: "${firstLine}"`))
      );
    }

    if (!secondLine.includes('SPDX-License-Identifier: AGPL-3.0-only')) {
      warnings.push(
        chalk.red('Missing/incorrect license line'),
        indent(
          chalk.green('Expected: "SPDX-License-Identifier: AGPL-3.0-only"')
        ),
        indent(chalk.yellow(`Actual: "${secondLine}"`))
      );
    }

    if (warnings.length) {
      failures.push({ file, warnings });
    }
  });

  const failed = failures.length > 0;

  /* eslint-disable no-console */
  if (failed) {
    console.log();
    console.log(
      chalk.magenta.bold(
        'Some files are missing/contain incorrect copyrights/licenses:'
      )
    );
    console.log();
    for (const failure of failures) {
      console.log(chalk.bold(`${failure.file}:`));
      console.log(indent(failure.warnings.join('\n')));
      console.log();
    }

    console.log(chalk.magenta.bold('`npm run lint-license-comments` failed'));
    console.log();

    process.exit(1);
  }
  /* eslint-enable no-console */
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
