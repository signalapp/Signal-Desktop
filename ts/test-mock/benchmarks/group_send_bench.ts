// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop, no-console */

import assert from 'assert';

import {
  StorageState,
  EnvelopeType,
  ReceiptType,
} from '@signalapp/mock-server';

import {
  Bootstrap,
  debug,
  RUN_COUNT,
  GROUP_SIZE,
  CONVERSATION_SIZE,
  DISCARD_COUNT,
  GROUP_DELIVERY_RECEIPTS,
} from './fixtures';
import { stats } from '../../util/benchmark/stats';
import { sleep } from '../../util/sleep';
import { typeIntoInput } from '../helpers';

const LAST_MESSAGE = 'start sending messages now';

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const { contacts, phone } = bootstrap;

  const members = [...contacts].slice(0, GROUP_SIZE);

  const GROUP_NAME = 'Mock Group';
  const group = await phone.createGroup({
    title: GROUP_NAME,
    members: [phone, ...members],
  });

  await phone.setStorageState(
    StorageState.getEmpty()
      .addGroup(group, { whitelisted: true })
      .pinGroup(group)
  );

  const app = await bootstrap.link();

  const { server, desktop } = bootstrap;
  const [first] = members;

  const messages = new Array<Buffer>();
  debug('encrypting');
  // Fill left pane
  for (const contact of members.slice(0, CONVERSATION_SIZE).reverse()) {
    const messageTimestamp = bootstrap.getTimestamp();

    messages.push(
      await contact.encryptText(desktop, `hello from: ${contact.profileName}`, {
        timestamp: messageTimestamp,
        sealed: true,
      })
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
            senderAci: contact.device.aci,
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
    const leftPane = window.locator('#LeftPane');

    const item = leftPane
      .locator(
        '.module-conversation-list__item--contact-or-conversation' +
          `>> text="${GROUP_NAME}"`
      )
      .first();
    await item.click();
  }

  debug('finding message in timeline');
  {
    const item = window
      .locator(`.module-message >> text="${LAST_MESSAGE}"`)
      .first();
    await item.click();
  }

  const deltaList = new Array<number>();
  const input = await app.waitForEnabledComposer();

  function sendReceiptsInBatches({
    receipts,
    batchSize,
    nextBatchSize,
    runId,
    delay,
  }: {
    receipts: Array<Buffer>;
    batchSize: number;
    nextBatchSize: number;
    runId: number;
    delay: number;
  }) {
    const receiptsToSend = receipts.splice(0, batchSize);
    debug(`sending ${receiptsToSend.length} receipts for runId ${runId}`);

    receiptsToSend.forEach(delivery => server.send(desktop, delivery));

    if (receipts.length) {
      setTimeout(
        () =>
          sendReceiptsInBatches({
            receipts,
            batchSize: nextBatchSize,
            nextBatchSize,
            runId,
            delay,
          }),
        delay
      );
    }
  }

  let receiptsFromPreviousMessage: Array<Buffer> = [];
  for (let runId = 0; runId < RUN_COUNT + DISCARD_COUNT; runId += 1) {
    debug(`sending previous ${receiptsFromPreviousMessage.length} receipts`);

    // deliver up to 256 receipts at once (max that server will send) and then in chunks
    // of 30 every 200ms to approximate real behavior as we acknowledge each batch
    sendReceiptsInBatches({
      receipts: receiptsFromPreviousMessage,
      batchSize: 256,
      nextBatchSize: 30,
      delay: 100,
      runId,
    });

    debug('entering message text');
    await typeIntoInput(input, `my message ${runId}`);
    await input.press('Enter');

    debug('waiting for message on server side');
    const { body, source, envelopeType } = await first.waitForMessage();
    assert.strictEqual(body, `my message ${runId}`);
    assert.strictEqual(source, desktop);
    assert.strictEqual(envelopeType, EnvelopeType.SenderKey);

    debug('waiting for timing from the app');
    const { timestamp, delta } = await app.waitForMessageSend();

    if (GROUP_DELIVERY_RECEIPTS > 1) {
      // Sleep to allow any receipts from previous rounds to be processed
      await sleep(1000);
    }

    debug('sending delivery receipts');
    receiptsFromPreviousMessage = await Promise.all(
      members.slice(0, GROUP_DELIVERY_RECEIPTS).map(member =>
        member.encryptReceipt(desktop, {
          timestamp: timestamp + 1,
          messageTimestamps: [timestamp],
          type: ReceiptType.Delivery,
        })
      )
    );

    if (runId >= DISCARD_COUNT) {
      deltaList.push(delta);
      console.log('run=%d info=%j', runId - DISCARD_COUNT, { delta });
    } else {
      console.log('discarded=%d info=%j', runId, { delta });
    }
  }

  console.log('stats info=%j', { delta: stats(deltaList, [99, 99.8]) });
});
