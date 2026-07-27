// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { extractLinks } from '../../../components/conversation/MessageTextRenderer.dom.tsx';

describe('extractLinks', () => {
  it('linkifies an explicit-scheme link', () => {
    const text = 'visit https://meet.google.com/arst-asdf today';
    assert.deepEqual(extractLinks(text, text.length), [
      {
        start: 'visit '.length,
        length: 'https://meet.google.com/arst-asdf'.length,
        url: 'https://meet.google.com/arst-asdf',
      },
    ]);
  });

  it('linkifies a scheme-less link', () => {
    const text = 'visit meet.google.com/arst-asdf today';
    assert.deepEqual(extractLinks(text, text.length), [
      {
        start: 'visit '.length,
        length: 'meet.google.com/arst-asdf'.length,
        url: 'http://meet.google.com/arst-asdf',
      },
    ]);
  });

  it('keeps a link that ends exactly at the visible boundary', () => {
    const original = 'see https://example.com/foo more text';
    const textLength = 'see https://example.com/foo'.length;
    assert.deepEqual(extractLinks(original, textLength), [
      {
        start: 'see '.length,
        length: 'https://example.com/foo'.length,
        url: 'https://example.com/foo',
      },
    ]);
  });

  it('drops a link truncated before the visible boundary', () => {
    const original = 'see https://example.com/foobar';
    const textLength = 'see https://example.com/foo'.length;
    assert.deepEqual(extractLinks(original, textLength), []);
  });

  it('returns no links for text without any', () => {
    const text = 'no links here';
    assert.deepEqual(extractLinks(text, text.length), []);
  });
});
