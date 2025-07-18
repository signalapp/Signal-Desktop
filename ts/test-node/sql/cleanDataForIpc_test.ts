// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { noop } from 'lodash';

import { cleanDataForIpc } from '../../sql/cleanDataForIpc';

describe('cleanDataForIpc', () => {
  it('does nothing to JSON primitives', () => {
    ['', 'foo bar', 0, 123, true, false, null].forEach(value => {
      assert.deepEqual(cleanDataForIpc(value), {
        cleaned: value,
        pathsChanged: [],
      });
    });
  });

  it('does nothing to undefined', () => {
    // Though `undefined` is not technically JSON-serializable, we don't clean it because
    //   its key is dropped.
    assert.deepEqual(cleanDataForIpc(undefined), {
      cleaned: undefined,
      pathsChanged: [],
    });
  });

  it('converts BigInts to strings', () => {
    assert.deepEqual(cleanDataForIpc(BigInt(0)), {
      cleaned: '0',
      pathsChanged: ['root'],
    });
    assert.deepEqual(cleanDataForIpc(BigInt(123)), {
      cleaned: '123',
      pathsChanged: ['root'],
    });
    assert.deepEqual(cleanDataForIpc(BigInt(-123)), {
      cleaned: '-123',
      pathsChanged: ['root'],
    });
  });

  it('converts functions to `undefined` but does not mark them as cleaned, for backwards compatibility', () => {
    assert.deepEqual(cleanDataForIpc(noop), {
      cleaned: undefined,
      pathsChanged: [],
    });
  });

  it('converts symbols to `undefined`', () => {
    assert.deepEqual(cleanDataForIpc(Symbol('test')), {
      cleaned: undefined,
      pathsChanged: ['root'],
    });
  });

  it('converts ArrayBuffers to `undefined`', () => {
    assert.deepEqual(cleanDataForIpc(new ArrayBuffer(2)), {
      cleaned: undefined,
      pathsChanged: ['root'],
    });
  });

  it('keeps Buffers in a field', () => {
    const buffer = new Uint8Array([0xaa, 0xbb, 0xcc]);

    assert.deepEqual(cleanDataForIpc(buffer), {
      cleaned: buffer,
      pathsChanged: [],
    });
  });

  it('converts valid dates to ISO strings', () => {
    assert.deepEqual(cleanDataForIpc(new Date(924588548000)), {
      cleaned: '1999-04-20T06:09:08.000Z',
      pathsChanged: ['root'],
    });
  });

  it('converts invalid dates to `undefined`', () => {
    assert.deepEqual(cleanDataForIpc(new Date(NaN)), {
      cleaned: undefined,
      pathsChanged: ['root'],
    });
  });

  it('converts other iterables to arrays', () => {
    assert.deepEqual(cleanDataForIpc(new Float32Array([1, 2, 3])), {
      cleaned: [1, 2, 3],
      pathsChanged: ['root'],
    });

    function* generator() {
      yield 1;
      yield 2;
    }
    assert.deepEqual(cleanDataForIpc(generator()), {
      cleaned: [1, 2],
      pathsChanged: ['root'],
    });
  });

  it('deeply cleans arrays, removing `undefined` and `null`s', () => {
    const result = cleanDataForIpc([
      12,
      Symbol('top level symbol'),
      { foo: 3, symb: Symbol('nested symbol 1') },
      [45, Symbol('nested symbol 2')],
      undefined,
      null,
    ]);

    assert.deepEqual(result.cleaned, [
      12,
      undefined,
      {
        foo: 3,
        symb: undefined,
      },
      [45, undefined],
    ]);
    assert.sameMembers(result.pathsChanged, [
      'root.1',
      'root.2.symb',
      'root.3.1',
      'root.4',
      'root.5',
    ]);
  });

  it('deeply cleans sets and converts them to arrays', () => {
    const result = cleanDataForIpc(
      new Set([
        12,
        Symbol('top level symbol'),
        { foo: 3, symb: Symbol('nested symbol 1') },
        [45, Symbol('nested symbol 2')],
      ])
    );

    assert.isArray(result.cleaned);
    assert.sameDeepMembers(result.cleaned, [
      12,
      undefined,
      {
        foo: 3,
        symb: undefined,
      },
      [45, undefined],
    ]);
    assert.sameMembers(result.pathsChanged, [
      'root',
      'root.<iterator index 1>',
      'root.<iterator index 2>.symb',
      'root.<iterator index 3>.1',
    ]);
  });

  it('deeply cleans maps and converts them to objects', () => {
    const result = cleanDataForIpc(
      new Map<unknown, unknown>([
        ['key 1', 'value'],
        [Symbol('symbol key'), 'dropped'],
        ['key 2', ['foo', Symbol('nested symbol')]],
        [3, 'dropped'],
        [BigInt(4), 'dropped'],
      ])
    );

    assert.deepEqual(result.cleaned, {
      'key 1': 'value',
      'key 2': ['foo', undefined],
    });
    assert.sameMembers(result.pathsChanged, [
      'root',
      'root.<map key Symbol(symbol key)>',
      'root.<map value at key 2>.1',
      'root.<map key 3>',
      'root.<map key 4>',
    ]);
  });

  it('calls `toNumber` when available', () => {
    assert.deepEqual(
      cleanDataForIpc([
        {
          toNumber() {
            return 5;
          },
        },
        {
          toNumber() {
            return Symbol('bogus');
          },
        },
      ]),
      {
        cleaned: [5, undefined],
        pathsChanged: ['root.1'],
      }
    );
  });

  it('deeply cleans objects with a `null` prototype', () => {
    const value = Object.assign(Object.create(null), {
      'key 1': 'value',
      [Symbol('symbol key')]: 'dropped',
      'key 2': ['foo', Symbol('nested symbol')],
    });
    const result = cleanDataForIpc(value);

    assert.deepEqual(result.cleaned, {
      'key 1': 'value',
      'key 2': ['foo', undefined],
    });
    assert.sameMembers(result.pathsChanged, ['root.key 2.1']);
  });

  it('deeply cleans objects with a prototype of `Object.prototype`', () => {
    const value = {
      'key 1': 'value',
      [Symbol('symbol key')]: 'dropped',
      'key 2': ['foo', Symbol('nested symbol')],
    };
    const result = cleanDataForIpc(value);

    assert.deepEqual(result.cleaned, {
      'key 1': 'value',
      'key 2': ['foo', undefined],
    });
    assert.sameMembers(result.pathsChanged, ['root.key 2.1']);
  });

  it('deeply cleans class instances', () => {
    class Person {
      public toBeDiscarded = Symbol('to be discarded');

      constructor(
        public firstName: string,
        public lastName: string
      ) {}

      get name() {
        return this.getName();
      }

      getName() {
        return `${this.firstName} ${this.lastName}`;
      }
    }
    const person = new Person('Selena', 'Gomez');
    const result = cleanDataForIpc(person);

    assert.deepEqual(result.cleaned, {
      firstName: 'Selena',
      lastName: 'Gomez',
      toBeDiscarded: undefined,
    });
    assert.sameMembers(result.pathsChanged, ['root', 'root.toBeDiscarded']);
  });
});
