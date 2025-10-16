// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import fastGlob from 'fast-glob';
import { gte } from 'semver';

// Note: because we don't run under electron - this is a path to binary
import ELECTRON_BINARY from 'electron';

import { drop } from '../util/drop.std.js';
import packageJson from '../util/packageJson.node.js';

const execFile = promisify(execFileCb);

// See https://en.wikipedia.org/wiki/Darwin_(operating_system)#Darwin_20_onwards
const MACOS_TO_DARWIN_VERSIONS = new Map([
  // Big Sur
  ['11.0', '20.1.0'],
  ['11.1', '20.2.0'],
  ['11.2', '20.3.0'],
  ['11.3', '20.4.0'],
  ['11.4', '20.5.0'],

  // Monterey
  ['12.0', '21.0.1'],
  ['12.0.1', '21.1.0'],
  ['12.1', '21.2.0'],
  ['12.2', '21.3.0'],
  ['12.3', '21.4.0'],
  ['12.4', '21.5.0'],
  ['12.5', '21.6.0'],

  // Ventura
  ['13.0', '22.1.0'],
  ['13.1', '22.2.0'],
  ['13.2', '22.3.0'],
  ['13.3', '22.4.0'],
  ['13.4', '22.5.0'],
  ['13.5', '22.6.0'],

  // Sonoma
  ['14.0', '23.0.0'],
  ['14.1', '23.1.0'],
  ['14.2', '23.2.0'],
  ['14.3', '23.3.0'],
  ['14.4', '23.4.0'],
  ['14.5', '23.5.0'],

  // Sequoia
  ['15.0', '24.0.0'],

  // Tahoe
  ['26.0', '25.0.0'],
]);

async function macosVersionCheck(file: string) {
  console.log(`${file}: checking...`);

  const { stdout } = await execFile('otool', ['-l', file]);

  const match = stdout.match(/minos\s+([\d.]+)/);
  if (match == null) {
    throw new Error(`Failed to detect min OS version of ${file}`);
  }

  const [, macosVersion] = match;
  const darwinVersion = MACOS_TO_DARWIN_VERSIONS.get(macosVersion);
  if (darwinVersion == null) {
    throw new Error(`No matching darwin version for macOS ${macosVersion}`);
  }

  const minSupported = packageJson.build.mac.releaseInfo.vendor.minOSVersion;
  if (gte(minSupported, darwinVersion)) {
    console.log(`${file}: required version ${darwinVersion}`);
    return;
  }

  throw new Error(
    `${basename(file)} minimum darwin version is ${darwinVersion} ` +
      `(macOS ${macosVersion}), but package.json has ${minSupported}`
  );
}

function padGlibcVersion(version: string) {
  if (/^\d+\.\d+$/.test(version)) {
    return `${version}.0`;
  }
  if (/^\d+\.\d+\.\d+$/.test(version)) {
    return version;
  }
  throw new Error(`Unsupported glibc version: ${version}`);
}

async function linuxVersionCheck(file: string) {
  if (!existsSync(file)) {
    console.log(`${file}: skipping`);
    return;
  }

  console.log(`${file}: checking...`);

  const { stdout } = await execFile('objdump', ['-T', file], {
    maxBuffer: 100 * 1024 * 1024,
  });

  let minGlibcVersion: string | undefined;
  for (const [, unpaddedVersion] of stdout.matchAll(/GLIBC_([\d.]+)/g)) {
    const glibcVersion = padGlibcVersion(unpaddedVersion);
    if (minGlibcVersion == null || gte(glibcVersion, minGlibcVersion)) {
      minGlibcVersion = glibcVersion;
    }
  }

  if (minGlibcVersion == null) {
    throw new Error(`Failed to detect glibc versions of ${file}`);
  }

  const libc6Dependency = packageJson.build.deb.depends.find(req =>
    req.startsWith('libc6 ')
  );
  if (libc6Dependency == null) {
    throw new Error('Missing libc6 dependency in package.json');
  }

  const match = libc6Dependency.match(/^libc6 \(>= ([\d.]+)\)$/);
  if (match == null) {
    throw new Error(
      `Invalid libc6 dependency in package.json, ${libc6Dependency}`
    );
  }

  const minSupported = padGlibcVersion(match[1]);
  if (gte(minSupported, minGlibcVersion)) {
    console.log(`${file}: required version ${minGlibcVersion}`);
    return;
  }

  throw new Error(
    `${basename(file)} minimum GLIBC version is ${minGlibcVersion} ` +
      `but package.json has ${libc6Dependency}`
  );
}

async function main() {
  const BINARY_FILES = [
    ELECTRON_BINARY as unknown as string,
    ...(await fastGlob(
      packageJson.build.files
        .filter((p: unknown): p is string => typeof p === 'string')
        .filter(p => p.endsWith('.node'))
        .map(p => p.replace(/\${platform}/, process.platform))
        .map(p => p.replace(/\${arch}/, process.arch)),
      {
        absolute: true,
        onlyFiles: true,
        cwd: join(__dirname, '..', '..'),
      }
    )),
  ];
  if (process.platform === 'darwin') {
    for (const file of BINARY_FILES) {
      // eslint-disable-next-line no-await-in-loop
      await macosVersionCheck(file);
    }
  } else if (process.platform === 'linux') {
    for (const file of BINARY_FILES) {
      // eslint-disable-next-line no-await-in-loop
      await linuxVersionCheck(file);
    }
  }
}

drop(main());
