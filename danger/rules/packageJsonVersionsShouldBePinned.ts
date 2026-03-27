// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { File } from 'endanger';
import { Rule } from 'endanger';
import semver from 'semver';

function isPinnedVersion(spec: string): boolean {
  if (spec.startsWith('https:')) {
    return spec.includes('#');
  }
  let version: string;
  if (spec.startsWith('workspace:')) {
    version = spec.replace(/^workspace:/, '');
  } else {
    version = spec;
  }
  return semver.valid(version) != null;
}

async function getLineContaining(file: File, text: string) {
  const lines = await file.lines();
  for (const line of lines) {
    // oxlint-disable-next-line no-await-in-loop
    if (await line.contains(text)) {
      return line;
    }
  }
  return null;
}

const dependencyTypes = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

// oxlint-disable-next-line typescript/no-explicit-any
export default function packageJsonVersionsShouldBePinned(): Rule<any, any> {
  return new Rule({
    match: {
      files: ['**/package.json', '!**/node_modules/**'],
    },
    messages: {
      packageJsonVersionsShouldBePinned: `
				**Pin package.json versions**
				All package.json versions should be pinned to a specific version.
        See {depName}@{depVersion} in {filePath}#{dependencyType}.
			`,
    },
    async run({ files, context }) {
      for (const file of files.modifiedOrCreated) {
        // oxlint-disable-next-line no-await-in-loop
        const pkg = await file.json();
        for (const dependencyType of dependencyTypes) {
          const deps = pkg[dependencyType];
          if (deps == null) {
            continue;
          }
          for (const depName of Object.keys(deps)) {
            const depVersion = deps[depName];
            if (!isPinnedVersion(depVersion)) {
              // oxlint-disable-next-line no-await-in-loop
              const line = await getLineContaining(
                file,
                `"${depName}": "${depVersion}"`
              );
              context.warn(
                'packageJsonVersionsShouldBePinned',
                {
                  file,
                  line: line ?? undefined,
                },
                {
                  depName,
                  depVersion,
                  filePath: file.path,
                  dependencyType,
                }
              );
            }
          }
        }
      }
    },
  });
}
