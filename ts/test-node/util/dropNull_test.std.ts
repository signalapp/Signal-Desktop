// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { dropNull, shallowDropNull } from '../../util/dropNull.std.js';

type Test = {
  a: number | null;
  b: number | undefined;
};

describe('dropNull', () => {
  it('swaps null with undefined', () => {
    assert.strictEqual(dropNull(null), undefined);
  });

  it('leaves undefined be', () => {
    assert.strictEqual(dropNull(undefined), undefined);
  });

  it('non-null values undefined be', () => {
    assert.strictEqual(dropNull('test'), 'test');
  });

  describe('shallowDropNull', () => {
    it('return undefined with given null', () => {
      assert.strictEqual(shallowDropNull<Test>(null), undefined);
    });

    it('return undefined with given undefined', () => {
      assert.strictEqual(shallowDropNull<Test>(undefined), undefined);
    });

    it('swaps null with undefined', () => {
      const result:
        | {
            a: number | undefined;
            b: number | undefined;
          }
        | undefined = shallowDropNull<Test>({
        a: null,
        b: 1,
      });

      assert.deepStrictEqual(result, { a: undefined, b: 1 });
    });

    it('leaves undefined be', () => {
      const result:
        | {
            a: number | undefined;
            b: number | undefined;
          }
        | undefined = shallowDropNull<Test>({
        a: 1,
        b: undefined,
      });

      assert.deepStrictEqual(result, { a: 1, b: undefined });
    });
  });
});
