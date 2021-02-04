// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { keyPair, sign, verify } from '../../updater/curve';

describe('updater/curve', () => {
  it('roundtrips', () => {
    const message = Buffer.from('message');
    const { publicKey, privateKey } = keyPair();
    const signature = sign(privateKey, message);
    const verified = verify(publicKey, message, signature);

    assert.strictEqual(verified, true);
  });
});
