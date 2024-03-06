// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import createDebug from 'debug';
import Long from 'long';

import type { App } from '../playwright';
import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:sendSync');

describe('sendSync', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
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

  it('creates conversation for sendSync to PNI', async () => {
    const { desktop, phone, server } = bootstrap;

    debug('Creating stranger');
    const STRANGER_NAME = 'Mysterious Stranger';
    const stranger = await server.createPrimaryDevice({
      profileName: STRANGER_NAME,
    });

    const timestamp = Date.now();
    const messageText = 'hey there, just reaching out';
    const destinationServiceId = stranger.device.pni;
    const destination = stranger.device.number;
    const originalDataMessage = {
      body: messageText,
      timestamp: Long.fromNumber(timestamp),
    };
    const content = {
      syncMessage: {
        sent: {
          destinationServiceId,
          destination,
          timestamp: Long.fromNumber(timestamp),
          message: originalDataMessage,
        },
      },
    };
    const sendOptions = {
      timestamp,
    };
    await phone.sendRaw(desktop, content, sendOptions);

    const page = await app.getWindow();
    const leftPane = page.locator('#LeftPane');

    debug('checking left pane for conversation');
    const strangerName = await leftPane
      .locator(
        '.module-conversation-list__item--contact-or-conversation .module-contact-name'
      )
      .first()
      .innerText();

    assert.equal(
      strangerName.slice(-4),
      destination?.slice(-4),
      'no profile, just phone number'
    );

    debug('opening conversation');
    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();

    debug('checking for latest message');
    await page.locator(`.module-message__text >> "${messageText}"`).waitFor();
  });
});
