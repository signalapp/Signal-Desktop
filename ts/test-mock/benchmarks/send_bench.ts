// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop, no-console */

import assert from 'assert';

import { ReceiptType } from '@signalapp/mock-server';

import { Bootstrap, debug, RUN_COUNT, DISCARD_COUNT } from './fixtures';
import { stats } from '../../util/benchmark/stats';
import { typeIntoInput, waitForEnabledComposer } from '../helpers';

const CONVERSATION_SIZE = 500; // messages

const LAST_MESSAGE = 'start sending messages now';

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const app = await bootstrap.link();

  const { server, contacts, phone, desktop } = bootstrap;

  const [first] = contacts;

  const messages = new Array<Buffer>();
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
      `[data-testid="${first.toContact().aci}"] >> text=${LAST_MESSAGE}`
    );
    await item.click();
  }

  const timeline = window.locator(
    '.timeline-wrapper, .Inbox__conversation .ConversationView'
  );

  debug('accepting conversation');
  await window.getByRole('button', { name: 'Continue' }).click();

  const { dataMessage: profileKeyMsg } = await first.waitForMessage();
  assert(profileKeyMsg.profileKey != null, 'Profile key message');

  const deltaList = new Array<number>();
  for (let runId = 0; runId < RUN_COUNT + DISCARD_COUNT; runId += 1) {
    debug('finding composition input and clicking it');
    const input = await waitForEnabledComposer(window);

    debug('entering message text');
    await typeIntoInput(input, `my message ${runId}`);
    await input.press('Enter');

    debug('waiting for message on server side');
    const { body, source } = await first.waitForMessage();
    assert.strictEqual(body, `my message ${runId}`);
    assert.strictEqual(source, desktop);

    debug('waiting for timing from the app');
    const { timestamp, delta } = await app.waitForMessageSend();

    debug('sending delivery receipt');
    const delivery = await first.encryptReceipt(desktop, {
      timestamp: timestamp + 1,
      messageTimestamps: [timestamp],
      type: ReceiptType.Delivery,
    });

    await server.send(desktop, delivery);

    debug('waiting for message state change');
    const message = timeline.locator(`[data-testid="${timestamp}"]`);
    await message.waitFor();

    if (runId >= DISCARD_COUNT) {
      deltaList.push(delta);
      console.log('run=%d info=%j', runId - DISCARD_COUNT, { delta });
    } else {
      console.log('discarded=%d info=%j', runId, { delta });
    }
  }

  console.log('stats info=%j', { delta: stats(deltaList, [99, 99.8]) });
});
