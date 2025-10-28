// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assertDev } from './assert.std.js';

export function shouldNeverBeCalled(..._args: ReadonlyArray<unknown>): never {
  assertDev(false, 'This should never be called. Doing nothing');
}

export async function asyncShouldNeverBeCalled(
  ..._args: ReadonlyArray<unknown>
): Promise<undefined> {
  shouldNeverBeCalled();

  return undefined;
}
