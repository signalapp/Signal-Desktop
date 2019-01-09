/* global libloki, chai */

describe('ServiceNodes', () => {
  describe('#consolidateLists', () => {
    it('should throw when provided a non-iterable list', () => {
      chai.expect(() => libloki.serviceNodes.consolidateLists(null, 1)).to.throw();
    });
    it('should throw when provided a non-iterable item in the list', () => {
      chai.expect(() => libloki.serviceNodes.consolidateLists([1, 2, 3], 1)).to.throw();
    });
    it('should throw when provided a non-number threshold', () => {
      chai.expect(() => libloki.serviceNodes.consolidateLists([], 'a')).to.throw();
    });
    it('should return an empty array when the input is an empty array', () => {
      const result = libloki.serviceNodes.consolidateLists([]);
      chai.expect(result).to.deep.equal([]);
    });
    it('should return the input when only 1 list is provided', () => {
      const result = libloki.serviceNodes.consolidateLists([['a', 'b', 'c']]);
      chai.expect(result).to.deep.equal(['a', 'b', 'c']);
    });
    it('should return the union of all lists when threshold is 0', () => {
      const result = libloki.serviceNodes.consolidateLists([
        ['a', 'b', 'c', 'h'],
        ['d', 'e', 'f', 'g'],
        ['g', 'h'],
      ], 0);
      chai.expect(result.sort()).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    });
    it('should return the intersection of all lists when threshold is 1', () => {
      const result = libloki.serviceNodes.consolidateLists([
        ['a', 'b', 'c', 'd'],
        ['a', 'e', 'f', 'g'],
        ['a', 'h'],
      ], 1);
      chai.expect(result).to.deep.equal(['a']);
    });
    it('should return the elements that have an occurence >= the provided threshold', () => {
      const result = libloki.serviceNodes.consolidateLists([
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        ['a', 'b', 'c', 'd', 'e', 'f', 'h'],
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        ['a', 'b', 'c', 'd', 'e', 'g', 'h'],
      ], 3/4);
      chai.expect(result).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });
    it('should work with sets as well', () => {
      const result = libloki.serviceNodes.consolidateLists(new Set([
        new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
        new Set(['a', 'b', 'c', 'd', 'e', 'f', 'h']),
        new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
        new Set(['a', 'b', 'c', 'd', 'e', 'g', 'h']),
      ]), 3/4);
      chai.expect(result).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });
  });
});
