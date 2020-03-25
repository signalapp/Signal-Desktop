describe('spellChecker', () => {
  it('should work', () => {
    let result = null;

    window.spellChecker.spellCheck(['correct'], answer => {
      result = answer;
    });
    assert.deepEqual(result, []);

    window.spellChecker.spellCheck(['fhqwgads'], answer => {
      result = answer;
    });
    assert.deepEqual(result, ['fhqwgads']);
  });
});
