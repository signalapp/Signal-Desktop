// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { assert } from 'chai';
import { expect } from 'playwright/test';
import { readFileSync } from 'fs';
import { type PrimaryDevice, StorageState } from '@signalapp/mock-server';
import * as path from 'path';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import {
  getMessageInTimelineByTimestamp,
  getTimelineMessageWithText,
  sendMessageWithAttachments,
  sendTextMessage,
} from '../helpers';
import * as durations from '../../util/durations';
import { strictAssert } from '../../util/assert';
import {
  encryptAttachmentV2ToDisk,
  generateAttachmentKeys,
} from '../../AttachmentCrypto';
import { toBase64 } from '../../Bytes';
import type { AttachmentWithNewReencryptionInfoType } from '../../types/Attachment';
import { IMAGE_JPEG } from '../../types/MIME';

export const debug = createDebug('mock:test:attachments');

const CAT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'cat-screenshot.png'
);

describe('attachments', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let pinned: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    let state = StorageState.getEmpty();

    const { phone, contacts } = bootstrap;
    [pinned] = contacts;

    state = state.addContact(pinned, {
      identityKey: pinned.publicKey.serialize(),
      profileKey: pinned.profileKey.serialize(),
      whitelisted: true,
    });

    state = state.pin(pinned);
    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('can upload attachment to CDN3 and download incoming attachment', async () => {
    const page = await app.getWindow();

    await page.getByTestId(pinned.device.aci).click();

    const [attachmentCat] = await sendMessageWithAttachments(
      page,
      pinned,
      'This is my cat',
      [CAT_PATH]
    );

    const Message = getTimelineMessageWithText(page, 'This is my cat');
    const MessageSent = Message.locator(
      '.module-message__metadata__status-icon--sent'
    );

    debug('waiting for send');
    await MessageSent.waitFor();
    const timestamp = await Message.getAttribute('data-testid');
    strictAssert(timestamp, 'timestamp must exist');

    const sentMessage = (
      await app.getMessagesBySentAt(parseInt(timestamp, 10))
    )[0];
    strictAssert(sentMessage, 'message exists in DB');
    const sentAttachment = sentMessage.attachments?.[0];
    assert.isTrue(sentAttachment?.isReencryptableToSameDigest);
    assert.isUndefined(
      (sentAttachment as unknown as AttachmentWithNewReencryptionInfoType)
        .reencryptionInfo
    );

    // For this test, just send back the same attachment that was uploaded to test a
    // round-trip
    const incomingTimestamp = Date.now();
    await sendTextMessage({
      from: pinned,
      to: bootstrap.desktop,
      desktop: bootstrap.desktop,
      text: 'Wait, that is MY cat!',
      attachments: [attachmentCat],
      timestamp: incomingTimestamp,
    });

    await expect(
      getMessageInTimelineByTimestamp(page, incomingTimestamp).locator(
        'img.module-image__image'
      )
    ).toBeVisible();

    const incomingMessage = (
      await app.getMessagesBySentAt(incomingTimestamp)
    )[0];
    strictAssert(incomingMessage, 'message exists in DB');
    const incomingAttachment = incomingMessage.attachments?.[0];
    assert.isTrue(incomingAttachment?.isReencryptableToSameDigest);
    assert.isUndefined(
      (incomingAttachment as unknown as AttachmentWithNewReencryptionInfoType)
        .reencryptionInfo
    );
    assert.strictEqual(incomingAttachment?.key, sentAttachment?.key);
    assert.strictEqual(incomingAttachment?.digest, sentAttachment?.digest);
  });

  it('receiving attachments with non-zero padding will cause new re-encryption info to be generated', async () => {
    const page = await app.getWindow();

    await page.getByTestId(pinned.device.aci).click();

    const plaintextCat = readFileSync(CAT_PATH);

    const cdnKey = 'cdnKey';
    const keys = generateAttachmentKeys();
    const cdnNumber = 3;

    const { digest: newDigest, path: ciphertextPath } =
      await encryptAttachmentV2ToDisk({
        keys,
        plaintext: {
          // add non-zero byte to the end of the data; this will be considered padding
          // when received since we will include the size of the un-appended data when
          // sending
          data: Buffer.concat([plaintextCat, Buffer.from([1])]),
        },
        getAbsoluteAttachmentPath: relativePath =>
          bootstrap.getAbsoluteAttachmentPath(relativePath),
        needIncrementalMac: false,
      });

    const ciphertextCatWithNonZeroPadding = readFileSync(
      bootstrap.getAbsoluteAttachmentPath(ciphertextPath)
    );

    await bootstrap.server.storeAttachmentOnCdn(
      cdnNumber,
      cdnKey,
      ciphertextCatWithNonZeroPadding
    );

    const incomingTimestamp = Date.now();
    await sendTextMessage({
      from: pinned,
      to: bootstrap.desktop,
      desktop: bootstrap.desktop,
      text: 'Wait, that is MY cat! But now with weird padding!',
      attachments: [
        {
          size: plaintextCat.byteLength,
          contentType: IMAGE_JPEG,
          cdnKey,
          cdnNumber,
          key: keys,
          digest: newDigest,
        },
      ],
      timestamp: incomingTimestamp,
    });

    await expect(
      getMessageInTimelineByTimestamp(page, incomingTimestamp).locator(
        'img.module-image__image'
      )
    ).toBeVisible();

    const incomingMessage = (
      await app.getMessagesBySentAt(incomingTimestamp)
    )[0];
    strictAssert(incomingMessage, 'message exists in DB');
    const incomingAttachment = incomingMessage.attachments?.[0];

    assert.isFalse(incomingAttachment?.isReencryptableToSameDigest);
    assert.exists(incomingAttachment?.reencryptionInfo);
    assert.exists(incomingAttachment?.reencryptionInfo.digest);

    assert.strictEqual(incomingAttachment?.key, toBase64(keys));
    assert.strictEqual(incomingAttachment?.digest, toBase64(newDigest));
    assert.notEqual(
      incomingAttachment?.digest,
      incomingAttachment.reencryptionInfo.digest
    );
  });
});
