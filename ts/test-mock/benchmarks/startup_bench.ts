// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReceiptType } from '@signalapp/mock-server';
import { omit } from 'lodash';

import { debug, Bootstrap, MAX_CYCLES } from './fixtures';
import { type RegressionSample } from '../bootstrap';

const INITIAL_MESSAGE_COUNT = 1000;
const FINAL_MESSAGE_COUNT = 5000;

const ENABLE_RECEIPTS = Boolean(process.env.ENABLE_RECEIPTS);

Bootstrap.regressionBenchmark(
  async ({ bootstrap, value: messageCount }): Promise<RegressionSample> => {
    await bootstrap.linkAndClose();

    const { server, contacts, phone, desktop } = bootstrap;

    // Generate messages
    const messagePromises = new Array<Promise<Buffer>>();
    debug('started generating messages');

    for (let i = 0; i < messageCount; i += 1) {
      const contact = contacts[Math.floor(i / 2) % contacts.length];
      const direction = i % 2 ? 'message' : 'reply';

      const messageTimestamp = bootstrap.getTimestamp();

      if (direction === 'message') {
        messagePromises.push(
          contact.encryptText(
            desktop,
            `Ping from mock server ${i + 1} / ${messageCount}`,
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
                  senderAci: contact.device.aci,
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
          `Pong from mock server ${i + 1} / ${messageCount}`,
          {
            timestamp: messageTimestamp,
            destinationServiceId: contact.device.aci,
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

      const run = async () => {
        const app = await bootstrap.startApp();
        const appLoadedInfo = await app.waitUntilLoaded();

        await app.close();

        return appLoadedInfo;
      };

      const [, info] = await Promise.all([queue(), run()]);

      const { loadTime, preloadTime, connectTime } = info;
      const messagesDuration = loadTime - preloadTime - connectTime;

      return {
        messagesDuration,
        metrics: omit(info, 'messagesPerSec', 'loadTime'),
      };
    }
  },
  {
    fromValue: INITIAL_MESSAGE_COUNT,
    toValue: FINAL_MESSAGE_COUNT,
    maxCycles: MAX_CYCLES,
  }
);
