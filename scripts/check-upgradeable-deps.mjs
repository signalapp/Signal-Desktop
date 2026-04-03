// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import semver from 'semver';
import { got, HTTPError } from 'got';
import enquirer from 'enquirer';
import execa from 'execa';
import { assert } from './utils/assert.mjs';

const rootDir = join(import.meta.dirname, '..');

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
async function readJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

/**
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
function parseNumberField(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

const npm = got.extend({
  prefixUrl: 'https://registry.npmjs.org/',
  responseType: 'json',
  retry: {
    calculateDelay: retry => {
      if (
        retry.error instanceof HTTPError &&
        retry.error.response.statusCode === 429
      ) {
        const retryAfter = parseNumberField(
          retry.error.response.headers['retry-after']
        );
        if (retryAfter != null) {
          console.log(
            chalk.gray(`Rate limited, retrying after ${retryAfter} seconds`)
          );
          return retryAfter * 1000;
        }
      }

      return retry.computedValue;
    },
  },
});

const DependencyTypes = /** @type {const} */ ([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

/**
 * @typedef {object} LocalDependency
 * @prop {string} name
 * @prop {(typeof DependencyTypes)[number]} depType
 * @prop {string} requestedVersion
 * @prop {string} resolvedVersion
 */

/**
 * @typedef {object} FetchedDependencyProps
 * @prop {string} latestVersion
 * @prop {'commonjs' | 'esm'} moduleType
 * @prop {semver.ReleaseType | null} diff
 *
 * @typedef {LocalDependency & FetchedDependencyProps} FetchedDependency
 */

const packageJson = await readJsonFile(join(rootDir, 'package.json'));
const packageLock = await readJsonFile(join(rootDir, 'package-lock.json'));

/** @type {ReadonlyArray<LocalDependency>} */
const localDeps = DependencyTypes.flatMap(depType => {
  return Object.keys(packageJson[depType] ?? {}).map(name => {
    const requestedVersion = packageJson[depType][name];
    const resolvedVersion =
      packageLock.packages[`node_modules/${name}`]?.version;
    assert(resolvedVersion, `Could not find resolved version for ${name}`);

    return { name, depType, requestedVersion, resolvedVersion };
  });
});

console.log(chalk`Found {cyan ${localDeps.length}} local dependencies`);

/** @type {ReadonlyArray<FetchedDependency>} */
const fetchedDeps = await Promise.all(
  localDeps.map(async dep => {
    /** @type {any} */
    const info = await npm(`${dep.name}/latest`).json();
    const latestVersion = info.version;
    const moduleType = info.type ?? 'commonjs';
    assert(
      moduleType === 'commonjs' || moduleType === 'module',
      `Unexpected module type for ${dep.name}: ${moduleType}`
    );
    const diff = semver.lt(dep.resolvedVersion, latestVersion)
      ? semver.diff(dep.resolvedVersion, latestVersion)
      : null;
    return { ...dep, latestVersion, moduleType, diff };
  })
);

const outdatedDeps = fetchedDeps.filter(dep => dep.diff != null);
console.log(chalk`Found {cyan ${outdatedDeps.length}} outdated dependencies`);

const upgradeableDeps = outdatedDeps.filter(dep => {
  return dep.moduleType === 'commonjs';
});

console.log(
  chalk`Found {cyan ${upgradeableDeps.length}} upgradeable dependencies`
);

/** @type {Map<string, Set<string>>} */
const upgradeableDepsByDiff = new Map();

for (const dep of upgradeableDeps) {
  assert(dep.diff != null, 'Expected diff to be non-null');

  let group = upgradeableDepsByDiff.get(dep.diff);
  if (group == null) {
    group = new Set();
    upgradeableDepsByDiff.set(dep.diff, group);
  }

  group.add(dep.name);
}

for (const [diff, deps] of upgradeableDepsByDiff) {
  console.log(chalk` - ${diff}: {cyan ${deps.size}}`);
}

let longestNameLength = 0;
for (const dep of upgradeableDeps) {
  longestNameLength = Math.max(longestNameLength, dep.name.length);
}

/** @type {{ approvedDeps: ReadonlyArray<string>; }} */
const { approvedDeps } = await enquirer.prompt({
  type: 'multiselect',
  name: 'approvedDeps',
  message: 'Select which dependencies to upgrade',
  choices: upgradeableDeps.map(deps => {
    let color = chalk.red;
    if (deps.diff === 'patch') {
      color = chalk.green;
    } else if (deps.diff === 'minor') {
      color = chalk.yellow;
    }

    return {
      name: deps.name,
      message: deps.name.padEnd(longestNameLength),
      hint: `(${color(deps.diff)}: ${deps.resolvedVersion} -> ${color(deps.latestVersion)})`,
    };
  }),
});

console.log(
  chalk`Starting upgrade of {cyan ${approvedDeps.length}} dependencies`
);

for (const dep of upgradeableDeps) {
  try {
    if (!approvedDeps.includes(dep.name)) {
      console.log(chalk`Skipping ${dep.name}`);
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop
    const gitStatusBefore = await execa('git', ['status', '--porcelain']);
    if (gitStatusBefore.stdout.trim() !== '') {
      console.error(chalk`{red Found uncommitted changes, exiting}`);
      console.error(chalk.red(gitStatusBefore.stdout));
      process.exit(1);
    }

    console.log(
      chalk`Upgrading {cyan ${dep.name}} from {yellow ${dep.resolvedVersion}} to {magenta ${dep.latestVersion}}`
    );
    // oxlint-disable-next-line no-await-in-loop
    await execa(
      'npm',
      ['install', '--save-exact', `${dep.name}@${dep.latestVersion}`],
      { stdio: 'inherit' }
    );

    // oxlint-disable-next-line no-constant-condition
    while (true) {
      try {
        // oxlint-disable-next-line no-await-in-loop
        await execa(
          'npx',
          ['patch-package', '--error-on-fail', '--error-on-warn'],
          { stdio: 'inherit' }
        );
        break;
      } catch {
        /** @type {{ retry: boolean }} */
        // oxlint-disable-next-line no-await-in-loop
        const { retry } = await enquirer.prompt({
          type: 'confirm',
          name: 'retry',
          message: 'Retry patch-package?',
          initial: true,
        });

        if (!retry) {
          throw new Error('Failed to apply patch-package');
        }
      }
    }

    /** @type {{ npmScriptsToRun: Array<string> }} */
    // oxlint-disable-next-line no-await-in-loop
    const { npmScriptsToRun } = await enquirer.prompt({
      type: 'multiselect',
      name: 'npmScriptsToRun',
      message: 'Select which scripts to run',
      choices: [
        // Fast and common
        { name: 'oxlint' },
        { name: 'test-node' },
        { name: 'test-electron' },
        // Long
        { name: 'test-mock' },
        // Uncommon
        { name: 'test-oxlint' },
        { name: 'test-lint-intl' },
      ],
    });

    const allNpmScriptToRun = [
      // Mandatory
      'generate',
      'check:types',
      'lint-deps',
      // Optional
      ...npmScriptsToRun,
    ];

    for (const script of allNpmScriptToRun) {
      console.log(chalk`Running {cyan npm run ${script}}`);

      // oxlint-disable-next-line no-constant-condition
      while (true) {
        try {
          // oxlint-disable-next-line no-await-in-loop
          await execa('npm', ['run', script], { stdio: 'inherit' });
          break;
        } catch (error) {
          console.log(
            chalk.red(
              `Failed to run ${script}, you could go make changes and try again`
            )
          );

          /** @type {{ retry: boolean }} */
          // oxlint-disable-next-line no-await-in-loop
          const { retry } = await enquirer.prompt({
            type: 'confirm',
            name: 'retry',
            message: 'Retry running script?',
            initial: true,
          });

          if (!retry) {
            throw error;
          } else {
            console.log(chalk`Retrying {cyan npm run ${script}}`);
            continue;
          }
        }
      }
    }

    console.log('Changes after upgrade:');
    // oxlint-disable-next-line no-await-in-loop
    await execa('git', ['status', '--porcelain'], { stdio: 'inherit' });

    /** @type {{ commitChanges: boolean }} */
    // oxlint-disable-next-line no-await-in-loop
    const { commitChanges } = await enquirer.prompt({
      type: 'select',
      name: 'commitChanges',
      message: 'Commit these changes?',
      choices: [
        { name: 'commit', message: 'Commit and continue', value: true },
        { name: 'revert', message: 'Revert and skip', value: false },
      ],
    });

    if (!commitChanges) {
      console.log('Reverting changes, and skipping');
      // oxlint-disable-next-line no-await-in-loop
      await execa('git', ['checkout', '.']);
      continue;
    }

    console.log('Committing changes');
    // oxlint-disable-next-line no-await-in-loop
    await execa('git', ['add', '.']);
    // oxlint-disable-next-line no-await-in-loop
    await execa('git', [
      'commit',
      '-m',
      `Upgrade ${dep.name} ${dep.depType} from ${dep.requestedVersion} to ${dep.latestVersion}`,
    ]);
  } catch (error) {
    console.error(chalk.red(error));
    console.log(
      chalk.red(`Failed to upgrade ${dep.name}, reverting and skipping`)
    );
    // oxlint-disable-next-line no-await-in-loop
    await execa('git', ['checkout', '.']);
  }
}
