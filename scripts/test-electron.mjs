// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { spawn } from 'node:child_process';
import path, { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { cpus, tmpdir } from 'node:os';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import crypto from 'node:crypto';
import z from 'zod';
import split2 from 'split2';
import logSymbols from 'log-symbols';
import { unreachable } from './utils/assert.mjs';
import { SECOND } from './utils/durations.mjs';

const ROOT_DIR = join(import.meta.dirname, '..');

/**
 * @returns {number}
 */
function getWorkerCount() {
  if (process.env.WORKER_COUNT) {
    return parseInt(process.env.WORKER_COUNT, 10);
  }
  if (process.env.CI) {
    return Math.min(8, cpus().length);
  }
  return 1;
}

const WORKER_COUNT = getWorkerCount();

const ELECTRON = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const MAX_RETRIES = 3;
const RETRIABLE_SIGNALS = ['SIGBUS'];

const failureSchema = z.object({
  type: z.literal('fail'),
  title: z.string().array(),
  error: z.string(),
});

/** @typedef {z.infer<typeof failureSchema>} Failure */

const eventSchema = z
  .object({
    type: z.literal('pass'),
    title: z.string().array(),
    duration: z.number(),
  })
  .or(failureSchema)
  .or(
    z.object({
      type: z.literal('end'),
    })
  );

/**
 * @param {number} worker
 * @param {number} attempt
 * @returns {Promise<{ pass: number; failures: Array<Failure> }>}
 */
async function launchElectron(worker, attempt) {
  if (attempt > MAX_RETRIES) {
    console.error(`Failed after ${MAX_RETRIES} retries, exiting.`);
    process.exit(1);
  }

  if (attempt !== 1) {
    console.log(
      `Launching electron ${worker} for tests, attempt #${attempt}...`
    );
  }

  const storagePath = await mkdtemp(join(tmpdir(), 'signal-test-'));

  const proc = spawn(
    ELECTRON,
    [
      'ci.js',
      '--worker',
      worker.toString(),
      '--worker-count',
      WORKER_COUNT.toString(),
      ...process.argv.slice(2),
    ],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        // Setting NODE_ENV to test triggers main.ts to load
        // 'test/index.html' instead of 'background.html', which loads the tests
        // via `test.js`
        NODE_ENV: 'test',
        TEST_QUIT_ON_COMPLETE: 'on',
        SIGNAL_CI_CONFIG: JSON.stringify({
          storagePath,
        }),
        // Necessary for `tsx` to work in preload (there are no worker_threads)
        ESBUILD_WORKER_THREADS: '0',
      },
      // Since we run `.cmd` file on Windows - use shell
      shell: process.platform === 'win32',
    }
  );

  /** @type {PromiseWithResolvers<void>} */
  const { resolve, reject, promise: exitPromise } = Promise.withResolvers();

  /** @type {string | undefined} */
  let exitSignal;
  proc.on('exit', (code, signal) => {
    if (code === 0) {
      resolve();
    } else {
      exitSignal = signal || undefined;
      reject(new Error(`Exit code: ${code}`));
    }
  });

  let pass = 0;
  /** @type {Array<Failure>} */
  const failures = [];
  let done = false;

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

              process.stdout.write(logSymbols.success);
              if (event.duration > SECOND) {
                console.error('');
                console.error(
                  `  ${logSymbols.warning} ${event.title.join(' ')} ` +
                    `took ${event.duration}ms`
                );
              }
            } else if (event.type === 'fail') {
              failures.push(event);

              console.error('');
              console.error(`  ${logSymbols.error} ${event.title.join(' ')}`);
              console.error('');
              console.error(event.error);
            } else if (event.type === 'end') {
              done = true;
            } else {
              unreachable(event);
            }
          })
      ),
    ]);
  } catch (error) {
    if (exitSignal && RETRIABLE_SIGNALS.includes(exitSignal)) {
      return launchElectron(worker, attempt + 1);
    }
    throw error;
  } finally {
    try {
      if (failures.length) {
        const artifactsDir = await makeArtifactsDir();
        if (artifactsDir) {
          await rename(
            path.join(storagePath, 'logs'),
            path.join(artifactsDir, 'logs')
          );
          console.log('\n');
          console.log(`Saving logs to ${artifactsDir}`);
        }
      }

      await rm(storagePath, { recursive: true });
    } catch {
      // Ignore
    }
  }

  if (!done) {
    throw new Error('Tests terminated early!');
  }

  return { pass, failures };
}

/**
 * @returns {Promise<string | undefined>}
 */
async function makeArtifactsDir() {
  const { ARTIFACTS_DIR } = process.env;
  if (!ARTIFACTS_DIR) {
    console.log('\nTo save artifacts, please set ARTIFACTS_DIR env variable\n');
    return undefined;
  }

  const normalizedPath = crypto.randomBytes(8).toString('hex');

  const outDir = path.join(ARTIFACTS_DIR, normalizedPath);
  await mkdir(outDir, { recursive: true });

  return outDir;
}

const promises = [];
for (let i = 0; i < WORKER_COUNT; i += 1) {
  promises.push(launchElectron(i, 1));
}
const results = await Promise.all(promises);

let pass = 0;
/** @type {Array<Failure>} */
let failures = [];
for (const result of results) {
  pass += result.pass;
  failures = failures.concat(result.failures);
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

console.log('');
console.log(
  `Passed ${pass} | Failed ${failures.length} | ` +
    `Total ${pass + failures.length}`
);

if (failures.length !== 0) {
  process.exit(1);
}
