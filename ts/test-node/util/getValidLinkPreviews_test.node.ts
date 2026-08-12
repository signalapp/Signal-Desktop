// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { LinkPreviewType } from '../../types/message/LinkPreviews.std.ts';
import { getValidLinkPreviews } from '../../util/getValidLinkPreviews.node.ts';
import { callLinkRootKeyToUrl } from '../../util/callLinkRootKeyToUrl.std.ts';
import { FAKE_CALL_LINK } from '../../test-helpers/fakeCallLink.std.ts';

describe('getValidLinkPreviews', () => {
  function composePreview(url: string): LinkPreviewType {
    return { url, title: 'Title', description: 'Description' };
  }

  it('keeps an https preview whose url appears in the body', () => {
    const result = getValidLinkPreviews(
      [composePreview('https://signal.org')],
      'Check this out: https://signal.org today',
      { isStory: false }
    );
    assert.lengthOf(result, 1);
    assert.exists(result[0]);
    assert.strictEqual(result[0].url, 'https://signal.org');
  });

  it('drops a preview whose url is absent from the body', () => {
    const result = getValidLinkPreviews(
      [composePreview('https://signal.org')],
      'There is no link in this body',
      { isStory: false }
    );
    assert.lengthOf(result, 0);
  });

  it('drops a non-https preview even when the url is in the body', () => {
    const result = getValidLinkPreviews(
      [composePreview('http://signal.org')],
      'Insecure link: http://signal.org',
      { isStory: false }
    );
    assert.lengthOf(result, 0);
  });

  it('exempts stories from the url-in-body requirement', () => {
    const result = getValidLinkPreviews(
      [composePreview('https://signal.org')],
      '',
      {
        isStory: true,
      }
    );
    assert.lengthOf(result, 1);
    assert.exists(result[0]);
    assert.strictEqual(result[0].url, 'https://signal.org');
  });

  it('call links also require url in the body', () => {
    const url = callLinkRootKeyToUrl(FAKE_CALL_LINK.rootKey);
    assert.exists(url);
    const result = getValidLinkPreviews([composePreview(url)], '', {
      isStory: false,
    });
    assert.lengthOf(result, 0);
  });

  it('keeps only the valid previews from a mixed list', () => {
    const result = getValidLinkPreviews(
      [
        composePreview('https://url-1.org'),
        composePreview('https://url-2.org'),
        composePreview('https://not-in-body.org'),
      ],
      'see https://url-1.org and https://url-2.org',
      { isStory: false }
    );
    assert.deepEqual(
      result.map(item => item.url),
      ['https://url-1.org', 'https://url-2.org']
    );
  });
});
