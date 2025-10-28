// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getInitials } from '../../util/getInitials.std.js';

describe('getInitials', () => {
  it('returns undefined when passed undefined', () => {
    assert.isUndefined(getInitials(undefined));
  });

  it('returns undefined when passed an empty string', () => {
    assert.isUndefined(getInitials(''));
  });

  it('returns undefined when passed a string with no letters', () => {
    assert.isUndefined(getInitials('123 !@#$%'));
  });

  it('returns the first letter of a name that is one ASCII word', () => {
    assert.strictEqual(getInitials('Foo'), 'F');
    assert.strictEqual(getInitials('Bo'), 'B');
  });

  it('returns lowercase initials for lowercase names', () => {
    assert.strictEqual(getInitials('alice'), 'a');
    assert.strictEqual(getInitials('foo bar'), 'fb');
  });

  it('returns initials for lowercase with uppercase names', () => {
    assert.strictEqual(getInitials('foo Bar'), 'fB');
    assert.strictEqual(getInitials('Foo bar'), 'Fb');
  });

  [
    'Foo Bar',
    'F Bar',
    'Foo B',
    'FB',
    'F.B.',
    '0Foo 1Bar',
    "Foo B'Ar",
    'Foo Q Bar',
    'Foo Q. Bar',
    'Foo Qux Bar',
    'Foo "Qux" Bar',
    'Foo-Qux Bar',
    'Foo Bar-Qux',
  ].forEach(name => {
    it(`returns 'FB' for '${name}'`, () => {
      assert.strictEqual(getInitials(name), 'FB');
    });
  });

  it('returns initials for languages with non-Latin alphabets', () => {
    assert.strictEqual(getInitials('Иван Иванов'), 'ИИ');
    assert.strictEqual(getInitials('山田 太郎'), '山太');
    assert.strictEqual(getInitials('王五'), '王五');
  });

  it('returns initials for right-to-left languages', () => {
    assert.strictEqual(getInitials('فلانة الفلانية'), 'فا');
    assert.strictEqual(getInitials('ישראלה ישראלי'), 'יי');
  });

  it('returns initials with diacritical marks', () => {
    assert.strictEqual(getInitials('Ḟoo Ḅar'), 'ḞḄ');
  });
});
