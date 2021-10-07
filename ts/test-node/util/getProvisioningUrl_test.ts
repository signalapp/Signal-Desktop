// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { size } from '../../util/iterables';

import { getProvisioningUrl } from '../../util/getProvisioningUrl';

// It'd be nice to run these tests in the renderer, too, but [Chromium's `URL` doesn't
//   handle `sgnl:` links correctly][0].
//
// [0]: https://bugs.chromium.org/p/chromium/issues/detail?id=869291
describe('getProvisioningUrl', () => {
  it('returns a URL with a UUID and public key', () => {
    const uuid = 'a08bf1fd-1799-427f-a551-70af747e3956';
    const publicKey = new Uint8Array([9, 8, 7, 6, 5, 4, 3]);

    const result = getProvisioningUrl(uuid, publicKey);
    const resultUrl = new URL(result);

    assert.strictEqual(resultUrl.protocol, 'sgnl:');
    assert.strictEqual(resultUrl.host, 'linkdevice');
    assert.strictEqual(size(resultUrl.searchParams.entries()), 2);
    assert.strictEqual(resultUrl.searchParams.get('uuid'), uuid);
    assert.strictEqual(resultUrl.searchParams.get('pub_key'), 'CQgHBgUEAw==');
  });
});
