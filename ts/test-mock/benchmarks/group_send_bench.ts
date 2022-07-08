// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop, no-console */

import assert from 'assert';

import {
  StorageState,
  EnvelopeType,
  ReceiptType,
} from '@signalapp/mock-server';

import type { App } from './fixtures';
import {
  Bootstrap,
  debug,
  stats,
  RUN_COUNT,
  GROUP_SIZE,
  DISCARD_COUNT,
} from './fixtures';

const CONVERSATION_SIZE = 500; // messages
const LAST_MESSAGE = 'start sending messages now';

(async () => {
  const bootstrap = new Bootstrap({
    benchmark: true,
  });

  await bootstrap.init();

  const { contacts, phone } = bootstrap;

  const members = [...contacts].slice(0, GROUP_SIZE);

  const group = await phone.createGroup({
    title: 'Mock Group',
    members: [phone, ...members],
  });

  await phone.setStorageState(
    StorageState.getEmpty()
      .addGroup(group, { whitelisted: true })
      .pinGroup(group)
  );

  let app: App | undefined;

  try {
    app = await bootstrap.link();

    const { server, desktop } = bootstrap;
    const [first] = members;

    const messages = new Array<Buffer>();
    debug('encrypting');
    // Fill left pane
    for (const contact of members.slice().reverse()) {
      const messageTimestamp = bootstrap.getTimestamp();

      messages.push(
        await contact.encryptText(
          desktop,
          `hello from: ${contact.profileName}`,
          {
            timestamp: messageTimestamp,
            sealed: true,
          }
        )
      );
      messages.push(
        await phone.encryptSyncRead(desktop, {
          timestamp: bootstrap.getTimestamp(),
          messages: [
            {
              senderUUID: contact.device.uuid,
              timestamp: messageTimestamp,
            },
          ],
        })
      );
    }

    // Fill group
    for (let i = 0; i < CONVERSATION_SIZE; i += 1) {
      const contact = members[i % members.length];
      const messageTimestamp = bootstrap.getTimestamp();

      const isLast = i === CONVERSATION_SIZE - 1;

      messages.push(
        await contact.encryptText(
          desktop,
          isLast ? LAST_MESSAGE : `#${i} from: ${contact.profileName}`,
          {
            timestamp: messageTimestamp,
            sealed: true,
            group,
          }
        )
      );
      messages.push(
        await phone.encryptSyncRead(desktop, {
          timestamp: bootstrap.getTimestamp(),
          messages: [
            {
              senderUUID: contact.device.uuid,
              timestamp: messageTimestamp,
            },
          ],
        })
      );
    }
    debug('encrypted');

    await Promise.all(messages.map(message => server.send(desktop, message)));

    const window = await app.getWindow();

    debug('opening conversation');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      const item = leftPane.locator(
        '_react=BaseConversationListItem' +
          `[title = ${JSON.stringify(group.title)}]` +
          `>> ${JSON.stringify(LAST_MESSAGE)}`
      );
      await item.click();
    }

    const timeline = window.locator(
      '.timeline-wrapper, .ConversationView__template .react-wrapper'
    );

    const deltaList = new Array<number>();
    for (let runId = 0; runId < RUN_COUNT + DISCARD_COUNT; runId += 1) {
      debug('finding composition input and clicking it');
      const composeArea = window.locator(
        '.composition-area-wrapper, ' +
          '.ConversationView__template .react-wrapper'
      );

      const input = composeArea.locator('_react=CompositionInput');

      debug('entering message text');
      await input.type(`my message ${runId}`);
      await input.press('Enter');

      debug('waiting for message on server side');
      const { body, source, envelopeType } = await first.waitForMessage();
      assert.strictEqual(body, `my message ${runId}`);
      assert.strictEqual(source, desktop);
      assert.strictEqual(envelopeType, EnvelopeType.SenderKey);

      debug('waiting for timing from the app');
      const { timestamp, delta } = await app.waitForMessageSend();

      debug('sending delivery receipts');
      const delivery = await first.encryptReceipt(desktop, {
        timestamp: timestamp + 1,
        messageTimestamps: [timestamp],
        type: ReceiptType.Delivery,
      });

      await server.send(desktop, delivery);

      debug('waiting for message state change');
      const message = timeline.locator(
        `_react=Message[timestamp = ${timestamp}][status = "delivered"]`
      );
      await message.waitFor();

      if (runId >= DISCARD_COUNT) {
        deltaList.push(delta);
        console.log('run=%d info=%j', runId - DISCARD_COUNT, { delta });
      } else {
        console.log('discarded=%d info=%j', runId, { delta });
      }
    }

    console.log('stats info=%j', { delta: stats(deltaList, [99, 99.8]) });
  } catch (error) {
    await bootstrap.saveLogs();
    throw error;
  } finally {
    await app?.close();
    await bootstrap.teardown();
  }
})();
