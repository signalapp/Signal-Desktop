// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import type { Account } from '../types/Account.std.ts';
import { strictAssert } from '../util/assert.std.ts';

let account: Account | undefined;

export async function loadAccount(): Promise<void> {
  account = await DataReader.getAccount();
}

export function getAccountForRedux(): Account {
  strictAssert(account != null, 'account has not been loaded');
  return account;
}
