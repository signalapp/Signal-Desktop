const { assert } = require('chai');

const passwordUtil = require('../../app/password_util');

describe('Password Util', () => {
  describe('hash generation', () => {
    it('generates the same hash for the same phrase', () => {
      const first = passwordUtil.generateHash('phrase');
      const second = passwordUtil.generateHash('phrase');
      assert.equal(first, second);
    });
    it('generates different hashes for different phrases', () => {
      const first = passwordUtil.generateHash('0');
      const second = passwordUtil.generateHash('1');
      assert.notEqual(first, second);
    });
  });

  describe('hash matching', () => {
    it('returns true for the same hash', () => {
      const phrase = 'phrase';
      const hash = passwordUtil.generateHash(phrase);
      assert.isTrue(passwordUtil.matchesHash(phrase, hash));
    });
    it('returns false for different hashes', () => {
      const hash = passwordUtil.generateHash('phrase');
      assert.isFalse(passwordUtil.matchesHash('phrase2', hash));
    });
  });
});
