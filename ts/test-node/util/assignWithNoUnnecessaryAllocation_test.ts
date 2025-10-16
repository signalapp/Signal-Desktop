// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation.std.js';

describe('assignWithNoUnnecessaryAllocation', () => {
  type Person = {
    name?: string;
    age?: number;
  };

  it('returns the same object if there are no modifications', () => {
    const empty = {};
    assert.strictEqual(assignWithNoUnnecessaryAllocation(empty, {}), empty);

    const obj = {
      foo: 'bar',
      baz: 'qux',
      und: undefined,
    };
    assert.strictEqual(assignWithNoUnnecessaryAllocation(obj, {}), obj);
    assert.strictEqual(
      assignWithNoUnnecessaryAllocation(obj, { foo: 'bar' }),
      obj
    );
    assert.strictEqual(
      assignWithNoUnnecessaryAllocation(obj, { baz: 'qux' }),
      obj
    );
    assert.strictEqual(
      assignWithNoUnnecessaryAllocation(obj, { und: undefined }),
      obj
    );
  });

  it('returns a new object if there are modifications', () => {
    const empty: Person = {};
    assert.deepEqual(
      assignWithNoUnnecessaryAllocation(empty, { name: 'Bert' }),
      { name: 'Bert' }
    );
    assert.deepEqual(assignWithNoUnnecessaryAllocation(empty, { age: 8 }), {
      age: 8,
    });
    assert.deepEqual(
      assignWithNoUnnecessaryAllocation(empty, { name: undefined }),
      {
        name: undefined,
      }
    );

    const obj: Person = { name: 'Ernie' };
    assert.deepEqual(
      assignWithNoUnnecessaryAllocation(obj, { name: 'Big Bird' }),
      {
        name: 'Big Bird',
      }
    );
    assert.deepEqual(assignWithNoUnnecessaryAllocation(obj, { age: 9 }), {
      name: 'Ernie',
      age: 9,
    });
    assert.deepEqual(
      assignWithNoUnnecessaryAllocation(obj, { age: undefined }),
      {
        name: 'Ernie',
        age: undefined,
      }
    );
  });

  it('only performs a shallow comparison', () => {
    const obj = { foo: { bar: 'baz' } };
    assert.notStrictEqual(
      assignWithNoUnnecessaryAllocation(obj, { foo: { bar: 'baz' } }),
      obj
    );
  });

  it("doesn't modify the original object when there are no modifications", () => {
    const empty = {};
    assignWithNoUnnecessaryAllocation(empty, {});
    assert.deepEqual(empty, {});

    const obj = { foo: 'bar' };
    assignWithNoUnnecessaryAllocation(obj, { foo: 'bar' });
    assert.deepEqual(obj, { foo: 'bar' });
  });

  it("doesn't modify the original object when there are modifications", () => {
    const empty: Person = {};
    assignWithNoUnnecessaryAllocation(empty, { name: 'Bert' });
    assert.deepEqual(empty, {});

    const obj = { foo: 'bar' };
    assignWithNoUnnecessaryAllocation(obj, { foo: 'baz' });
    assert.deepEqual(obj, { foo: 'bar' });
  });
});
