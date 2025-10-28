// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import Long from 'long';

import type { App } from '../playwright.node.js';
import * as durations from '../../util/durations/index.std.js';
import { Bootstrap } from '../bootstrap.node.js';

export const debug = createDebug('mock:test:readSync');

describe('readSync', function (this: Mocha.Suite) {
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

  it('applies out of order read syncs', async () => {
    const { contacts, desktop, phone } = bootstrap;
    const [friend] = contacts;

    const page = await app.getWindow();

    debug('incoming messages');
    const timestamp1 = bootstrap.getTimestamp();
    const timestamp2 = bootstrap.getTimestamp();
    const timestamp3 = bootstrap.getTimestamp();
    await friend.sendText(desktop, '૮₍˶•⤙•˶₎ა', {
      timestamp: timestamp1,
    });
    await friend.sendText(desktop, '(੭｡╹▿╹｡)੭', {
      timestamp: timestamp2,
    });
    await friend.sendText(desktop, '<(˶ᵔᵕᵔ˶)>', {
      timestamp: timestamp3,
    });

    debug('checking left pane for unread count');
    const leftPane = page.locator('#LeftPane');

    await leftPane
      .locator(
        '.module-conversation-list__item--contact-or-conversation >> "<(˶ᵔᵕᵔ˶)>"'
      )
      .first()
      .waitFor();

    debug('checking left pane for 3 unread');
    await leftPane
      .locator(
        '.module-conversation-list__item--contact-or-conversation__unread-indicator.module-conversation-list__item--contact-or-conversation__unread-indicator--unread-messages >> "3"'
      )
      .last()
      .waitFor({ state: 'visible' });

    debug('incoming out of order messages');
    const massTimestamps = Array.from(Array(100)).map(() =>
      bootstrap.getTimestamp()
    );
    const readTimestamp = bootstrap.getTimestamp();
    const unreadTimestamp = bootstrap.getTimestamp();

    async function sendReadMessage() {
      debug('sending read message', { timestamp: readTimestamp });
      await friend.sendText(desktop, 'read marker', {
        timestamp: readTimestamp,
      });
    }

    async function sendUnreadMessage() {
      debug('sending unread message', { timestamp: unreadTimestamp });
      await friend.sendText(desktop, 'unread message', {
        timestamp: unreadTimestamp,
      });
    }

    async function sendReadSyncs(timestamps: Array<number>) {
      debug('sending read syncs', { timestamps });

      const sendOptions = {
        timestamp: bootstrap.getTimestamp(),
      };

      const longTimestamps = timestamps.map(timestamp =>
        Long.fromNumber(timestamp)
      );

      const senderAciBinary = friend.device.aciRawUuid;

      await phone.sendRaw(
        desktop,
        {
          syncMessage: {
            read: longTimestamps.map(timestamp => ({
              senderAciBinary,
              timestamp,
            })),
          },
        },
        sendOptions
      );
    }

    await sendReadSyncs([timestamp2, timestamp3]);
    await sendReadSyncs(massTimestamps);
    await Promise.all(
      massTimestamps.map(timestamp =>
        friend.sendText(desktop, String(timestamp), {
          timestamp,
        })
      )
    );
    await sendReadSyncs([readTimestamp, timestamp1]);
    await sendReadMessage();
    await sendUnreadMessage();

    debug('checking left pane for 1 unread');
    await leftPane
      .locator(
        '.module-conversation-list__item--contact-or-conversation__unread-indicator.module-conversation-list__item--contact-or-conversation__unread-indicator--unread-messages >> "1"'
      )
      .last()
      .waitFor({ state: 'visible' });

    debug('opening conversation');
    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();

    debug('checking for latest message');
    await page.locator('.module-message__text >> "unread message"').waitFor();
  });
});
