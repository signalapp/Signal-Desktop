// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { assert } from 'chai';
import { expect } from 'playwright/test';
import { type PrimaryDevice, StorageState } from '@signalapp/mock-server';
import { join } from 'node:path';
import { access, readFile } from 'node:fs/promises';

import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';
import {
  getMessageInTimelineByTimestamp,
  getTimelineMessageWithText,
  sendMessageWithAttachments,
  sendTextMessage,
} from '../helpers.node.js';
import * as durations from '../../util/durations/index.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { VIDEO_MP4 } from '../../types/MIME.std.js';
import { toBase64 } from '../../Bytes.std.js';
import type { AttachmentType } from '../../types/Attachment.std.js';

export const debug = createDebug('mock:test:attachments');

const CAT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'cat-screenshot.png'
);
const VIDEO_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'ghost-kitty.mp4'
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

    const {
      attachments: [attachmentCat],
    } = await sendMessageWithAttachments(page, pinned, 'This is my cat', [
      CAT_PATH,
    ]);

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

    assert.strictEqual(incomingAttachment?.key, sentAttachment?.key);
    assert.strictEqual(incomingAttachment?.digest, sentAttachment?.digest);
  });

  it('can download videos with incrementalMac and is resilient to bad incrementalMacs', async () => {
    const { desktop } = bootstrap;
    const page = await app.getWindow();

    await page.getByTestId(pinned.device.aci).click();

    const plaintextVideo = await readFile(VIDEO_PATH);
    const videoPointer1 = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextVideo,
      VIDEO_MP4
    );
    const videoPointer2 = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextVideo,
      VIDEO_MP4
    );

    const incrementalTimestamp = Date.now();
    const badIncrementalTimestamp = incrementalTimestamp + 1;

    await sendTextMessage({
      from: pinned,
      to: desktop,
      desktop,
      text: 'video with good incrementalMac',
      attachments: [videoPointer1],
      timestamp: incrementalTimestamp,
    });
    await sendTextMessage({
      from: pinned,
      to: desktop,
      desktop,
      text: 'video with bad incrementalMac',
      attachments: [
        { ...videoPointer2, chunkSize: (videoPointer2.chunkSize ?? 42) + 1 },
      ],
      timestamp: badIncrementalTimestamp,
    });

    await expect(
      getMessageInTimelineByTimestamp(page, incrementalTimestamp).locator(
        'img.module-image__image'
      )
    ).toBeVisible();
    await expect(
      getMessageInTimelineByTimestamp(page, badIncrementalTimestamp).locator(
        'img.module-image__image'
      )
    ).toBeVisible();

    // goodIncrementalMac preserved
    {
      const messageInDB = (
        await app.getMessagesBySentAt(incrementalTimestamp)
      )[0];
      strictAssert(messageInDB, 'message exists in DB');
      const attachmentInDB = messageInDB.attachments?.[0];
      strictAssert(videoPointer1.incrementalMac, 'must exist');
      strictAssert(videoPointer1.chunkSize, 'must exist');
      assert.strictEqual(
        attachmentInDB?.incrementalMac,
        toBase64(videoPointer1.incrementalMac)
      );
      assert.strictEqual(attachmentInDB?.chunkSize, videoPointer1.chunkSize);
    }

    // badIncrementalMac removed
    {
      const messageInDB = (
        await app.getMessagesBySentAt(badIncrementalTimestamp)
      )[0];
      strictAssert(messageInDB, 'message exists in DB');
      const attachmentInDB = messageInDB.attachments?.[0];
      strictAssert(videoPointer2.incrementalMac, 'must exist');
      strictAssert(videoPointer2.chunkSize, 'must exist');
      assert.strictEqual(attachmentInDB?.incrementalMac, undefined);
      assert.strictEqual(attachmentInDB?.chunkSize, undefined);
    }
  });

  it('reuses attachment file when receiving and sending same video and deletes only when all references removed', async () => {
    const page = await app.getWindow();

    const { desktop, phone } = bootstrap;
    await page.getByTestId(pinned.device.aci).click();

    const plaintextVideo = await readFile(VIDEO_PATH);
    const ciphertextVideo = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextVideo,
      VIDEO_MP4
    );

    const ciphertextVideo2 = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextVideo,
      VIDEO_MP4
    );

    const phoneTimestamp = bootstrap.getTimestamp();
    const friendTimestamp = bootstrap.getTimestamp();

    debug('receiving attachment from primary');
    await page.getByTestId(pinned.device.aci).click();
    await sendTextMessage({
      from: phone,
      to: pinned,
      text: 'from phone',
      desktop,
      attachments: [{ ...ciphertextVideo, width: 568, height: 320 }],
      timestamp: phoneTimestamp,
    });
    await getMessageInTimelineByTimestamp(page, phoneTimestamp)
      .locator('.module-image--loaded')
      .waitFor();

    debug('receiving same attachment from contact');
    await page.getByTestId(pinned.device.aci).click();
    await sendTextMessage({
      from: pinned,
      to: desktop,
      text: 'from friend',
      desktop,
      attachments: [{ ...ciphertextVideo2, width: 568, height: 320 }],
      timestamp: friendTimestamp,
    });

    await getMessageInTimelineByTimestamp(page, friendTimestamp)
      .locator('.module-image--loaded')
      .waitFor();

    debug('sending same attachment from desktop');
    const { timestamp: sentTimestamp } = await sendMessageWithAttachments(
      page,
      pinned,
      'from desktop',
      [VIDEO_PATH]
    );

    strictAssert(sentTimestamp, 'outgoing timestamp must exist');

    const phoneDBMessage = (await app.getMessagesBySentAt(phoneTimestamp))[0];
    const phoneDBAttachment: AttachmentType = phoneDBMessage.attachments?.[0];

    const friendDBMessage = (await app.getMessagesBySentAt(friendTimestamp))[0];
    const friendDBAttachment: AttachmentType = friendDBMessage.attachments?.[0];

    const sentDBMessage = (await app.getMessagesBySentAt(sentTimestamp))[0];
    const sentDBAttachment: AttachmentType = sentDBMessage.attachments?.[0];

    strictAssert(phoneDBAttachment, 'outgoing sync message exists in DB');
    strictAssert(friendDBAttachment, 'incoming message exists in DB');
    strictAssert(sentDBAttachment, 'sent message exists in DB');

    const { path } = phoneDBAttachment;
    const thumbnailPath = phoneDBAttachment.thumbnail?.path;

    strictAssert(path, 'path exists');
    strictAssert(thumbnailPath, 'thumbnail path exists');

    debug(
      'checking that incoming and outgoing messages deduplicated data on disk'
    );
    assert.strictEqual(phoneDBAttachment.path, path);
    assert.strictEqual(friendDBAttachment.path, path);
    assert.strictEqual(sentDBAttachment.path, path);

    assert.strictEqual(phoneDBAttachment.thumbnail?.path, thumbnailPath);
    assert.strictEqual(friendDBAttachment.thumbnail?.path, thumbnailPath);
    assert.strictEqual(sentDBAttachment.thumbnail?.path, thumbnailPath);

    debug('deleting two of the messages');
    const sentMessage = getMessageInTimelineByTimestamp(page, sentTimestamp);
    await sentMessage.click({ button: 'right' });

    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete for me' }).click();

    await expect(sentMessage).not.toBeVisible();

    const friendMessage = getMessageInTimelineByTimestamp(
      page,
      friendTimestamp
    );
    await friendMessage.click({ button: 'right' });

    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete for me' }).click();
    await expect(friendMessage).not.toBeVisible();

    await app.waitForMessageToBeCleanedUp(sentDBMessage.id);
    await app.waitForMessageToBeCleanedUp(friendDBMessage.id);

    assert.strictEqual(
      (await app.getMessagesBySentAt(friendTimestamp)).length,
      0
    );
    assert.strictEqual(
      (await app.getMessagesBySentAt(sentTimestamp)).length,
      0
    );
    // Path still exists!
    await access(bootstrap.getAbsoluteAttachmentPath(path));

    debug('delete last of messages');
    const phoneMessage = getMessageInTimelineByTimestamp(page, phoneTimestamp);
    await phoneMessage.click({ button: 'right' });

    await page.getByRole('menuitem', { name: 'Delete' }).click();

    await page.getByRole('button', { name: 'Delete for me' }).click();
    await expect(phoneMessage).not.toBeVisible();

    await app.waitForMessageToBeCleanedUp(phoneDBMessage.id);
    assert.strictEqual(
      (await app.getMessagesBySentAt(phoneTimestamp)).length,
      0
    );

    await expect(
      access(bootstrap.getAbsoluteAttachmentPath(path))
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('reencodes images to same data and reuses same file when sending', async () => {
    const page = await app.getWindow();

    await page.getByTestId(pinned.device.aci).click();

    const { timestamp: firstTimestamp } = await sendMessageWithAttachments(
      page,
      pinned,
      'first send',
      [CAT_PATH]
    );

    const { timestamp: secondTimestamp } = await sendMessageWithAttachments(
      page,
      pinned,
      'second send',
      [CAT_PATH]
    );

    const firstAttachment: AttachmentType = (
      await app.getMessagesBySentAt(firstTimestamp)
    )[0].attachments?.[0];

    const secondAttachment: AttachmentType = (
      await app.getMessagesBySentAt(secondTimestamp)
    )[0].attachments?.[0];

    strictAssert(firstAttachment, 'firstAttachment exists in DB');
    strictAssert(secondAttachment, 'secondAttachment exists in DB');

    debug(
      'checking that incoming and outgoing messages deduplicated data on disk'
    );
    assert.strictEqual(firstAttachment.path, secondAttachment.path);
    assert.strictEqual(firstAttachment.localKey, secondAttachment.localKey);
    assert.strictEqual(
      firstAttachment.thumbnail?.path,
      secondAttachment.thumbnail?.path
    );
  });
});
