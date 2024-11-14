// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop */

import { join } from 'path';
import { readFile } from 'fs/promises';
import chalk from 'chalk';
import semver from 'semver';
import got from 'got';
import enquirer from 'enquirer';
import execa from 'execa';

const rootDir = join(__dirname, '..', '..');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJsonFile(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

function parseNumberField(value: string | number | null | void): number | null {
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
        retry.error instanceof got.HTTPError &&
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

const DependencyTypes = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

type LocalDependency = Readonly<{
  name: string;
  depType: (typeof DependencyTypes)[number];
  requestedVersion: string;
  resolvedVersion: string;
}>;

type FetchedDependency = LocalDependency &
  Readonly<{
    latestVersion: string;
    moduleType: 'commonjs' | 'esm';
    diff: semver.ReleaseType | null;
  }>;

async function main() {
  const packageJson = await readJsonFile(join(rootDir, 'package.json'));
  const packageLock = await readJsonFile(join(rootDir, 'package-lock.json'));

  const localDeps: ReadonlyArray<LocalDependency> = DependencyTypes.flatMap(
    depType => {
      return Object.keys(packageJson[depType] ?? {}).map(name => {
        const requestedVersion = packageJson[depType][name];
        const resolvedVersion =
          packageLock.packages[`node_modules/${name}`]?.version;
        assert(resolvedVersion, `Could not find resolved version for ${name}`);

        return { name, depType, requestedVersion, resolvedVersion };
      });
    }
  );

  console.log(chalk`Found {cyan ${localDeps.length}} local dependencies`);

  const fetchedDeps: ReadonlyArray<FetchedDependency> = await Promise.all(
    localDeps.map(async dep => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info: any = await npm(`${dep.name}/latest`).json();
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

  const upgradeableDepsByDiff = new Map<string, Set<string>>();

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

  const { approvedDeps } = await enquirer.prompt<{
    approvedDeps: ReadonlyArray<string>;
  }>({
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
        message: `${deps.name.padEnd(longestNameLength)}`,
        hint: `(${color(deps.diff)}: ${deps.resolvedVersion} -> ${color(deps.latestVersion)})`,
      };
    }),
  });

  console.log(
    chalk`Starting upgrade of {cyan ${approvedDeps.length}} dependencies`
  );

  // eslint-disable no-await-in-loop
  for (const dep of upgradeableDeps) {
    try {
      if (!approvedDeps.includes(dep.name)) {
        console.log(chalk`Skipping ${dep.name}`);
        continue;
      }

      const gitStatusBefore = await execa('git', ['status', '--porcelain']);
      if (gitStatusBefore.stdout.trim() !== '') {
        console.error(chalk`{red Found uncommitted changes, exiting}`);
        console.error(chalk.red(gitStatusBefore.stdout));
        process.exit(1);
      }

      console.log(
        chalk`Upgrading {cyan ${dep.name}} from {yellow ${dep.resolvedVersion}} to {magenta ${dep.latestVersion}}`
      );
      await execa(
        'npm',
        ['install', '--save-exact', `${dep.name}@${dep.latestVersion}`],
        { stdio: 'inherit' }
      );

      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await execa(
            'npx',
            ['patch-package', '--error-on-fail', '--error-on-warn'],
            { stdio: 'inherit' }
          );
          break;
        } catch {
          const { retry } = await enquirer.prompt<{ retry: boolean }>({
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

      const { npmScriptsToRun } = await enquirer.prompt<{
        npmScriptsToRun: Array<string>;
      }>({
        type: 'multiselect',
        name: 'npmScriptsToRun',
        message: 'Select which scripts to run',
        choices: [
          // Fast and common
          { name: 'eslint' },
          { name: 'test-node' },
          { name: 'test-electron' },
          // Long
          { name: 'test-mock' },
          // Uncommon
          { name: 'test-eslint' },
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

        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await execa('npm', ['run', script], { stdio: 'inherit' });
            break;
          } catch (error) {
            console.log(
              chalk.red(
                `Failed to run ${script}, you could go make changes and try again`
              )
            );

            const { retry } = await enquirer.prompt<{
              retry: boolean;
            }>({
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
      await execa('git', ['status', '--porcelain'], { stdio: 'inherit' });

      const { commitChanges } = await enquirer.prompt<{
        commitChanges: boolean;
      }>({
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
        await execa('git', ['checkout', '.']);
        continue;
      }

      console.log('Committing changes');
      await execa('git', ['add', '.']);
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
      await execa('git', ['checkout', '.']);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
