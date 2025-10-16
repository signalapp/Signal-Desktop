// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getOwn } from '../../util/getOwn.std.js';

describe('getOwn', () => {
  class Person {
    public birthYear: number;

    constructor(birthYear: number) {
      this.birthYear = birthYear;
    }

    getAge() {
      return new Date().getFullYear() - this.birthYear;
    }
  }

  it('returns undefined when asking for a non-existent property', () => {
    const obj: Record<string, number> = { bar: 123 };
    assert.isUndefined(getOwn(obj, 'foo'));
  });

  it('returns undefined when asking for a non-own property', () => {
    const obj: Record<string, number> = { bar: 123 };
    assert.isUndefined(getOwn(obj, 'hasOwnProperty'));

    const person = new Person(1880);
    assert.isUndefined(getOwn(person, 'getAge'));
  });

  it('returns own properties', () => {
    const obj: Record<string, number> = { foo: 123 };
    assert.strictEqual(getOwn(obj, 'foo'), 123);

    const person = new Person(1880);
    assert.strictEqual(getOwn(person, 'birthYear'), 1880);
  });

  it('works even if `hasOwnProperty` has been overridden for the object', () => {
    const obj: Record<string, unknown> = {
      foo: 123,
      hasOwnProperty: () => true,
    };
    assert.strictEqual(getOwn(obj, 'foo'), 123);
    assert.isUndefined(getOwn(obj, 'bar'));
  });
});
