// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Stub for shouldNeverBeCalled utility

export function shouldNeverBeCalled(..._args: ReadonlyArray<unknown>): never {
  throw new Error('shouldNeverBeCalled was called');
}

export async function asyncShouldNeverBeCalled(..._args: ReadonlyArray<unknown>): Promise<never> {
  throw new Error('asyncShouldNeverBeCalled was called');
}
