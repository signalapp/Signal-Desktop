// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { generateSnippetAroundMention } from '../../util/search.std.js';

describe('generateSnippetAroundMention', () => {
  it('generates snippet around mention at start of body', () => {
    const snippet = generateSnippetAroundMention({
      body: '  can you sing that again but in the voice of Mr. Snuffleupagus?',
      mentionStart: 0,
      mentionLength: 1,
    });

    assert.strictEqual(
      snippet,
      '<<left>> <<right>> can you sing that again but in the voice of Mr<<truncation>>'
    );
  });
  it('generates snippet around mention in middle of body', () => {
    const snippet = generateSnippetAroundMention({
      body: 'Stevie can you sing that again with   but in the voice of Mr. Snuffleupagus?',
      mentionStart: 36,
      mentionLength: 1,
    });

    assert.strictEqual(
      snippet,
      '<<truncation>>you sing that again with <<left>> <<right>> but in the voice of Mr<<truncation>>'
    );
  });
  it('generates snippet around mention at end of body', () => {
    const snippet = generateSnippetAroundMention({
      body: 'Stevie can you sing that again but in the voice of  ',
      mentionStart: 51,
      mentionLength: 1,
    });

    assert.strictEqual(
      snippet,
      '<<truncation>>again but in the voice of <<left>> <<right>>'
    );
  });
  it('generates snippet around mention-only body', () => {
    const snippet = generateSnippetAroundMention({
      body: ' ',
      mentionStart: 0,
      mentionLength: 1,
    });

    assert.strictEqual(snippet, '<<left>> <<right>>');
  });
});
