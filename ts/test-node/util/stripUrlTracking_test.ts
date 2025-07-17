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
  // A `*` in the middle of a path rule should match almost anything, including a `/`
  [
    'https://luisaviaroma.com/_5@%foo/_@()!bar/p?x=y&lvrid=test',
    'https://luisaviaroma.com/_5@%foo/_@()!bar/p?x=y',
  ],
  // A `*` in the middle of a path rule should NOT match a `#`, since that indicates the start of
  // the hash property
  [
    'https://luisaviaroma.com/_%@#()!bar/p?x=y&lvrid=test',
    'https://luisaviaroma.com/_%@#()!bar/p?x=y&lvrid=test',
  ],
  // Address rules that are just `*` should match anything at all
  [
    'https://fake.invalid/blasdflkjasdf?service_id=192u34oijserr',
    'https://fake.invalid/blasdflkjasdf',
  ],
  // It shouldn't matter where the param occurs
  [
    'https://fake.invalid/blasdflkjasdf?foo=bar&service_id=192u34oijserr&baz=biff',
    'https://fake.invalid/blasdflkjasdf?foo=bar&baz=biff',
  ],
  // Spotify domains should have `si` stripped
  [
    'https://x.y.z.open.spotify.com/playlist/1QF7oA9PlHfSGuPmhSGjku?si=Yo-ZJ1yWRIiNnlyutkR7VA&pi=HKd_5k2iSMq0v',
    'https://x.y.z.open.spotify.com/playlist/1QF7oA9PlHfSGuPmhSGjku?pi=HKd_5k2iSMq0v',
  ],
  // Tiktok domains should have the `q` and `is_from_webapp` stripped
  [
    'https://www.tiktok.com/@username/video/6862253018223177445?is_from_webapp=v1&q=some%20query%20here&t=1632318677116',
    'https://www.tiktok.com/@username/video/6862253018223177445?t=1632318677116',
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
  // Missing leading `/` should not matter
  ['https://tiktok.com?referer_video_id=092u34oijserr', 'https://tiktok.com/'],
  // If there is a query param and no subpath, it should be normalized to `/?`
  [
    'https://test.invalid?referer_video_id=092u34oijserr',
    'https://test.invalid/?referer_video_id=092u34oijserr',
  ],
  // All domains should have `fbclid` stripped
  [
    'https://fake.invalid/today/foo/baz?fbclid=PAA0xDSwLCWK1leORuA2FlbQIxMQABpwS8_WWHe9A5RfMfEJfDsP7dJUnorFNdMrotQhkqfsT_oxs38CBvPA6RuCc4_aem_KZEOIfyvmi8iyBTnvr5sFg',
    'https://fake.invalid/today/foo/baz',
  ],
  // All domains should have `cuid` stripped
  ['https://fake.invalid/foo/bar?cuid=baz', 'https://fake.invalid/foo/bar'],
  // Negative rule for `em.dynamicyield.com` means that `cuid` should not be stripped
  [
    'https://em.dynamicyield.com/foo/bar?cuid=baz',
    'https://em.dynamicyield.com/foo/bar?cuid=baz',
  ],
  // Negative rule for `empflix.com` is a naked removeparam. That means absolutely everything must stay
  [
    'https://empflix.com/?fbclid=hello&cuid=world',
    'https://empflix.com/?fbclid=hello&cuid=world',
  ],
  // The stripping shouldn't be too eager. If some undesirable params appear url-encoded in another param, leave them alone
  // Some other impls don't handle this well, eg https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3076
  [
    'https://adguardteam.github.io/AnonymousRedirect/redirect.html?url=https%3A%2F%2Fregister.hollywoodbets.net%2Fsouth-africa%2F1%3Futm_source%3DAdCash%26utm_medium%3DDirect%2B%26utm_campaign%3DGenericPopunder',
    'https://adguardteam.github.io/AnonymousRedirect/redirect.html?url=https%3A%2F%2Fregister.hollywoodbets.net%2Fsouth-africa%2F1%3Futm_source%3DAdCash%26utm_medium%3DDirect%2B%26utm_campaign%3DGenericPopunder',
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
