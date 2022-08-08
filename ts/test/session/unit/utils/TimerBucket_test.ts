import { expect } from 'chai';
import { getIncrement, getTimerBucketIcon } from '../../../../util/timer';

describe('getIncrement', () => {
  describe('negative length', () => {
    it('length < 0', () => {
      expect(getIncrement(-1)).to.be.equal(1000, 'should have return 1000');
    });

    it('length < -1000', () => {
      expect(getIncrement(-1000)).to.be.equal(1000, 'should have return 1000');
    });
  });

  describe('positive length but less than a minute => should return 500', () => {
    it('length = 60000', () => {
      expect(getIncrement(60000)).to.be.equal(500, 'should have return 500');
    });

    it('length = 10000', () => {
      expect(getIncrement(10000)).to.be.equal(500, 'should have return 500');
    });

    it('length  = 0', () => {
      expect(getIncrement(0)).to.be.equal(500, 'should have return 500');
    });
  });

  describe('positive length > a minute => should return Math.ceil(length / 12) ', () => {
    it('length = 2 minutes', () => {
      expect(getIncrement(120000)).to.be.equal(10000, 'should have return 10000');
    });

    it('length = 2 minutes not divisible by 12', () => {
      // because we have Math.ceil()
      expect(getIncrement(120001)).to.be.equal(10001, 'should have return 10000');
    });

    it('length = 20 days', () => {
      expect(getIncrement(1000 * 60 * 60 * 24 * 20)).to.be.equal(
        144000000,
        'should have return 144000000'
      );
    });

    it('length = 20 days not divisible by 12', () => {
      // because we have Math.ceil()
      expect(getIncrement(1000 * 60 * 60 * 24 * 20 + 1)).to.be.equal(
        144000001,
        'should have return 144000001'
      );
    });
  });
});

describe('getTimerBucketIcon', () => {
  describe('absolute values', () => {
    it('delta < 0', () => {
      expect(getTimerBucketIcon(Date.now() - 1000, 100)).to.be.equal(
        'timer60',
        'should have return timer60'
      );
    });

    it('delta > length by a little', () => {
      expect(getTimerBucketIcon(Date.now() + 105, 100)).to.be.equal(
        'timer00',
        'should have return timer00'
      );
    });

    it('delta > length by a lot', () => {
      expect(getTimerBucketIcon(Date.now() + 10100000, 100)).to.be.equal(
        'timer00',
        'should have return timer00'
      );
    });
  });

  describe('calculated values for length 1000', () => {
    const length = 1000;
    it('delta = 0', () => {
      expect(getTimerBucketIcon(Date.now(), length)).to.be.equal(
        'timer00',
        'should have return timer00'
      );
    });
    it('delta = 1/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (1 / 12) * length, length)).to.be.equal(
        'timer05',
        'should have return timer05'
      );
    });

    it('delta = 2/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (2 / 12) * length, length)).to.be.equal(
        'timer10',
        'should have return timer10'
      );
    });

    it('delta = 3/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (3 / 12) * length, length)).to.be.equal(
        'timer15',
        'should have return timer15'
      );
    });

    it('delta = 4/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (4 / 12) * length, length)).to.be.equal(
        'timer20',
        'should have return timer20'
      );
    });

    it('delta = 5/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (5 / 12) * length, length)).to.be.equal(
        'timer25',
        'should have return timer25'
      );
    });

    it('delta = 6/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (6 / 12) * length, length)).to.be.equal(
        'timer30',
        'should have return timer30'
      );
    });

    it('delta = 7/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (7 / 12) * length, length)).to.be.equal(
        'timer35',
        'should have return timer35'
      );
    });

    it('delta = 8/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (8 / 12) * length, length)).to.be.equal(
        'timer40',
        'should have return timer40'
      );
    });

    it('delta = 9/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (9 / 12) * length, length)).to.be.equal(
        'timer45',
        'should have return timer45'
      );
    });

    it('delta = 10/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (10 / 12) * length, length)).to.be.equal(
        'timer50',
        'should have return timer50'
      );
    });

    it('delta = 11/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (11 / 12) * length, length)).to.be.equal(
        'timer55',
        'should have return timer55'
      );
    });

    it('delta = 12/12 of length', () => {
      expect(getTimerBucketIcon(Date.now() + (12 / 12) * length, length)).to.be.equal(
        'timer60',
        'should have return timer60'
      );
    });
  });
});
