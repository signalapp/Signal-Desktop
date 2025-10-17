// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import config from 'config';

import { keyPair, sign, verify } from '../../updater/curve.node.js';

describe('updater/curve', () => {
  it('roundtrips', () => {
    const message = Buffer.from('message');
    const { publicKey, privateKey } = keyPair();
    const signature = sign(privateKey, message);
    const verified = verify(publicKey, message, signature);

    assert.strictEqual(verified, true);
  });

  it('verifies with our own key', () => {
    const message = Buffer.from(
      '7761a7761eccc0af7ab67546ec044e40dd1e9762f03d0c504d53fb40ceba5738-1.40.0-beta.3'
    );
    const signature = Buffer.from(
      '982eee37076a391392879ce7a69e6ce24708cf12abd87624ae116c665e75b5404bf29fe2cd76c6213753bd16d7529f0f9116d63a63e90d2c6c8b57e17cc17100',
      'hex'
    );
    const publicKey = Buffer.from(
      config.get<string>('updatesPublicKey'),
      'hex'
    );

    const verified = verify(publicKey, message, signature);

    assert.strictEqual(verified, true);
  });
});
