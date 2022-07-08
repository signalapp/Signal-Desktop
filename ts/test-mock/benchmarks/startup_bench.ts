// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop, no-console */

import { ReceiptType } from '@signalapp/mock-server';

import { debug, Bootstrap, stats, RUN_COUNT } from './fixtures';

const MESSAGE_BATCH_SIZE = 1000; // messages

const ENABLE_RECEIPTS = Boolean(process.env.ENABLE_RECEIPTS);

(async () => {
  const bootstrap = new Bootstrap({
    benchmark: true,
  });

  await bootstrap.init();
  await bootstrap.linkAndClose();

  try {
    const { server, contacts, phone, desktop } = bootstrap;

    const messagesPerSec = new Array<number>();

    for (let runId = 0; runId < RUN_COUNT; runId += 1) {
      // Generate messages
      const messagePromises = new Array<Promise<Buffer>>();
      debug('started generating messages');

      for (let i = 0; i < MESSAGE_BATCH_SIZE; i += 1) {
        const contact = contacts[Math.floor(i / 2) % contacts.length];
        const direction = i % 2 ? 'message' : 'reply';

        const messageTimestamp = bootstrap.getTimestamp();

        if (direction === 'message') {
          messagePromises.push(
            contact.encryptText(
              desktop,
              `Ping from mock server ${i + 1} / ${MESSAGE_BATCH_SIZE}`,
              {
                timestamp: messageTimestamp,
                sealed: true,
              }
            )
          );

          if (ENABLE_RECEIPTS) {
            messagePromises.push(
              phone.encryptSyncRead(desktop, {
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
          continue;
        }

        messagePromises.push(
          phone.encryptSyncSent(
            desktop,
            `Pong from mock server ${i + 1} / ${MESSAGE_BATCH_SIZE}`,
            {
              timestamp: messageTimestamp,
              destinationUUID: contact.device.uuid,
            }
          )
        );

        if (ENABLE_RECEIPTS) {
          messagePromises.push(
            contact.encryptReceipt(desktop, {
              timestamp: bootstrap.getTimestamp(),
              messageTimestamps: [messageTimestamp],
              type: ReceiptType.Delivery,
            })
          );
          messagePromises.push(
            contact.encryptReceipt(desktop, {
              timestamp: bootstrap.getTimestamp(),
              messageTimestamps: [messageTimestamp],
              type: ReceiptType.Read,
            })
          );
        }
      }

      debug('ended generating messages');

      const messages = await Promise.all(messagePromises);

      // Open the flood gates
      {
        debug('got synced, sending messages');

        // Queue all messages
        const queue = async (): Promise<void> => {
          await Promise.all(
            messages.map(message => {
              return server.send(desktop, message);
            })
          );
        };

        const run = async (): Promise<void> => {
          const app = await bootstrap.startApp();
          const appLoadedInfo = await app.waitUntilLoaded();

          console.log('run=%d info=%j', runId, appLoadedInfo);

          messagesPerSec.push(appLoadedInfo.messagesPerSec);

          await app.close();
        };

        await Promise.all([queue(), run()]);
      }
    }

    // Compute human-readable statistics
    if (messagesPerSec.length !== 0) {
      console.log('stats info=%j', { messagesPerSec: stats(messagesPerSec) });
    }
  } catch (error) {
    await bootstrap.saveLogs();
    throw error;
  } finally {
    await bootstrap.teardown();
  }
})();
