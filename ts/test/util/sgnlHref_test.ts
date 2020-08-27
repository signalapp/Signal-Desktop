import { assert } from 'chai';
import Sinon from 'sinon';
import { LoggerType } from '../../types/Logging';

import { isSgnlHref, parseSgnlHref } from '../../util/sgnlHref';

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
  describe('isSgnlHref', () => {
    it('returns false for non-strings', () => {
      const logger = {
        ...explodingLogger,
        warn: Sinon.spy(),
      };

      const castToString = (value: unknown): string => value as string;

      assert.isFalse(isSgnlHref(castToString(undefined), logger));
      assert.isFalse(isSgnlHref(castToString(null), logger));
      assert.isFalse(isSgnlHref(castToString(123), logger));

      Sinon.assert.calledThrice(logger.warn);
    });

    it('returns false for invalid URLs', () => {
      assert.isFalse(isSgnlHref('', explodingLogger));
      assert.isFalse(isSgnlHref('sgnl', explodingLogger));
      assert.isFalse(isSgnlHref('sgnl://::', explodingLogger));
    });

    it('returns false if the protocol is not "sgnl:"', () => {
      assert.isFalse(isSgnlHref('https://example', explodingLogger));
      assert.isFalse(
        isSgnlHref(
          'https://signal.art/addstickers/?pack_id=abc',
          explodingLogger
        )
      );
      assert.isFalse(isSgnlHref('signal://example', explodingLogger));
    });

    it('returns true if the protocol is "sgnl:"', () => {
      assert.isTrue(isSgnlHref('sgnl://', explodingLogger));
      assert.isTrue(isSgnlHref('sgnl://example', explodingLogger));
      assert.isTrue(isSgnlHref('sgnl://example.com', explodingLogger));
      assert.isTrue(isSgnlHref('SGNL://example', explodingLogger));
      assert.isTrue(isSgnlHref('sgnl://example?foo=bar', explodingLogger));
      assert.isTrue(isSgnlHref('sgnl://example/', explodingLogger));
      assert.isTrue(isSgnlHref('sgnl://example#', explodingLogger));

      assert.isTrue(isSgnlHref('sgnl:foo', explodingLogger));

      assert.isTrue(isSgnlHref('sgnl://user:pass@example', explodingLogger));
      assert.isTrue(isSgnlHref('sgnl://example.com:1234', explodingLogger));
      assert.isTrue(
        isSgnlHref('sgnl://example.com/extra/path/data', explodingLogger)
      );
      assert.isTrue(
        isSgnlHref('sgnl://example/?foo=bar#hash', explodingLogger)
      );
    });

    it('accepts URL objects', () => {
      const invalid = new URL('https://example.com');
      assert.isFalse(isSgnlHref(invalid, explodingLogger));
      const valid = new URL('sgnl://example');
      assert.isTrue(isSgnlHref(valid, explodingLogger));
    });
  });

  describe('parseSgnlHref', () => {
    it('returns a null command for invalid URLs', () => {
      ['', 'sgnl', 'https://example/?foo=bar'].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: null,
          args: new Map<never, never>(),
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
        'sgnl://foo/path/data#hash-data',
      ].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: 'foo',
          args: new Map<string, string>(),
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

    it('ignores other parts of the URL', () => {
      [
        'sgnl://foo?bar=baz',
        'sgnl://foo/?bar=baz',
        'sgnl://foo/lots/of/path?bar=baz',
        'sgnl://foo?bar=baz#hash',
        'sgnl://user:pass@foo?bar=baz',
      ].forEach(href => {
        assert.deepEqual(parseSgnlHref(href, explodingLogger), {
          command: 'foo',
          args: new Map([['bar', 'baz']]),
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
});
