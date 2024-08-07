/* eslint-disable no-console */
// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Proto } from '@signalapp/mock-server';
import { assert } from 'chai';
import type { App } from '../playwright';
import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import { createMessage } from './support/messages';
import { dropFile } from './support/file-upload';

const pause = process.env.PAUSE;

describe('image attachments', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  let message: Proto.IDataMessage;

  beforeEach(async () => {
    bootstrap = new Bootstrap({});
    await bootstrap.init();
    app = await bootstrap.link();

    const { phone, desktop } = bootstrap;

    message = createMessage('A B C');

    await phone.sendRaw(
      desktop,
      {
        dataMessage: message,
      },
      {
        timestamp: Number(message.timestamp),
      }
    );
  });

  afterEach(async function (this: Mocha.Context) {
    if (!pause) {
      await bootstrap?.maybeSaveLogs(this.currentTest, app);
      await app?.close();
      await bootstrap?.teardown();
    }
  });

  it('preserves controls when zooming in on images', async () => {
    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();

    await window.locator('.module-conversation-hero').waitFor();

    await window
      .locator(`.module-message__text >> "${message.body}"`)
      .waitFor();

    await dropFile({
      filePath: './fixtures/cat-screenshot.png',
      contentType: 'image/png',
      selector: '.module-timeline__messages',
      window,
    });

    await window
      .getByAltText('Draft image attachment: cat-screenshot.png')
      .waitFor();

    const messageTextInput = await app.waitForEnabledComposer();

    await messageTextInput.press('Enter');

    // @todo: How do I get the ids of the conversation or message that was just added?

    // Click the image in the message to open it in lighbox view
    await window.click('.module-message .module-image__border-overlay');

    // Zoom in
    await window.click('.Lightbox__zoom-button');

    // [6852] Checking computed style because
    //
    //    "Elements with opacity:0 are considered visible."
    //
    // See: https://playwright.dev/docs/actionability#visible
    const opacity: string = await (
      await window.locator('.Lightbox__header')
    ).evaluate(element => {
      // @ts-expect-error '"window" means browser window here'
      return window.getComputedStyle(element).getPropertyValue('opacity');
    });

    assert.strictEqual(opacity, '1');
  });
});
