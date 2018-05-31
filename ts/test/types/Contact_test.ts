import { assert } from 'chai';

import { getName } from '../../types/Contact';

describe('Contact', () => {
  describe('getName', () => {
    it('returns displayName if provided', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
      };
      const expected = 'displayName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns organization if no displayName', () => {
      const contact = {
        name: {
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
      };
      const expected = 'Somewhere, Inc.';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns givenName + familyName if no displayName or organization', () => {
      const contact = {
        name: {
          givenName: 'givenName',
          familyName: 'familyName',
        },
      };
      const expected = 'givenName familyName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns just givenName', () => {
      const contact = {
        name: {
          givenName: 'givenName',
        },
      };
      const expected = 'givenName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns just familyName', () => {
      const contact = {
        name: {
          familyName: 'familyName',
        },
      };
      const expected = 'familyName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
  });
});
