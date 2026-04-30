// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* oxlint-disable no-console */

import { exec } from 'node:child_process';
import { userConfig } from '../../app/user_config.main.ts';

export async function maybeMigrateSafeStorageBackend(
  previousBackend: string,
  newBackend: string
): Promise<boolean> {
  if (previousBackend === 'kwallet5' && newBackend === 'kwallet6') {
    return upgradeKWallet5To6();
  }

  if (previousBackend === 'kwallet6' && newBackend === 'kwallet5') {
    return downgradeKWallet6To5();
  }

  return false;
}

async function upgradeKWallet5To6(): Promise<boolean> {
  if (await checkCommandSuccess('kwalletd5 --version')) {
    console.log(
      'kwalletd5 --version check did not fail, so it may still be installed. Aborting upgrade.'
    );
    return false;
  }

  if (!(await checkCommandSuccess('kwalletd6 --version'))) {
    console.log(
      'kwalletd6 --version check did not succeed, so it may not be installed. Aborting upgrade'
    );
    return false;
  }

  userConfig.set('safeStorageBackend', 'kwallet6');
  return true;
}

async function downgradeKWallet6To5(): Promise<boolean> {
  if (await checkCommandSuccess('kwalletd6 --version')) {
    console.log(
      'kwalletd6 --version check did not fail, so it may still be installed. Aborting upgrade.'
    );
    return false;
  }

  if (!(await checkCommandSuccess('kwalletd5 --version'))) {
    console.log(
      'kwalletd5 --version check did not succeed, so it may not be installed. Aborting upgrade'
    );
    return false;
  }

  userConfig.set('safeStorageBackend', 'kwallet5');
  return true;
}

function checkCommandSuccess(command: string): Promise<boolean> {
  return new Promise(resolve => {
    exec(command).on('exit', code => {
      resolve(code === 0);
    });
  });
}
