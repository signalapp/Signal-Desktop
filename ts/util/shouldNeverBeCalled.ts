// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from './assert';

export function shouldNeverBeCalled(..._args: ReadonlyArray<unknown>): void {
  assert(false, 'This should never be called. Doing nothing');
}

export async function asyncShouldNeverBeCalled(
  ..._args: ReadonlyArray<unknown>
): Promise<undefined> {
  shouldNeverBeCalled();

  return undefined;
}
