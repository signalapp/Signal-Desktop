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
  getTimeline,
  sendTextMessage,
  typeIntoInput,
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
    await page
      .getByTestId('attachfile-input')
      .setInputFiles(
        path.join(__dirname, '..', '..', '..', 'fixtures', 'cat-screenshot.png')
      );
    await page
      .locator('.module-image.module-staged-attachment .module-image__image')
      .waitFor();
    const input = await app.waitForEnabledComposer();
    await typeIntoInput(input, 'This is my cat');
    await input.press('Enter');

    const allMessagesLocator = getTimeline(page).getByRole('article');
    await expect(allMessagesLocator).toHaveCount(1);

    const allMessages = await allMessagesLocator.all();
    const message = allMessages[0];

    await message.getByText('This is my cat').waitFor();
    await message
      .locator('.module-message__metadata__status-icon--sent')
      .waitFor();

    const timestamp = await message
      .locator('.module-message.module-message--outgoing')
      .getAttribute('data-testid');

    strictAssert(timestamp, 'timestamp must exist');

    // For this test, just send back the same attachment that was uploaded to test a
    // round-trip
    const receivedMessage = await pinned.waitForMessage();
    const attachment = receivedMessage.dataMessage.attachments?.[0];
    strictAssert(attachment, 'attachment must exist');

    const incomingTimestamp = Date.now();
    await sendTextMessage({
      from: pinned,
      to: bootstrap.desktop,
      desktop: bootstrap.desktop,
      text: 'Wait, that is MY cat!',
      attachments: [attachment],
      timestamp: incomingTimestamp,
    });

    await expect(
      getMessageInTimelineByTimestamp(page, incomingTimestamp).locator(
        'img.module-image__image'
      )
    ).toBeVisible();
  });
});
