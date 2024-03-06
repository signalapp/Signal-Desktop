// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { getMediaNameForBackup } from '../../util/attachments/getMediaNameForBackup';
import { IMAGE_PNG } from '../../types/MIME';
import { sha256 } from '../../Crypto';
import { DAY } from '../../util/durations';

describe('getMediaNameForBackup', () => {
  const TEST_HASH = sha256(Buffer.from('testattachmentdata'));
  const TEST_HASH_BASE_64 =
    // calculated as Buffer.from(TEST_HASH).toString('base64')
    'ds5/U14lB2ziO90B7MldFTJUQdyw4qQ9y6Gnt9fmHL0=';

  afterEach(function (this: Mocha.Context) {
    sinon.restore();
  });

  it("should return base64 encoded plaintextHash if it's already been calculated", async () => {
    assert.strictEqual(
      await getMediaNameForBackup(
        {
          contentType: IMAGE_PNG,
          size: 100,
          plaintextHash: Buffer.from(TEST_HASH).toString('hex'),
        },
        'senderAci',
        Date.now()
      ),
      TEST_HASH_BASE_64
    );
  });

  it('should calculate hash from file on disk if plaintextHash has not yet been calculated', async () => {
    const stubbedGetHashFromDisk = sinon
      .stub()
      .callsFake(async (_path: string) =>
        Buffer.from(TEST_HASH).toString('hex')
      );

    const mediaName = await getMediaNameForBackup(
      {
        contentType: IMAGE_PNG,
        size: 100,
        path: 'path/to/file',
      },
      'senderAci',
      Date.now(),
      { getPlaintextHashForAttachmentOnDisk: stubbedGetHashFromDisk }
    );

    assert.strictEqual(stubbedGetHashFromDisk.callCount, 1);
    assert.strictEqual(mediaName, TEST_HASH_BASE_64);
  });

  it('should return temporary identifier if attachment is undownloaded but in attachment tier', async () => {
    const mediaName = await getMediaNameForBackup(
      {
        contentType: IMAGE_PNG,
        size: 100,
        cdnKey: 'cdnKey',
      },
      'senderAci',
      Date.now()
    );

    assert.strictEqual(mediaName, 'senderAci_cdnKey');
  });

  it('should return temporary identifier if undownloaded attachment has temporary error', async () => {
    const mediaName = await getMediaNameForBackup(
      {
        contentType: IMAGE_PNG,
        size: 100,
        cdnKey: 'cdnKey',
        error: true,
        key: 'attachmentkey',
      },
      'senderAci',
      Date.now()
    );

    assert.strictEqual(mediaName, 'senderAci_cdnKey');
  });

  it('should return undefined if attachment is too old to be in attachment tier', async () => {
    const mediaName = await getMediaNameForBackup(
      {
        contentType: IMAGE_PNG,
        size: 100,
        cdnKey: 'cdnKey',
      },
      'senderAci',
      Date.now() - 31 * DAY
    );

    assert.strictEqual(mediaName, undefined);
  });
});
