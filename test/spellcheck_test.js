describe('spellChecker', () => {
  it('should work', () => {
    assert(
      window.spellChecker.spellCheck('correct'),
      'Spellchecker returned false on a correct word.'
    );
    assert(
      !window.spellChecker.spellCheck('fhqwgads'),
      'Spellchecker returned true on a incorrect word.'
    );
  });
});
