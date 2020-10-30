// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

export async function assertRejects(fn: () => Promise<unknown>): Promise<void> {
  let err: unknown;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  assert(
    err instanceof Error,
    'Expected promise to reject with an Error, but it resolved'
  );
}
