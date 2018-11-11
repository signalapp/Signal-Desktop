describe('spellChecker', () => {
  it('should work', () => {
    assert(window.spellChecker.spellCheck('correct'));
    assert(!window.spellChecker.spellCheck('fhqwgads'));
  });
});
