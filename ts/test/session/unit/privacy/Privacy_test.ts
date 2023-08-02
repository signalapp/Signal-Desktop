import path from 'path';
import chai, { expect } from 'chai';
import { describe } from 'mocha';

import chaiAsPromised from 'chai-as-promised';
import { redactAll } from '../../../../util/privacy';

chai.use(chaiAsPromised as any);
describe('Privacy', () => {
  describe('Redact sessionID', () => {
    it('redact sessionID', () => {
      expect(
        redactAll('052d3096a72d2271bbba0d820729a3548749a2b3890c3b41ea08c4c2722616dd2b')
      ).to.be.equal('[REDACTED]');
    });

    it('redact multiple sessionID', () => {
      expect(
        redactAll(
          '052d3096a72d2271bbba0d820729a3548749a2b3890c3b41ea08c4c2722616dd2b 052d3096a72d2271bbba0d820729a3548749a2b3890c3b41ea08c4c2722616dd2c end'
        )
      ).to.be.equal('[REDACTED] [REDACTED] end');
    });

    it('redact sessionID without the 05 prefix', () => {
      expect(
        redactAll(
          'start 2d3096a72d2271bbba0d820729a3548749a2b3890c3b41ea08c4c2722616dd2b middle 2d3096a72d2271bbba0d820729a3548749a2b3890c3b41ea08c4c2722616dd2c end'
        )
      ).to.be.equal('start [REDACTED] middle [REDACTED] end');
    });
  });

  describe('Redact serverUrl', () => {
    it('redact serverUrl https no port', () => {
      expect(redactAll('https://example.org')).to.be.equal('[REDACTED]');
    });

    it('redact serverUrl http no port', () => {
      expect(redactAll('http://example.org')).to.be.equal('[REDACTED]');
    });

    it('redact serverUrl https with port', () => {
      expect(redactAll('https://example.org:8080')).to.be.equal('[REDACTED]');
    });

    it('redact serverUrl http with port', () => {
      expect(redactAll('http://example.org:8001')).to.be.equal('[REDACTED]');
    });

    it('redact serverUrl http with port keep rest of content', () => {
      expect(redactAll('start http://example.org:8001 end')).to.be.equal('start [REDACTED] end');
    });

    it('redact multiple serverUrl http with port keep rest of content', () => {
      expect(redactAll('start http://example.org:8001 http://session.org:8003 end')).to.be.equal(
        'start [REDACTED] [REDACTED] end'
      );
    });
  });

  describe('Redact snodeIP', () => {
    it('redact snodeIP no port', () => {
      expect(redactAll('127.0.0.1')).to.be.equal('[REDACTED]');
    });

    it('redact snodeIP with port', () => {
      expect(redactAll('127.0.0.1:22')).to.be.equal('[REDACTED]:22');
    });

    it('redact snodeIP with port multiple', () => {
      expect(redactAll('127.0.0.1:8098 127.0.0.1:22 127.0.0.1')).to.be.equal(
        '[REDACTED]:8098 [REDACTED]:22 [REDACTED]'
      );
    });

    it('redact snodeIP with port multiple but keep rest of content', () => {
      expect(redactAll('start 127.0.0.1:2212 127.0.0.1:2200 middle 127.0.0.1 end')).to.be.equal(
        'start [REDACTED]:2212 [REDACTED]:2200 middle [REDACTED] end'
      );
    });
  });

  describe('Redact app path', () => {
    it('removes whatever is in front of the app root path before logging', () => {
      const appRootPath = path.join(__dirname, '..', '..', '..', '..', '..');
      expect(redactAll(path.join(appRootPath, 'whatever'))).to.be.be.oneOf([
        '[REDACTED]/whatever',
        '[REDACTED]\\whatever',
      ]);
    });
  });
});
