// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { applyAllRules } from '../../util/stripUrlTracking';

const TEST_VECTORS: string[][] = [
  // All domains should have igshid stripped
  [
    'https://instagram.com/blasdflkjasdf?igshid=192u34oijserr',
    'https://instagram.com/blasdflkjasdf',
  ],
  [
    'https://fake.invalid/blasdflkjasdf?igshid=192u34oijserr',
    'https://fake.invalid/blasdflkjasdf',
  ],
  // Spotify domains should have `si` stripped
  [
    'https://open.spotify.com/playlist/1QF7oA9PlHfSGuPmhSGjku?si=Yo-ZJ1yWRIiNnlyutkR7VA&pi=HKd_5k2iSMq0v',
    'https://open.spotify.com/playlist/1QF7oA9PlHfSGuPmhSGjku?pi=HKd_5k2iSMq0v',
  ],
  // Tiktok domains should have the `q` and `is_from_webapp` stripped
  [
    'https://www.tiktok.com/@bellapoarch/video/6862253018223177445?is_from_webapp=v1&q=bella%20poarch%20m%20to%20the%20b&t=1632318677116',
    'https://www.tiktok.com/@bellapoarch/video/6862253018223177445?t=1632318677116',
  ],
  // Tiktok domains should have referrer_video_id stripped
  [
    'https://tiktok.com/blasdflkjasdf?referer_video_id=092u34oijserr',
    'https://tiktok.com/blasdflkjasdf',
  ],
  // Domains outside Tiktok should NOT have igshid stripped
  [
    'https://test.invalid/blasdflkjasdf?referer_video_id=092u34oijserr',
    'https://test.invalid/blasdflkjasdf?referer_video_id=092u34oijserr',
  ],
  // All domains should have `fbclid` stripped
  [
    'https://gothamist.com/news/life-threatening-heat-wave-will-blanket-ny-next-week-hochul-and-state-officials-warn?fbclid=PAA0xDSwLCWK1leORuA2FlbQIxMQABpwS8_WWHe9A5RfMfEJfDsP7dJUnorFNdMrotQhkqfsT_oxs38CBvPA6RuCc4_aem_KZEOIfyvmi8iyBTnvr5sFg',
    'https://gothamist.com/news/life-threatening-heat-wave-will-blanket-ny-next-week-hochul-and-state-officials-warn',
  ],
  // All domains should have `cuid` stripped
  ['https://fake.invalid/foo/bar?cuid=baz', 'https://fake.invalid/foo/bar'],
  // Negative rule for `em.dynamicyield.com` means that `cuid` should not be stripped
  [
    'https://em.dynamicyield.com/foo/bar?cuid=baz',
    'https://em.dynamicyield.com/foo/bar?cuid=baz',
  ],
];

describe('URL tracking parameter stripping', () => {
  it('passes known-answer tests', () => {
    // We check that the sanitized URL equals the expected URL
    for (const [urlStr, expected] of TEST_VECTORS) {
      const url = new URL(urlStr);
      const out = applyAllRules(url);
      // Check that the output matches the expected value. Panic on false. This is
      // browser code so `assert` is not defined
      assert.strictEqual(out.toString(), expected);
    }
  });
});
