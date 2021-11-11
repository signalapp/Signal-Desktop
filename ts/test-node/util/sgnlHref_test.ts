// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Sinon from 'sinon';
import type { LoggerType } from '../../types/Logging';

import {
  isSgnlHref,
  isCaptchaHref,
  isSignalHttpsLink,
  parseSgnlHref,
  parseCaptchaHref,
  parseE164FromSignalDotMeHash,
  parseSignalHttpsLink,
} from '../../util/sgnlHref';

function shouldNeverBeCalled() {
  assert.fail('This should never be called');
}

const explodingLogger: LoggerType = {
  fatal: shouldNeverBeCalled,
  error: shouldNeverBeCalled,
  warn: shouldNeverBeCalled,
  info: shouldNeverBeCalled,
  debug: shouldNeverBeCalled,
  trace: shouldNeverBeCalled,
};

describe('sgnlHref', () => {
  [
    { protocol: 'sgnl', check: isSgnlHref, name: 'isSgnlHref' },
    { protocol: 'signalcaptcha', check: isCaptchaHref, name: 'isCaptchaHref' },
  ].forEach(({ protocol, check, name }) => {
    describe(name, () => {
      it('returns false for non-strings', () => {
        const logger = {
          ...explodingLogger,
          warn: Sinon.spy(),
        };

        const castToString = (value: unknown): string => value as string;

        assert.isFalse(check(castToString(undefined), logger));
        assert.isFalse(check(castToString(null), logger));
        assert.isFalse(check(castToString(123), logger));

        Sinon.assert.calledThrice(logger.warn);
      });

      it('returns false for invalid URLs', () => {
        assert.isFalse(check('', explodingLogger));
        assert.isFalse(check(protocol, explodingLogger));
        assert.isFalse(check(`${protocol}://::`, explodingLogger));
      });

      it(`returns false if the protocol is not "${protocol}:"`, () => {
        assert.isFalse(check('https://example', explodingLogger));
        assert.isFalse(
          check('https://signal.art/addstickers/?pack_id=abc', explodingLogger)
        );
        assert.isFalse(check('signal://example', explodingLogger));
      });

      it(`returns true if the protocol is "${protocol}:"`, () => {
        assert.isTrue(check(`${protocol}://`, explodingLogger));
        assert.isTrue(check(`${protocol}://example`, explodingLogger));
        assert.isTrue(check(`${protocol}://example.com`, explodingLogger));
        assert.isTrue(
          check(`${protocol.toUpperCase()}://example`, explodingLogger)
        );
        assert.isTrue(check(`${protocol}://example?foo=bar`, explodingLogger));
        assert.isTrue(check(`${protocol}://example/`, explodingLogger));
        assert.isTrue(check(`${protocol}://example#`, explodingLogger));

        assert.isTrue(check(`${protocol}:foo`, explodingLogger));

        assert.isTrue(
          check(`${protocol}://user:pass@example`, explodingLogger)
        );
        assert.isTrue(check(`${protocol}://example.com:1234`, explodingLogger));
        assert.isTrue(
          check(`${protocol}://example.com/extra/path/data`, explodingLogger)
        );
        assert.isTrue(
          check(`${protocol}://example/?foo=bar#hash`, explodingLogger)
        );
      });

      it('accepts URL objects', () => {
        const invalid = new URL('https://example.com');
        assert.isFalse(check(invalid, explodingLogger));
        const valid = new URL(`${protocol}://example`);
        assert.isTrue(check(valid, explodingLogger));
      });
    });
  });

  describe('isSignalHttpsLink', () => {
    it('returns false for non-strings', () => {
      const logger = {
        ...explodingLogger,
        warn: Sinon.spy(),
      };

      const castToString = (value: unknown): string => value as string;

      assert.isFalse(isSignalHttpsLink(castToString(undefined), logger));
      assert.isFalse(isSignalHttpsLink(castToString(null), logger));
      assert.isFalse(isSignalHttpsLink(castToString(123), logger));

      Sinon.assert.calledThrice(logger.warn);
    });

    it('returns false for invalid URLs', () => {
      assert.isFalse(isSignalHttpsLink('', explodingLogger));
      assert.isFalse(isSignalHttpsLink('https', explodingLogger));
      assert.isFalse(isSignalHttpsLink('https://::', explodingLogger));
    });

    it('returns false if the protocol is not "https:"', () => {
      assert.isFalse(isSignalHttpsLink('sgnl://signal.art', explodingLogger));
      assert.isFalse(
        isSignalHttpsLink(
          'sgnl://signal.art/addstickers/?pack_id=abc',
          explodingLogger
        )
      );
      assert.isFalse(
        isSignalHttpsLink('signal://signal.group', explodingLogger)
      );
    });

    it('returns false if the URL is not a valid Signal URL', () => {
      assert.isFalse(isSignalHttpsLink('https://signal.org', explodingLogger));
      assert.isFalse(isSignalHttpsLink('https://example.com', explodingLogger));
    });

    it('returns true if the protocol is "https:"', () => {
      assert.isTrue(isSignalHttpsLink('https://signal.group', explodingLogger));
      assert.isTrue(isSignalHttpsLink('https://signal.art', explodingLogger));
      assert.isTrue(isSignalHttpsLink('HTTPS://signal.art', explodingLogger));
      assert.isTrue(isSignalHttpsLink('https://signal.me', explodingLogger));
    });

    it('returns false if username or password are set', () => {
      assert.isFalse(
        isSignalHttpsLink('https://user:password@signal.group', explodingLogger)
      );
    });

    it('returns false if port is set', () => {
      assert.isFalse(
        isSignalHttpsLink('https://signal.group:1234', explodingLogger)
      );
    });

    it('accepts URL objects', () => {
      const invalid = new URL('sgnl://example.com');
      assert.isFalse(isSignalHttpsLink(invalid, explodingLogger));
      const valid = new URL('https://signal.art');
      assert.isTrue(isSignalHttpsLink(valid, explodingLogger));
    });
  });

  describe('parseSgnlHref', () => {
    it('returns a null command for invalid URLs', () => {
      ['', 'sgnl', 'https://example/?foo=bar'].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: null,
          args: new Map<never, never>(),
          hash: undefined,
        });
      });
    });

    it('parses the command for URLs with no arguments', () => {
      [
        'sgnl://foo',
        'sgnl://foo/',
        'sgnl://foo?',
        'SGNL://foo?',
        'sgnl://user:pass@foo',
        'sgnl://foo/path/data',
      ].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: 'foo',
          args: new Map<string, string>(),
          hash: undefined,
        });
      });
    });

    it("parses a command's arguments", () => {
      assert.deepEqual(
        parseSgnlHref(
          'sgnl://Foo?bar=baz&qux=Quux&num=123&empty=&encoded=hello%20world',
          explodingLogger
        ),
        {
          command: 'Foo',
          args: new Map([
            ['bar', 'baz'],
            ['qux', 'Quux'],
            ['num', '123'],
            ['empty', ''],
            ['encoded', 'hello world'],
          ]),
          hash: undefined,
        }
      );
    });

    it('treats the port as part of the command', () => {
      assert.propertyVal(
        parseSgnlHref('sgnl://foo:1234', explodingLogger),
        'command',
        'foo:1234'
      );
    });

    it('ignores duplicate query parameters', () => {
      assert.deepPropertyVal(
        parseSgnlHref('sgnl://x?foo=bar&foo=totally-ignored', explodingLogger),
        'args',
        new Map([['foo', 'bar']])
      );
    });

    it('includes hash', () => {
      [
        'sgnl://foo?bar=baz#somehash',
        'sgnl://user:pass@foo?bar=baz#somehash',
      ].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: 'foo',
          args: new Map([['bar', 'baz']]),
          hash: 'somehash',
        });
      });
    });

    it('ignores other parts of the URL', () => {
      [
        'sgnl://foo?bar=baz',
        'sgnl://foo/?bar=baz',
        'sgnl://foo/lots/of/path?bar=baz',
        'sgnl://user:pass@foo?bar=baz',
      ].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: 'foo',
          args: new Map([['bar', 'baz']]),
          hash: undefined,
        });
      });
    });

    it("doesn't do anything fancy with arrays or objects in the query string", () => {
      // The `qs` module does things like this, which we don't want.
      assert.deepPropertyVal(
        parseSgnlHref('sgnl://x?foo[]=bar&foo[]=baz', explodingLogger),
        'args',
        new Map([['foo[]', 'bar']])
      );
      assert.deepPropertyVal(
        parseSgnlHref('sgnl://x?foo[bar][baz]=foobarbaz', explodingLogger),
        'args',
        new Map([['foo[bar][baz]', 'foobarbaz']])
      );
    });
  });

  describe('parseCaptchaHref', () => {
    it('throws on invalid URLs', () => {
      ['', 'sgnl', 'https://example/?foo=bar'].forEach(href => {
        assert.throws(
          () => parseCaptchaHref(href, explodingLogger),
          'Not a captcha href'
        );
      });
    });

    it('parses the command for URLs with no arguments', () => {
      [
        'signalcaptcha://foo',
        'signalcaptcha://foo?x=y',
        'signalcaptcha://a:b@foo?x=y',
        'signalcaptcha://foo#hash',
        'signalcaptcha://foo/',
      ].forEach(href => {
        assert.deepEqual(parseCaptchaHref(href, explodingLogger), {
          captcha: 'foo',
        });
      });
    });
  });

  describe('parseE164FromSignalDotMeHash', () => {
    it('returns undefined for invalid inputs', () => {
      [
        '',
        ' p/+18885551234',
        'p/+18885551234 ',
        'x/+18885551234',
        'p/+notanumber',
        'p/7c7e87a0-3b74-4efd-9a00-6eb8b1dd5be8',
        'p/+08885551234',
        'p/18885551234',
      ].forEach(hash => {
        assert.isUndefined(parseE164FromSignalDotMeHash(hash));
      });
    });

    it('returns the E164 for valid inputs', () => {
      assert.strictEqual(
        parseE164FromSignalDotMeHash('p/+18885551234'),
        '+18885551234'
      );
      assert.strictEqual(
        parseE164FromSignalDotMeHash('p/+441632960104'),
        '+441632960104'
      );
    });
  });

  describe('parseSignalHttpsLink', () => {
    it('returns a null command for invalid URLs', () => {
      ['', 'https', 'https://example/?foo=bar'].forEach(href => {
        assert.deepEqual(parseSignalHttpsLink(href, explodingLogger), {
          command: null,
          args: new Map<never, never>(),
          hash: undefined,
        });
      });
    });

    it('handles signal.art links', () => {
      assert.deepEqual(
        parseSignalHttpsLink(
          'https://signal.art/addstickers/#pack_id=baz&pack_key=Quux&num=123&empty=&encoded=hello%20world',
          explodingLogger
        ),
        {
          command: 'addstickers',
          args: new Map([
            ['pack_id', 'baz'],
            ['pack_key', 'Quux'],
            ['num', '123'],
            ['empty', ''],
            ['encoded', 'hello world'],
          ]),
          hash: 'pack_id=baz&pack_key=Quux&num=123&empty=&encoded=hello%20world',
        }
      );
    });

    it('handles signal.group links', () => {
      assert.deepEqual(
        parseSignalHttpsLink('https://signal.group/#data', explodingLogger),
        {
          command: 'signal.group',
          args: new Map<never, never>(),
          hash: 'data',
        }
      );
    });

    it('handles signal.me links', () => {
      assert.deepEqual(
        parseSignalHttpsLink(
          'https://signal.me/#p/+18885551234',
          explodingLogger
        ),
        {
          command: 'signal.me',
          args: new Map<never, never>(),
          hash: 'p/+18885551234',
        }
      );
    });
  });
});
