// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Root } from 'protobufjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Partial, Full } = (Root as any).fromJSON({
  nested: {
    test: {
      nested: {
        Partial: {
          fields: {
            a: {
              type: 'string',
              id: 1,
            },
            c: {
              type: 'int32',
              id: 3,
            },
          },
        },
        Full: {
          fields: {
            a: {
              type: 'string',
              id: 1,
            },
            b: {
              type: 'bool',
              id: 2,
            },
            c: {
              type: 'int32',
              id: 3,
            },
            d: {
              type: 'bytes',
              id: 4,
            },
          },
        },
      },
    },
  },
}).nested.test;

describe('Proto#$unknownFields', () => {
  it('should encode and decode with unknown fields', () => {
    const full = Full.encode({
      a: 'hello',
      b: true,
      c: 42,
      d: Buffer.from('ohai'),
    }).finish();

    const partial = Partial.decode(full);
    assert.strictEqual(partial.a, 'hello');
    assert.strictEqual(partial.c, 42);
    assert.strictEqual(partial.$unknownFields.length, 2);
    assert.strictEqual(
      Buffer.from(partial.$unknownFields[0]).toString('hex'),
      '1001'
    );
    assert.strictEqual(
      Buffer.from(partial.$unknownFields[1]).toString('hex'),
      '22046f686169'
    );

    const encoded = Partial.encode({
      a: partial.a,
      c: partial.c,
      $unknownFields: partial.$unknownFields,
    }).finish();
    const decoded = Full.decode(encoded);

    assert.strictEqual(decoded.a, 'hello');
    assert.strictEqual(decoded.b, true);
    assert.strictEqual(decoded.c, 42);
    assert.strictEqual(Buffer.from(decoded.d).toString(), 'ohai');

    const concat = Partial.encode({
      a: partial.a,
      c: partial.c,
      $unknownFields: [Buffer.concat(partial.$unknownFields)],
    }).finish();
    const decodedConcat = Full.decode(concat);

    assert.strictEqual(decodedConcat.a, 'hello');
    assert.isTrue(decodedConcat.b);
    assert.strictEqual(decodedConcat.c, 42);
    assert.strictEqual(Buffer.from(decodedConcat.d).toString(), 'ohai');
  });

  it('should decode unknown fields before reencoding them', () => {
    const full = Full.encode({
      a: 'hello',
      b: true,
      c: 42,
      d: Buffer.from('ohai'),
    }).finish();

    const partial = Partial.decode(full);
    assert.isUndefined(partial.b);

    const encoded = Full.encode({
      ...partial,
      b: false,
    }).finish();
    const decoded = Full.decode(encoded);

    assert.strictEqual(decoded.a, 'hello');
    assert.isFalse(decoded.b);
    assert.strictEqual(decoded.c, 42);
    assert.strictEqual(Buffer.from(decoded.d).toString(), 'ohai');
  });

  it('should not set unknown fields if all fields were known', () => {
    const encoded = Partial.encode({
      a: 'hello',
      c: 42,
    }).finish();
    const decoded = Full.decode(encoded);

    assert.strictEqual(decoded.a, 'hello');
    assert.strictEqual(decoded.c, 42);
    assert.isUndefined(decoded.$unknownFields);

    const encodedWithEmptyArray = Partial.encode({
      a: 'hi',
      c: 69,
      $unkownFields: [],
    }).finish();
    const decodedWithEmptyArray = Full.decode(encodedWithEmptyArray);

    assert.strictEqual(decodedWithEmptyArray.a, 'hi');
    assert.strictEqual(decodedWithEmptyArray.c, 69);
    assert.isUndefined(decodedWithEmptyArray.$unknownFields);
  });
});
