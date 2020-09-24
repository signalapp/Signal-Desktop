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
