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
import type { SignalService } from '../../protobuf';

const debug = createDebug('mock:test:lightbox');

describe('lightbox', function (this: Mocha.Suite) {
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

  it('can page through different messages in the same conversation', async () => {
    const page = await app.getWindow();

    await page.getByTestId(pinned.device.aci).click();

    async function sendAttachmentsBack(
      text: string,
      attachments: Array<SignalService.IAttachmentPointer>
    ) {
      debug(`replying with ${attachments.length} attachments`);
      const timestamp = bootstrap.getTimestamp();
      await sendTextMessage({
        from: pinned,
        to: bootstrap.desktop,
        desktop: bootstrap.desktop,
        text,
        attachments,
        timestamp,
      });
      debug('wait for message to appear in timeline');
      const Message = getMessageInTimelineByTimestamp(page, timestamp);
      const MessageImageLoaded = Message.locator('img.module-image__image');

      await Message.waitFor();

      await Promise.all(
        attachments.map(async (_, index) => {
          debug(`waiting for ${index} image to render in timeline`);
          await MessageImageLoaded.nth(index).waitFor({
            state: 'visible',
          });
        })
      );
    }

    const fixturesDir = path.join(__dirname, '..', '..', '..', 'fixtures');
    const imageCat = path.join(fixturesDir, 'cat-screenshot.png');
    const imageSnow = path.join(fixturesDir, 'snow.jpg');
    const imageWaterfall = path.join(
      fixturesDir,
      'koushik-chowdavarapu-105425-unsplash.jpg'
    );

    const [attachmentCat] = await sendMessageWithAttachments(
      page,
      pinned,
      'Message1',
      [imageCat]
    );
    const [attachmentSnow, attachmentWaterfall] =
      await sendMessageWithAttachments(page, pinned, 'Message2', [
        imageSnow,
        imageWaterfall,
      ]);

    await sendAttachmentsBack('Message3', [attachmentCat]);
    await sendAttachmentsBack('Message4', [
      attachmentSnow,
      attachmentWaterfall,
    ]);

    debug('Clicking first image');
    const FirstMessage = getTimelineMessageWithText(page, 'Message1');
    const FirstImage = FirstMessage.locator('.module-image').nth(0);

    await FirstImage.click();

    const Lightbox = page.locator('.Lightbox');
    const LightboxContent = Lightbox.locator('.Lightbox__zoomable-container');
    const LighboxPrev = Lightbox.locator('.Lightbox__button--previous');
    const LighboxNext = Lightbox.locator('.Lightbox__button--next');

    await Lightbox.waitFor();

    async function expectLightboxImage(
      attachment: SignalService.IAttachmentPointer
    ) {
      strictAssert(attachment.fileName, 'Must have filename');
      const Object = LightboxContent.getByTestId(attachment.fileName);
      debug(`Waiting for ${attachment.fileName}`);
      await expect(Object).toBeVisible();
    }

    const order = [
      ['sent 1: attachment 1', attachmentCat],
      ['sent 2: attachment 1', attachmentSnow],
      ['sent 2: attachment 2', attachmentWaterfall],
      ['received 1: attachment 1', attachmentCat],
      ['received 2: attachment 1', attachmentSnow],
      ['received 2: attachment 2', attachmentWaterfall],
    ] as const;

    const reverseOrder = order.slice().reverse();

    for (const [index, [label, attachment]] of order.entries()) {
      if (index > 0) {
        // eslint-disable-next-line no-await-in-loop
        await LighboxNext.click();
      }
      debug(label);
      // eslint-disable-next-line no-await-in-loop
      await expectLightboxImage(attachment);
    }

    for (const [index, [label, attachment]] of reverseOrder.entries()) {
      if (index > 0) {
        // eslint-disable-next-line no-await-in-loop
        await LighboxPrev.click();
      }
      debug(label);
      // eslint-disable-next-line no-await-in-loop
      await expectLightboxImage(attachment);
    }
  });
});
