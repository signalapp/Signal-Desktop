// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert';

import type { PrimaryDevice } from '@signalapp/mock-server';
import { ReceiptType } from '@signalapp/mock-server';

import { Bootstrap, debug, RUN_COUNT, DISCARD_COUNT } from './fixtures.node.ts';
import { stats } from '../../test-helpers/benchmarkStats.std.ts';
import { typeIntoInput, waitForEnabledComposer } from '../helpers.node.ts';

const CONVERSATION_SIZE = 500; // messages

const LAST_MESSAGE = 'start sending messages now';

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const app = await bootstrap.link();

  const { server, contacts, phone, desktop } = bootstrap;

  const [first] = contacts as [PrimaryDevice];

  const messages = new Array<Buffer<ArrayBuffer>>();
  debug('encrypting');
  // Note: make it so that we receive the latest message from the first
  // contact.
  for (const contact of contacts.slice().reverse()) {
    let count = 1;
    if (contact === first) {
      count = CONVERSATION_SIZE;
    }

    for (let i = 0; i < count; i += 1) {
      const messageTimestamp = bootstrap.getTimestamp();

      const isLast = i === count - 1;

      messages.push(
        // oxlint-disable-next-line no-await-in-loop
        await contact.encryptText(
          desktop,
          isLast ? LAST_MESSAGE : `#${i} from: ${contact.profileName}`,
          {
            timestamp: messageTimestamp,
            sealed: true,
          }
        )
      );
      messages.push(
        // oxlint-disable-next-line no-await-in-loop
        await phone.encryptSyncRead(desktop, {
          timestamp: bootstrap.getTimestamp(),
          messages: [
            {
              senderAci: contact.device.aci,
              timestamp: messageTimestamp,
            },
          ],
        })
      );
    }
  }

  await Promise.all(messages.map(message => server.send(desktop, message)));

  const window = await app.getWindow();

  debug('opening conversation');
  {
    const leftPane = window.locator('#LeftPane');
    const item = leftPane.locator(
      `[data-testid="${first.device.aci}"] >> text=${LAST_MESSAGE}`
    );
    await item.click();
  }

  const timeline = window.locator(
    '.timeline-wrapper, .Inbox__conversation .ConversationView'
  );

  const deltaList = new Array<number>();
  for (let runId = 0; runId < RUN_COUNT + DISCARD_COUNT; runId += 1) {
    debug('finding composition input and clicking it');
    // oxlint-disable-next-line no-await-in-loop
    const input = await waitForEnabledComposer(window);

    debug('entering message text');
    // oxlint-disable-next-line no-await-in-loop
    await typeIntoInput(input, `my message ${runId}`, '');
    // oxlint-disable-next-line no-await-in-loop
    await input.press('Enter');

    debug('waiting for message on server side');
    // oxlint-disable-next-line no-await-in-loop
    const { body, source } = await first.waitForMessage();
    assert.strictEqual(body, `my message ${runId}`);
    assert.strictEqual(source, desktop);

    debug('waiting for timing from the app');
    // oxlint-disable-next-line no-await-in-loop
    const { timestamp, delta } = await app.waitForMessageSend();

    debug('sending delivery receipt');
    // oxlint-disable-next-line no-await-in-loop
    const delivery = await first.encryptReceipt(desktop, {
      timestamp: timestamp + 1,
      messageTimestamps: [timestamp],
      type: ReceiptType.Delivery,
    });

    // oxlint-disable-next-line no-await-in-loop
    await server.send(desktop, delivery);

    debug('waiting for message state change');
    const message = timeline.locator(`[data-testid="${timestamp}"]`);
    // oxlint-disable-next-line no-await-in-loop
    await message.waitFor();

    if (runId >= DISCARD_COUNT) {
      deltaList.push(delta);
      // oxlint-disable-next-line no-console
      console.log('run=%d info=%j', runId - DISCARD_COUNT, { delta });
    } else {
      // oxlint-disable-next-line no-console
      console.log('discarded=%d info=%j', runId, { delta });
    }
  }

  // oxlint-disable-next-line no-console
  console.log('stats info=%j', { delta: stats(deltaList, [99, 99.8]) });
});
