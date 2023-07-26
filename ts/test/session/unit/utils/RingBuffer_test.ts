import chai from 'chai';
import { RingBuffer } from '../../../../session/utils/RingBuffer';

const { expect } = chai;

describe('RingBuffer Utils', () => {
  it('gets created with right capacity', () => {
    const ring = new RingBuffer<number>(5000);
    expect(ring.getCapacity()).to.equal(5000);
    expect(ring.getLength()).to.equal(0);
    expect(ring.has(0)).to.equal(false, '0 should not be there');
  });

  describe('length & capacity are right', () => {
    it('length is right 0', () => {
      const ring = new RingBuffer<number>(4);
      expect(ring.getLength()).to.equal(0);
    });

    it('length is right 1', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      expect(ring.getLength()).to.equal(1);
    });

    it('length is right 4', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      expect(ring.getLength()).to.equal(4);
    });

    it('capacity does not get exceeded', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      ring.insert(4);
      expect(ring.getLength()).to.equal(4);
    });
  });

  describe('isEmpty is correct', () => {
    it('no items', () => {
      const ring = new RingBuffer<number>(4);
      expect(ring.isEmpty()).to.equal(true, 'no items isEmpty should be true');
    });

    it('length is right 1', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      expect(ring.isEmpty()).to.equal(false, '1 item isEmpty should be false');
    });

    it('length is right 4', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      expect(ring.isEmpty()).to.equal(false, '4 items isEmpty should be false');
    });

    it('more than capacity', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      ring.insert(4);
      expect(ring.isEmpty()).to.equal(false, '5 item isEmpty should be false');
    });
  });

  it('items are removed in order 1', () => {
    const ring = new RingBuffer<number>(4);
    ring.insert(0);
    ring.insert(1);
    ring.insert(2);
    ring.insert(3);
    ring.insert(4);
    expect(ring.has(0)).to.equal(false, '0 should not be there anymore');
    expect(ring.has(1)).to.equal(true, '1 should still be there');
    expect(ring.has(2)).to.equal(true, '2 should still be there');
    expect(ring.has(3)).to.equal(true, '3 should still be there');
    expect(ring.has(4)).to.equal(true, '4 should still be there');
  });

  it('two times the same items can exist', () => {
    const ring = new RingBuffer<number>(4);
    ring.insert(0);
    ring.insert(1);
    ring.insert(2);
    ring.insert(1);
    ring.insert(4);
    expect(ring.has(0)).to.equal(false, '0 should not be there anymore');
    expect(ring.has(1)).to.equal(true, '1 should still be there');
    expect(ring.has(2)).to.equal(true, '2 should still be there');
    expect(ring.has(3)).to.equal(false, '3 should not be there');
    expect(ring.has(4)).to.equal(true, '4 should still be there');
  });

  it('items are removed in order completely', () => {
    const ring = new RingBuffer<number>(4);
    ring.insert(0);
    ring.insert(1);
    ring.insert(2);
    ring.insert(3);
    ring.insert(10);
    ring.insert(20);
    ring.insert(30);
    ring.insert(40);
    expect(ring.has(0)).to.equal(false, '0 should not be there anymore');
    expect(ring.has(1)).to.equal(false, '1 should not be there');
    expect(ring.has(2)).to.equal(false, '2 should not be there');
    expect(ring.has(3)).to.equal(false, '3 should not be there');
    expect(ring.has(4)).to.equal(false, '4 should not be there');

    expect(ring.has(10)).to.equal(true, '10 should still be there');
    expect(ring.has(20)).to.equal(true, '20 should still be there');
    expect(ring.has(30)).to.equal(true, '30 should still be there');
    expect(ring.has(40)).to.equal(true, '40 should still be there');
  });

  it('clear empties the list but keeps the capacity', () => {
    const ring = new RingBuffer<number>(4);
    ring.insert(0);
    ring.insert(1);
    ring.insert(2);
    ring.insert(1);
    expect(ring.getLength()).to.equal(4);
    expect(ring.getCapacity()).to.equal(4);
    ring.clear();
    expect(ring.getCapacity()).to.equal(4);

    expect(ring.getLength()).to.equal(0);
  });

  describe('toArray', () => {
    it('empty buffer', () => {
      const ring = new RingBuffer<number>(4);
      expect(ring.toArray()).to.deep.eq([]);
    });

    it('with 1', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);

      expect(ring.toArray()).to.deep.eq([0]);
    });

    it('with 4', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);

      expect(ring.toArray()).to.deep.eq([0, 1, 2, 3]);
    });

    it('with 5', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      ring.insert(4);

      expect(ring.toArray()).to.deep.eq([1, 2, 3, 4]);
    });

    it('more than 2 full laps erasing data', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      ring.insert(4); // first lap first item
      ring.insert(5);
      ring.insert(6); // first item in toArray should be this one
      ring.insert(7);
      ring.insert(8); // second lap first item
      ring.insert(9);

      expect(ring.toArray()).to.deep.eq([6, 7, 8, 9]);
    });
  });

  describe('clear', () => {
    it('empty buffer', () => {
      const ring = new RingBuffer<number>(4);
      ring.clear();
      expect(ring.getCapacity()).to.deep.eq(4);
      expect(ring.getLength()).to.deep.eq(0);
    });

    it('with 1', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.clear();
      expect(ring.getCapacity()).to.deep.eq(4);
      expect(ring.getLength()).to.deep.eq(0);
    });

    it('with 5', () => {
      const ring = new RingBuffer<number>(4);
      ring.insert(0);
      ring.insert(1);
      ring.insert(2);
      ring.insert(3);
      ring.insert(4);

      ring.clear();
      expect(ring.getCapacity()).to.deep.eq(4);
      expect(ring.getLength()).to.deep.eq(0);
    });
  });
});
