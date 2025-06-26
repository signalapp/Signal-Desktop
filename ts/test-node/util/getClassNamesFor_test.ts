// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getClassNamesFor } from '../../util/getClassNamesFor';

describe('getClassNamesFor', () => {
  it('returns a function', () => {
    const f = getClassNamesFor('hello-world');
    assert.isFunction(f);
  });

  it('returns a function that adds a modifier', () => {
    const f = getClassNamesFor('module');
    assert.equal(f('__modifier'), 'module__modifier');
  });

  it('does not add anything if there is no modifier', () => {
    const f = getClassNamesFor('module');
    assert.equal(f(), '');
    // @ts-expect-error -- test case
    assert.equal(f(undefined && '__modifier'), '');
  });

  it('but does return the top level module if the modifier is empty string', () => {
    const f = getClassNamesFor('module1', 'module2');
    assert.equal(f(''), 'module1 module2');
  });

  it('adds multiple class names', () => {
    const f = getClassNamesFor('module1', 'module2', 'module3');
    assert.equal(
      f('__modifier'),
      'module1__modifier module2__modifier module3__modifier'
    );
  });

  it('skips parent modules that are undefined', () => {
    const f = getClassNamesFor('module1', undefined, 'module3');
    assert.equal(f('__modifier'), 'module1__modifier module3__modifier');
  });
});
