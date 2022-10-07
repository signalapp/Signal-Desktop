// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression no-require-imports no-var-requires

import chai from 'chai';
import { RingBuffer } from '../../../../session/utils/RingBuffer';

const { expect } = chai;

describe('RingBuffer Utils', () => {
  it('gets created with right capacity', () => {
    const ring = new RingBuffer<number>(5000);
    expect(ring.getCapacity()).to.equal(5000);
    expect(ring.getLength()).to.equal(0);
    expect(ring.has(0)).to.equal(false, '4 should not be there');
  });

  describe('length & capacity are right', () => {
    it('length is right 1', () => {
      const ring = new RingBuffer<number>(4);
      ring.add(0);
      expect(ring.getLength()).to.equal(1);
    });

    it('length is right 4', () => {
      const ring = new RingBuffer<number>(4);
      ring.add(0);
      ring.add(1);
      ring.add(2);
      ring.add(3);
      expect(ring.getLength()).to.equal(4);
    });

    it('capacity does not get exceeded', () => {
      const ring = new RingBuffer<number>(4);
      ring.add(0);
      ring.add(1);
      ring.add(2);
      ring.add(3);
      ring.add(4);
      expect(ring.getLength()).to.equal(4);
    });
  });

  it('items are removed in order 1', () => {
    const ring = new RingBuffer<number>(4);
    ring.add(0);
    ring.add(1);
    ring.add(2);
    ring.add(3);
    ring.add(4);
    expect(ring.has(0)).to.equal(false, '0 should not be there anymore');
    expect(ring.has(1)).to.equal(true, '1 should still be there');
    expect(ring.has(2)).to.equal(true, '2 should still be there');
    expect(ring.has(3)).to.equal(true, '3 should still be there');
    expect(ring.has(4)).to.equal(true, '4 should still be there');
  });

  it('two times the same items can exist', () => {
    const ring = new RingBuffer<number>(4);
    ring.add(0);
    ring.add(1);
    ring.add(2);
    ring.add(1);
    ring.add(4);
    expect(ring.has(0)).to.equal(false, '0 should not be there anymore');
    expect(ring.has(1)).to.equal(true, '1 should still be there');
    expect(ring.has(2)).to.equal(true, '2 should still be there');
    expect(ring.has(3)).to.equal(false, '3 should not be there');
    expect(ring.has(4)).to.equal(true, '4 should still be there');
  });

  it('items are removed in order completely', () => {
    const ring = new RingBuffer<number>(4);
    ring.add(0);
    ring.add(1);
    ring.add(2);
    ring.add(3);
    ring.add(10);
    ring.add(20);
    ring.add(30);
    ring.add(40);
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
    ring.add(0);
    ring.add(1);
    ring.add(2);
    ring.add(1);
    expect(ring.getLength()).to.equal(4);
    expect(ring.getCapacity()).to.equal(4);
    ring.clear();
    expect(ring.getCapacity()).to.equal(4);

    expect(ring.getLength()).to.equal(0);
  });
});
