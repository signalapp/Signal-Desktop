// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { size } from '../../util/iterables.std.js';

import {
  maybeParseUrl,
  setUrlSearchParams,
  urlPathFromComponents,
} from '../../util/url.std.js';

describe('URL utilities', () => {
  describe('maybeParseUrl', () => {
    it('parses valid URLs', () => {
      [
        'https://example.com',
        'https://example.com:123/pathname?query=string#hash',
        'file:///path/to/file.txt',
      ].forEach(href => {
        assert.deepEqual(maybeParseUrl(href), new URL(href));
      });
    });

    it('returns undefined for invalid URLs', () => {
      ['', 'example.com'].forEach(href => {
        assert.isUndefined(maybeParseUrl(href));
      });
    });

    it('handles non-strings for compatibility, returning undefined', () => {
      [undefined, null, 123, ['https://example.com']].forEach(value => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assert.isUndefined(maybeParseUrl(value as any));
      });
    });
  });

  describe('setUrlSearchParams', () => {
    it('returns a new URL with updated search params', () => {
      const params = {
        normal_string: 'foo',
        empty_string: '',
        number: 123,
        true_bool: true,
        false_bool: false,
        array: ['ok', 'wow'],
        stringified: { toString: () => 'bar' },
      };

      const newUrl = setUrlSearchParams(
        new URL('https://example.com/path?should_be=overwritten#hash'),
        params
      );

      assert(newUrl.href.startsWith('https://example.com/path?'));
      assert.strictEqual(newUrl.hash, '#hash');

      assert.strictEqual(
        size(newUrl.searchParams.entries()),
        Object.keys(params).length
      );
      assert.strictEqual(newUrl.searchParams.get('normal_string'), 'foo');
      assert.strictEqual(newUrl.searchParams.get('empty_string'), '');
      assert.strictEqual(newUrl.searchParams.get('number'), '123');
      assert.strictEqual(newUrl.searchParams.get('true_bool'), 'true');
      assert.strictEqual(newUrl.searchParams.get('false_bool'), 'false');
      assert.strictEqual(newUrl.searchParams.get('array'), 'ok,wow');
      assert.strictEqual(newUrl.searchParams.get('stringified'), 'bar');
    });

    it("doesn't touch the original URL or its params", () => {
      const originalHref = 'https://example.com/path?query=string';
      const originalUrl = new URL(originalHref);

      const params = { foo: 'bar' };

      const newUrl = setUrlSearchParams(originalUrl, params);

      assert.notStrictEqual(originalUrl, newUrl);
      assert.strictEqual(originalUrl.href, originalHref);

      params.foo = 'should be ignored';
      assert.strictEqual(newUrl.search, '?foo=bar');
    });
  });

  describe('urlPathFromComponents', () => {
    it('returns / if no components are provided', () => {
      assert.strictEqual(urlPathFromComponents([]), '/');
    });

    it('joins components, percent-encoding them and removing empty components', () => {
      const components = ['foo', '', '~', 'bar / baz qúx'];
      assert.strictEqual(
        urlPathFromComponents(components),
        '/foo/~/bar%20%2F%20baz%20q%C3%BAx'
      );
    });
  });
});
