// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { File, Rule } from 'endanger';
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
  return semver.valid(version) !== null;
}

async function getLineContaining(file: File, text: string) {
  let lines = await file.lines();
  for (let line of lines) {
    if (await line.contains(text)) {
      return line;
    }
  }
  return null;
}

let dependencyTypes = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

export default function packageJsonVersionsShouldBePinned() {
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
      for (let file of files.modifiedOrCreated) {
        let pkg = await file.json();
        for (let dependencyType of dependencyTypes) {
          let deps = pkg[dependencyType];
          if (deps == null) {
            continue;
          }
          for (let depName of Object.keys(deps)) {
            let depVersion = deps[depName];
            if (!isPinnedVersion(depVersion)) {
              let line = await getLineContaining(
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
