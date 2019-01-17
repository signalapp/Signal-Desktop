/* global libloki, assert */

describe('ServiceNodes', () => {
  describe('#consolidateLists', () => {
    it('should throw when provided a non-iterable list', () => {
      assert.throws(
        () => libloki.serviceNodes.consolidateLists(null, 1),
        Error
      );
    });

    it('should throw when provided a non-iterable item in the list', () => {
      assert.throws(
        () => libloki.serviceNodes.consolidateLists([1, 2, 3], 1),
        Error
      );
    });

    it('should throw when provided a non-number threshold', () => {
      assert.throws(
        () => libloki.serviceNodes.consolidateLists([], 'a'),
        'Provided threshold is not a number'
      );
    });

    it('should throw when provided a non-function selector', () => {
      [1, 'a', 0xffffffff, { really: 'not a function' }].forEach(x => {
        assert.throws(
          () => libloki.serviceNodes.consolidateLists([], 1, x),
          'Provided selector is not a function'
        );
      });
    });

    it('should return an empty array when the input is an empty array', () => {
      const result = libloki.serviceNodes.consolidateLists([], 1);
      assert.deepEqual(result, []);
    });

    it('should return the input when only 1 list is provided', () => {
      const result = libloki.serviceNodes.consolidateLists(
        [['a', 'b', 'c']],
        1
      );
      assert.deepEqual(result, ['a', 'b', 'c']);
    });

    it('should return the union of all lists when threshold is 0', () => {
      const result = libloki.serviceNodes.consolidateLists(
        [['a', 'b', 'c', 'h'], ['d', 'e', 'f', 'g'], ['g', 'h']],
        0
      );
      assert.deepEqual(result.sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    });

    it('should use the selector to identify the elements', () => {
      const result = libloki.serviceNodes.consolidateLists(
        [
          [
            { id: 1, val: 'a' },
            { id: 2, val: 'b' },
            { id: 3, val: 'c' },
            { id: 8, val: 'h' },
          ],
          [
            { id: 4, val: 'd' },
            { id: 5, val: 'e' },
            { id: 6, val: 'f' },
            { id: 7, val: 'g' },
          ],
          [{ id: 7, val: 'g' }, { id: 8, val: 'h' }],
        ],
        0,
        x => x.id
      );
      const expected = [
        { id: 1, val: 'a' },
        { id: 2, val: 'b' },
        { id: 3, val: 'c' },
        { id: 4, val: 'd' },
        { id: 5, val: 'e' },
        { id: 6, val: 'f' },
        { id: 7, val: 'g' },
        { id: 8, val: 'h' },
      ];
      assert.deepEqual(result.sort((a, b) => a.val > b.val), expected);
    });

    it('should return the intersection of all lists when threshold is 1', () => {
      const result = libloki.serviceNodes.consolidateLists(
        [['a', 'b', 'c', 'd'], ['a', 'e', 'f', 'g'], ['a', 'h']],
        1
      );
      assert.deepEqual(result, ['a']);
    });

    it('should return the elements that have an occurence >= the provided threshold', () => {
      const result = libloki.serviceNodes.consolidateLists(
        [
          ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          ['a', 'b', 'c', 'd', 'e', 'f', 'h'],
          ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          ['a', 'b', 'c', 'd', 'e', 'g', 'h'],
        ],
        3 / 4
      );
      assert.deepEqual(result, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });

    it('should work with sets as well', () => {
      const result = libloki.serviceNodes.consolidateLists(
        new Set([
          new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
          new Set(['a', 'b', 'c', 'd', 'e', 'f', 'h']),
          new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
          new Set(['a', 'b', 'c', 'd', 'e', 'g', 'h']),
        ]),
        3 / 4
      );
      assert.deepEqual(result, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });
  });
});
