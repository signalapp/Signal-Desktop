describe('i18n', function() {
  describe('i18n', function() {
    it('returns undefined for unknown string', function() {
      assert.strictEqual(i18n('random'), undefined);
    });
    it('returns message for given string', function() {
      assert.equal(i18n('reportIssue'), 'Report an issue');
    });
    it('returns message with single substitution', function() {
      const actual = i18n('attemptingReconnection', 5);
      assert.equal(actual, 'Attempting reconnect in 5 seconds');
    });
    it('returns message with multiple substitutions', function() {
      const actual = i18n('verifyContact', ['<strong>', '</strong>']);
      assert.equal(actual, 'You may wish to <strong> verify </strong> your safety number with this contact.');
    });
    it('handles duplicates of the same substitution', function() {
      const actual = i18n('changedSinceVerified', 'Someone');
      assert.equal(actual, 'Your safety number with Someone has changed since you last verified. This could mean that someone is trying to intercept your communication or that Someone has simply reinstalled Signal.');
    });
  });

  describe('getLocale', function() {
    it('returns a string with length two or greater', function() {
      const locale = i18n.getLocale();
      assert.isAtLeast(locale.trim().length, 2);
    });
  });
});
