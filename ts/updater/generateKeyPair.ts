import { getCliOptions, getPrintableError } from './common';
import { keyPair } from './curve';
import { writeHexToPath } from './signature';

/* tslint:disable:no-console */

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
  console.error('Something went wrong!', getPrintableError(error));
});

async function go(options: OptionsType) {
  const { key: publicKeyPath, private: privateKeyPath } = options;
  const { publicKey, privateKey } = keyPair();

  await Promise.all([
    writeHexToPath(publicKeyPath, publicKey),
    writeHexToPath(privateKeyPath, privateKey),
  ]);
}
