// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import { join, resolve } from 'node:path';
import { readdir as readdirCallback } from 'node:fs';

import pify from 'pify';

import * as Errors from '../types/errors.std.js';
import { getCliOptions } from './common.main.js';
import { writeSignature } from './signature.node.js';
import { version as packageVersion } from '../util/packageJson.node.js';

const readdir = pify(readdirCallback);

const OPTIONS = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  },
  {
    names: ['private', 'p'],
    type: 'string',
    help: 'Path to private key file (default: ./private.key)',
    default: 'private.key',
  },
  {
    names: ['update', 'u'],
    type: 'string',
    help: 'Path to the update package (default: the .exe or .zip in ./release)',
  },
  {
    names: ['version', 'v'],
    type: 'string',
    help: `Version number of this package (default: ${packageVersion})`,
    default: packageVersion,
  },
];

type OptionsType = {
  private: string;
  update: string;
  version: string;
};

const cliOptions = getCliOptions<OptionsType>(OPTIONS);
go(cliOptions).catch(error => {
  console.error('Something went wrong!', Errors.toLogFormat(error));
});

async function go(options: OptionsType) {
  const { private: privateKeyPath, version } = options;

  let updatePaths: Array<string>;
  if (options.update) {
    updatePaths = [options.update];
  } else {
    updatePaths = await findUpdatePaths();
  }

  await Promise.all(
    updatePaths.map(async updatePath => {
      console.log('Signing with...');
      console.log(`  version: ${version}`);
      console.log(`  update file: ${updatePath}`);
      console.log(`  private key file: ${privateKeyPath}`);

      await writeSignature(updatePath, version, privateKeyPath);
    })
  );
}

const IS_EXE = /\.exe$/;
const IS_ZIP = /\.zip$/;
async function findUpdatePaths(): Promise<Array<string>> {
  const releaseDir = resolve('release');
  const files: Array<string> = await readdir(releaseDir);

  const max = files.length;
  const results = new Array<string>();
  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = join(releaseDir, file);

    if (IS_EXE.test(file) || IS_ZIP.test(file)) {
      results.push(fullPath);
    }
  }

  if (results.length === 0) {
    throw new Error("No suitable file found in 'release' folder!");
  }

  return results;
}
