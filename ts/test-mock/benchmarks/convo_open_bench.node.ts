// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert';
import type { PrimaryDevice } from '@signalapp/mock-server';

import { Bootstrap, debug, RUN_COUNT, DISCARD_COUNT } from './fixtures.node.ts';
import { stats } from '../../util/benchmark/stats.std.ts';
import { sleep } from '../../util/sleep.std.ts';

const CONVERSATION_SIZE = 1000; // messages
const DELAY = 50; // milliseconds
const WAIT_FOR_MESSAGES_TO_BE_PROCESSED = 5000; // milliseconds

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const app = await bootstrap.link();
  const { server, contacts, phone, desktop } = bootstrap;

  const [first, second] = contacts as [PrimaryDevice, PrimaryDevice];

  const messages = new Array<Buffer<ArrayBuffer>>();
  debug('encrypting');
  // Send messages from just two contacts
  for (const contact of [second, first]) {
    for (let i = 0; i < CONVERSATION_SIZE; i += 1) {
      const messageTimestamp = bootstrap.getTimestamp();
      messages.push(
        // oxlint-disable-next-line no-await-in-loop
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

  const sendQueue = async (): Promise<void> => {
    await Promise.all(messages.map(message => server.send(desktop, message)));
  };

  const measure = async (): Promise<void> => {
    assert(app);
    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    const openConvo = async (contact: PrimaryDevice): Promise<void> => {
      debug('opening conversation', contact.profileName);
      const item = leftPane.locator(`[data-testid="${contact.device.aci}"]`);

      await item.click();
    };

    const deltaList = new Array<number>();
    for (let runId = 0; runId < RUN_COUNT + DISCARD_COUNT; runId += 1) {
      // oxlint-disable-next-line no-await-in-loop
      await openConvo(runId % 2 === 0 ? first : second);

      debug('waiting for timing from the app');
      // oxlint-disable-next-line no-await-in-loop
      const { delta } = await app.waitForConversationOpen();

      // Let render complete
      // oxlint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, DELAY));

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
  };

  await sendQueue();
  await sleep(WAIT_FOR_MESSAGES_TO_BE_PROCESSED);
  await measure();
});
