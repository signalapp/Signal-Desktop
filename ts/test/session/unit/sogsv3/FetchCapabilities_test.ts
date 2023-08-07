import { expect } from 'chai';
import Sinon from 'sinon';
import { parseCapabilities } from '../../../../session/apis/open_group_api/sogsv3/sogsV3Capabilities';
import { getCapabilitiesFromBatch } from '../../../../session/apis/open_group_api/sogsv3/sogsCapabilities';

describe('FetchCapabilities', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('parseCapabilities', () => {
    it('return null if null is given as body', () => {
      expect(parseCapabilities(null)).to.be.eq(null);
    });

    it('return null if undefined is given as body', () => {
      expect(parseCapabilities(undefined)).to.be.eq(null);
    });

    it('return [] if given empty array valid', () => {
      expect(parseCapabilities({ capabilities: [] })).to.be.deep.eq([]);
    });

    it('return null if given null array ', () => {
      expect(parseCapabilities({ capabilities: null })).to.be.deep.eq(null);
    });

    it('return null if given string instead of object  ', () => {
      expect(parseCapabilities('')).to.be.deep.eq(null);
    });

    it('return null if given object without cap field  ', () => {
      expect(parseCapabilities({ invalid: [] })).to.be.deep.eq(null);
    });

    it('return valid if given one cap ', () => {
      expect(parseCapabilities({ capabilities: ['sogs'] })).to.be.deep.eq(['sogs']);
    });

    it('return valid if given two caps ', () => {
      expect(parseCapabilities({ capabilities: ['blind', 'sogs'] })).to.be.deep.eq([
        'blind',
        'sogs',
      ]);
    });

    it('return valid if given two caps, sorted ', () => {
      expect(
        parseCapabilities({
          capabilities: ['sogs', 'blind'],
        })
      ).to.be.deep.eq(['blind', 'sogs']);
    });
  });

  describe('getCapabilitiesFromBatch', () => {
    it('finds single capability in single array of results', () => {
      const caps = getCapabilitiesFromBatch(
        [{ type: 'capabilities' }],
        [
          {
            body: {
              capabilities: ['sogs'],
            },
          },
        ]
      );
      expect(caps).to.deep.eq(['sogs']);
    });

    it('finds few capabilities (sorted) in single array of results', () => {
      const caps = getCapabilitiesFromBatch(
        [{ type: 'capabilities' }],
        [
          {
            body: {
              capabilities: ['sogs', 'blinded'],
            },
          },
        ]
      );
      expect(caps).to.deep.eq(['blinded', 'sogs']);
    });

    it('finds few capabilities (sorted) in multi array of results', () => {
      const caps = getCapabilitiesFromBatch(
        [{ type: 'pollInfo', pollInfo: { roomId: 'roomId' } }, { type: 'capabilities' }],
        [
          {
            body: {
              whatever: [],
            },
          },
          {
            body: {
              capabilities: ['sogs', 'blinded'],
            },
          },
        ]
      );
      expect(caps).to.deep.eq(['blinded', 'sogs']);
    });

    it('does not find capabilities  in multi array of results not correctly sorted', () => {
      const caps = getCapabilitiesFromBatch(
        [{ type: 'pollInfo', pollInfo: { roomId: 'roomId' } }, { type: 'capabilities' }],
        [
          {
            body: {
              capabilities: ['sogs', 'blinded'],
            },
          },
          {
            body: {
              whatever: [],
            },
          },
        ]
      );
      expect(caps).to.deep.eq(null);
    });

    it('does not crash if there is no such index', () => {
      const caps = getCapabilitiesFromBatch(
        [{ type: 'pollInfo', pollInfo: { roomId: 'roomId' } }, { type: 'capabilities' }], // index is 1 -0 based
        [
          {
            body: {
              whatever: [],
            }, // there is no index 1, just 0
          },
        ]
      );
      expect(caps).to.deep.eq(null);
    });

    it('does not find capabilities when no capabilities subrequest', () => {
      const caps = getCapabilitiesFromBatch(
        [{ type: 'pollInfo', pollInfo: { roomId: 'roomId' } }],
        [
          {
            body: {
              capabilities: ['sogs', 'blinded'],
            },
          },
          {
            body: {
              whatever: [],
            },
          },
        ]
      );
      expect(caps).to.deep.eq(null);
    });
  });
});
