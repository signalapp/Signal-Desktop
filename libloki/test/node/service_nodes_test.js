const ServiceNode = require('../../service_nodes');
const { expect } = require('chai');

describe('ServiceNodes', () => {
  describe('#consolidateLists', () => {
    it('should throw when provided a non-iterable list', () => {
      expect(() => ServiceNode.consolidateLists(null, 1)).to.throw();
    });
    it('should throw when provided a non-iterable item in the list', () => {
      expect(() => ServiceNode.consolidateLists([1, 2, 3], 1)).to.throw();
    });
    it('should throw when provided a non-number threshold', () => {
      expect(() => ServiceNode.consolidateLists([], 'a')).to.throw();
    });
    it('should return an empty array when the input is an empty array', () => {
      const result = ServiceNode.consolidateLists([]);
      expect(result).to.deep.equal([]);
    });
    it('should return the input when only 1 list is provided', () => {
      const result = ServiceNode.consolidateLists([['a', 'b', 'c']]);
      expect(result).to.deep.equal(['a', 'b', 'c']);
    });
    it('should return the union of all lists when threshold is 0', () => {
      const result = ServiceNode.consolidateLists([
        ['a', 'b', 'c', 'h'],
        ['d', 'e', 'f', 'g'],
        ['g', 'h'],
      ], 0);
      expect(result.sort()).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    });
    it('should return the intersection of all lists when threshold is 1', () => {
      const result = ServiceNode.consolidateLists([
        ['a', 'b', 'c', 'd'],
        ['a', 'e', 'f', 'g'],
        ['a', 'h'],
      ], 1);
      expect(result).to.deep.equal(['a']);
    });
    it('should return the elements that have an occurence >= the provided threshold', () => {
      const result = ServiceNode.consolidateLists([
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        ['a', 'b', 'c', 'd', 'e', 'f', 'h'],
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        ['a', 'b', 'c', 'd', 'e', 'g', 'h'],
      ], 3/4);
      expect(result).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });
    it('should work with sets as well', () => {
      const result = ServiceNode.consolidateLists(new Set([
        new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
        new Set(['a', 'b', 'c', 'd', 'e', 'f', 'h']),
        new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
        new Set(['a', 'b', 'c', 'd', 'e', 'g', 'h']),
      ]), 3/4);
      expect(result).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });
  });
});
