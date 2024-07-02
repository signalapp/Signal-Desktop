// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import z from 'zod';
import split2 from 'split2';
import logSymbols from 'log-symbols';

import { explodePromise } from '../util/explodePromise';
import { missingCaseError } from '../util/missingCaseError';

const ROOT_DIR = join(__dirname, '..', '..');

const ELECTRON = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const MAX_RETRIES = 3;
const RETRIABLE_SIGNALS = ['SIGBUS'];

const failSchema = z.object({
  type: z.literal('fail'),
  title: z.string().array(),
  error: z.string(),
});

const eventSchema = z
  .object({
    type: z.literal('pass'),
    title: z.string().array(),
  })
  .or(failSchema)
  .or(
    z.object({
      type: z.literal('end'),
    })
  );

async function launchElectron(attempt: number): Promise<void> {
  if (attempt > MAX_RETRIES) {
    console.error(`Failed after ${MAX_RETRIES} retries, exiting.`);
    process.exit(1);
  }

  console.log(`Launching electron for tests, attempt #${attempt}...`);

  const proc = spawn(ELECTRON, [ROOT_DIR, ...process.argv.slice(2)], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      // Setting NODE_ENV to test triggers main.ts to load
      // 'test/index.html' instead of 'background.html', which loads the tests
      // via `test.js`
      NODE_ENV: 'test',
      TEST_QUIT_ON_COMPLETE: 'on',
    },
    // Since we run `.cmd` file on Windows - use shell
    shell: process.platform === 'win32',
  });

  const { resolve, reject, promise: exitPromise } = explodePromise<void>();

  let exitSignal: string | undefined;
  proc.on('exit', (code, signal) => {
    if (code === 0) {
      resolve();
    } else {
      exitSignal = signal || undefined;
      reject(new Error(`Exit code: ${code}`));
    }
  });

  let pass = 0;
  const failures = new Array<z.infer<typeof failSchema>>();
  let done = false;
  let stack = new Array<string>();

  function enter(path: ReadonlyArray<string>): void {
    // Find the first different fragment
    let i: number;
    for (i = 0; i < path.length - 1; i += 1) {
      if (stack[i] !== path[i]) {
        break;
      }
    }

    // Separate sections
    if (i !== stack.length) {
      console.log('');

      // Remove different fragments
      stack = stack.slice(0, i);
    }

    for (; i < path.length - 1; i += 1) {
      const fragment = path[i];

      console.log(indent(fragment));
      stack.push(fragment);
    }
  }

  function indent(value: string): string {
    return `${'  '.repeat(stack.length)}${value}`;
  }

  try {
    await Promise.all([
      exitPromise,
      pipeline(
        proc.stdout,
        split2()
          .resume()
          .on('data', line => {
            if (!line) {
              return;
            }

            const match = line.match(/^ci:test-electron:event=(.*)/);
            if (!match) {
              const debugMatch = line.match(/ci:test-electron:debug=(.*)?/);
              if (debugMatch) {
                try {
                  console.log('DEBUG:', JSON.parse(debugMatch[1]));
                } catch {
                  // pass
                }
              }
              return;
            }

            const event = eventSchema.parse(JSON.parse(match[1]));
            if (event.type === 'pass') {
              pass += 1;
              enter(event.title);

              console.log(
                indent(`${logSymbols.success} ${event.title.at(-1)}`)
              );
            } else if (event.type === 'fail') {
              failures.push(event);
              enter(event.title);

              console.error(
                indent(`${logSymbols.error} ${event.title.at(-1)}`)
              );
              console.error('');
              console.error(event.error);
            } else if (event.type === 'end') {
              done = true;
            } else {
              throw missingCaseError(event);
            }
          })
      ),
    ]);
  } catch (error) {
    if (exitSignal && RETRIABLE_SIGNALS.includes(exitSignal)) {
      return launchElectron(attempt + 1);
    }
    throw error;
  }

  if (!done) {
    throw new Error('Tests terminated early!');
  }

  if (failures.length) {
    console.error('');
    console.error('Failing tests:');
    console.error('');
    for (const { title, error } of failures) {
      console.log(` ${logSymbols.error} ${title.join(' ')}`);
      console.log(error);
      console.log('');
    }
  }

  console.log(
    `Passed ${pass} | Failed ${failures.length} | ` +
      `Total ${pass + failures.length}`
  );

  if (failures.length !== 0) {
    process.exit(1);
  }
}

async function main() {
  await launchElectron(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
