// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { assert } from 'chai';
import { expect } from 'playwright/test';
import { type PrimaryDevice, StorageState } from '@signalapp/mock-server';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';

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

export const debug = createDebug('mock:test:attachments');

const CAT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'cat-screenshot.png'
);
const VIDEO_PATH = path.join(
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
});
