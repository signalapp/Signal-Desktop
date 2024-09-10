// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { expect } from 'playwright/test';
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

export const debug = createDebug('mock:test:attachments');

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
      [path.join(__dirname, '..', '..', '..', 'fixtures', 'cat-screenshot.png')]
    );

    const Message = getTimelineMessageWithText(page, 'This is my cat');
    const MessageSent = Message.locator(
      '.module-message__metadata__status-icon--sent'
    );

    debug('waiting for send');
    await MessageSent.waitFor();
    const timestamp = await Message.getAttribute('data-testid');
    strictAssert(timestamp, 'timestamp must exist');

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
  });
});
