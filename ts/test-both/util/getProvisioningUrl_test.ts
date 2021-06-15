// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { size } from '../../util/iterables';

import { typedArrayToArrayBuffer } from '../../Crypto';

import { getProvisioningUrl } from '../../util/getProvisioningUrl';

describe('getProvisioningUrl', () => {
  it('returns a URL with a UUID and public key', () => {
    const uuid = 'a08bf1fd-1799-427f-a551-70af747e3956';
    const publicKey = new Uint8Array([9, 8, 7, 6, 5, 4, 3]);

    const result = getProvisioningUrl(uuid, typedArrayToArrayBuffer(publicKey));
    const resultUrl = new URL(result);

    assert(result.startsWith('tsdevice:/?'));
    assert.strictEqual(resultUrl.protocol, 'tsdevice:');
    assert.strictEqual(size(resultUrl.searchParams.entries()), 2);
    assert.strictEqual(resultUrl.searchParams.get('uuid'), uuid);
    assert.strictEqual(resultUrl.searchParams.get('pub_key'), 'CQgHBgUEAw==');
  });
});
