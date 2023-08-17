import { expect } from 'chai';
import Sinon from 'sinon';
import { SnodeNamespace } from '../../../../session/apis/snode_api/namespaces';

describe('Snode namespaces', () => {
  describe('maxSizeMap', () => {
    afterEach(() => {
      Sinon.restore();
    });

    it('single namespace 0 returns -1', () => {
      expect(SnodeNamespace.maxSizeMap([0])).to.be.deep.eq([{ namespace: 0, maxSize: -1 }]);
    });

    it('single namespace config 5 returns -1', () => {
      expect(SnodeNamespace.maxSizeMap([5])).to.be.deep.eq([{ namespace: 5, maxSize: -1 }]);
    });

    it('multiple namespaces config 0,2,3,4,5 returns [-2,-8,-8,-8,-8]', () => {
      expect(SnodeNamespace.maxSizeMap([0, 2, 3, 4, 5])).to.be.deep.eq([
        { namespace: 0, maxSize: -2 }, // 0 has a priority of 10 so takes its own bucket
        { namespace: 2, maxSize: -8 }, //  the 4 other ones are sharing the next bucket
        { namespace: 3, maxSize: -8 },
        { namespace: 4, maxSize: -8 },
        { namespace: 5, maxSize: -8 },
      ]);
    });
  });
});
