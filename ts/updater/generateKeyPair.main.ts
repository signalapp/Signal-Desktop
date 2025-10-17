// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import * as Errors from '../types/errors.std.js';
import { getCliOptions } from './common.main.js';
import { keyPair } from './curve.node.js';
import { writeHexToPath } from './signature.node.js';

const OPTIONS = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  },
  {
    names: ['key', 'k'],
    type: 'string',
    help: 'Path where public key will go',
    default: 'public.key',
  },
  {
    names: ['private', 'p'],
    type: 'string',
    help: 'Path where private key will go',
    default: 'private.key',
  },
];

type OptionsType = {
  key: string;
  private: string;
};

const cliOptions = getCliOptions<OptionsType>(OPTIONS);
go(cliOptions).catch(error => {
  console.error('Something went wrong!', Errors.toLogFormat(error));
});

async function go(options: OptionsType) {
  const { key: publicKeyPath, private: privateKeyPath } = options;
  const { publicKey, privateKey } = keyPair();

  await Promise.all([
    writeHexToPath(publicKeyPath, publicKey),
    writeHexToPath(privateKeyPath, privateKey),
  ]);
}
