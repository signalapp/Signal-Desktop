// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Proto } from '@signalapp/mock-server';
import { assert } from 'chai';
import createDebug from 'debug';
import Long from 'long';
import type { Page } from 'playwright';

import type { App } from '../playwright';
import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import { RECEIPT_BATCHER_WAIT_MS, ReceiptType } from '../../types/Receipt';
import { SendStatus } from '../../messages/MessageSendState';
import { drop } from '../../util/drop';
import { strictAssert } from '../../util/assert';
import { generateAci } from '../../types/ServiceId';
import { IMAGE_GIF } from '../../types/MIME';
import { typeIntoInput, waitForEnabledComposer } from '../helpers';
import type { MessageAttributesType } from '../../model-types';
import { sleep } from '../../util/sleep';

export const debug = createDebug('mock:test:edit');

const ACI_1 = generateAci();
const UNPROCESSED_ATTACHMENT: Proto.IAttachmentPointer = {
  cdnId: Long.fromNumber(123),
  key: new Uint8Array([1, 2, 3]),
  digest: new Uint8Array([4, 5, 6]),
  contentType: IMAGE_GIF,
  size: 34,
};

function wrap({
  dataMessage,
  editMessage,
}: {
  dataMessage?: Proto.IDataMessage;
  editMessage?: Proto.IEditMessage;
}): Proto.IContent {
  return {
    dataMessage,
    editMessage,
  };
}

function createMessage(body: string): Proto.IDataMessage {
  return {
    body,
    groupV2: undefined,
    timestamp: Long.fromNumber(Date.now()),
  };
}

function createMessageWithQuote(body: string): Proto.IDataMessage {
  return {
    body,
    quote: {
      id: Long.fromNumber(1),
      authorAci: ACI_1,
      text: 'text',
      attachments: [
        {
          contentType: 'image/jpeg',
          fileName: 'image.jpg',
          thumbnail: UNPROCESSED_ATTACHMENT,
        },
      ],
    },
    groupV2: undefined,
    timestamp: Long.fromNumber(Date.now()),
  };
}

function createEditedMessage(
  targetSentTimestamp: Long | null | undefined,
  body: string,
  timestamp = Date.now()
): Proto.IEditMessage {
  strictAssert(targetSentTimestamp, 'timestamp missing');

  return {
    targetSentTimestamp,
    dataMessage: {
      body,
      groupV2: undefined,
      timestamp: Long.fromNumber(timestamp),
    },
  };
}

describe('editing', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  async function sendEditedMessage(
    page: Page,
    timestamp: number,
    additionalText: string
  ) {
    await page
      .getByTestId(`${timestamp}`)
      .locator('.module-message__buttons__menu')
      .click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const input = await waitForEnabledComposer(page);
    await typeIntoInput(input, additionalText);
    await input.press('Enter');
  }

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  describe('online', function (this: Mocha.Suite) {
    beforeEach(async () => {
      app = await bootstrap.link();
    });

    it('handles incoming edited messages phone to desktop', async () => {
      const { phone, desktop } = bootstrap;

      const window = await app.getWindow();

      const initialMessageBody = 'hey yhere';
      const originalMessage = createMessage(initialMessageBody);
      const originalMessageTimestamp = Number(originalMessage.timestamp);

      debug('sending message');
      {
        const sendOptions = {
          timestamp: originalMessageTimestamp,
        };
        await phone.sendRaw(
          desktop,
          wrap({ dataMessage: originalMessage }),
          sendOptions
        );
      }

      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for message');
      await window
        .locator(`.module-message__text >> "${initialMessageBody}"`)
        .waitFor();

      debug('waiting for outgoing receipts for original message');
      const receipts = await app.waitForReceipts();
      assert.strictEqual(receipts.type, ReceiptType.Read);
      assert.strictEqual(receipts.timestamps.length, 1);
      assert.strictEqual(receipts.timestamps[0], originalMessageTimestamp);

      debug('sending edited message');
      const editedMessageBody = 'hey there';
      const editedMessage = createEditedMessage(
        originalMessage.timestamp,
        editedMessageBody
      );
      const editedMessageTimestamp = Number(
        editedMessage.dataMessage?.timestamp
      );
      {
        const sendOptions = {
          timestamp: editedMessageTimestamp,
        };
        await phone.sendRaw(
          desktop,
          wrap({ editMessage: editedMessage }),
          sendOptions
        );
      }

      debug('checking for edited message');
      await window
        .locator(`.module-message__text >> "${editedMessageBody}"`)
        .waitFor();

      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');
    });

    it('handles incoming edited messages contact to desktop', async () => {
      const { contacts, desktop } = bootstrap;

      const window = await app.getWindow();

      const [friend] = contacts;

      const initialMessageBody = 'hey yhere';
      const originalMessage = createMessage(initialMessageBody);
      const originalMessageTimestamp = Number(originalMessage.timestamp);

      debug('incoming message');
      {
        const sendOptions = {
          timestamp: originalMessageTimestamp,
        };
        await friend.sendRaw(
          desktop,
          wrap({ dataMessage: originalMessage }),
          sendOptions
        );
      }

      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for message');
      await window
        .locator(`.module-message__text >> "${initialMessageBody}"`)
        .waitFor();

      debug('waiting for original receipt');
      const originalReceipt = await friend.waitForReceipt();
      {
        const { receiptMessage } = originalReceipt;
        strictAssert(receiptMessage.timestamp, 'receipt has a timestamp');
        assert.strictEqual(receiptMessage.type, Proto.ReceiptMessage.Type.READ);
        assert.strictEqual(receiptMessage.timestamp.length, 1);
        assert.strictEqual(
          Number(receiptMessage.timestamp[0]),
          originalMessageTimestamp
        );
      }

      debug('sending edited message');
      const editedMessageBody = 'hey there';
      const editedMessage = createEditedMessage(
        originalMessage.timestamp,
        editedMessageBody
      );
      const editedMessageTimestamp = Number(
        editedMessage.dataMessage?.timestamp
      );
      {
        const sendOptions = {
          timestamp: editedMessageTimestamp,
        };
        await friend.sendRaw(
          desktop,
          wrap({ editMessage: editedMessage }),
          sendOptions
        );
      }

      debug('checking for edited message');
      await window
        .locator(`.module-message__text >> "${editedMessageBody}"`)
        .waitFor();

      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');

      debug('waiting for receipt for edited message');
      const editedReceipt = await friend.waitForReceipt();
      {
        const { receiptMessage } = editedReceipt;
        strictAssert(receiptMessage.timestamp, 'receipt has a timestamp');
        assert.strictEqual(receiptMessage.type, Proto.ReceiptMessage.Type.READ);
        assert.strictEqual(receiptMessage.timestamp.length, 1);
        assert.strictEqual(
          Number(receiptMessage.timestamp[0]),
          editedMessageTimestamp
        );
      }
    });

    it('sends edited messages with correct timestamps', async () => {
      const { contacts, desktop } = bootstrap;

      const window = await app.getWindow();

      const [friend] = contacts;

      debug('incoming message');
      await friend.sendText(desktop, 'hello', {
        timestamp: bootstrap.getTimestamp(),
      });

      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for message');
      await window.locator('.module-message__text >> "hello"').waitFor();

      debug('accepting conversation');
      await window.getByRole('button', { name: 'Continue' }).click();

      const { dataMessage: profileKeyMsg } = await friend.waitForMessage();
      assert(profileKeyMsg.profileKey != null, 'Profile key message');

      debug('finding composition input and clicking it');
      {
        const input = await waitForEnabledComposer(window);

        debug('entering original message text');
        await typeIntoInput(input, 'edit message 1');
        await input.press('Enter');
      }

      debug('waiting for the original message from the app');
      const { dataMessage: originalMessage } = await friend.waitForMessage();
      assert.strictEqual(originalMessage.body, 'edit message 1');

      await sendEditedMessage(
        window,
        originalMessage.timestamp?.toNumber() ?? 0,
        '.2'
      );

      debug("waiting for friend's edit message");
      const { editMessage: firstEdit } = await friend.waitForEditMessage();
      assert.strictEqual(
        firstEdit.targetSentTimestamp?.toNumber(),
        originalMessage.timestamp?.toNumber()
      );
      assert.strictEqual(firstEdit.dataMessage?.body, 'edit message 1.2');

      await sendEditedMessage(
        window,
        originalMessage.timestamp?.toNumber() ?? 0,
        '.3'
      );

      const { editMessage: secondEdit } = await friend.waitForEditMessage();
      assert.strictEqual(
        secondEdit.targetSentTimestamp?.toNumber(),
        firstEdit.dataMessage?.timestamp?.toNumber()
      );
      assert.strictEqual(secondEdit.dataMessage?.body, 'edit message 1.2.3');

      debug('opening edit history');
      const secondEditMessage = window.locator(
        `.module-message[data-testid="${originalMessage?.timestamp?.toNumber()}"]`
      );
      await secondEditMessage
        .locator('.module-message__metadata__edited')
        .click();

      const history = await window.locator(
        '.EditHistoryMessagesModal .module-message'
      );
      assert.strictEqual(await history.count(), 3);

      assert.isTrue(await history.locator('"edit message 1"').isVisible());
      assert.isTrue(await history.locator('"edit message 1.2"').isVisible());
      assert.isTrue(await history.locator('"edit message 1.2.3"').isVisible());
    });

    it('is fine with out of order edit processing', async () => {
      const { phone, desktop } = bootstrap;

      const window = await app.getWindow();

      const originalMessage = createMessage('v1');
      const originalMessageTimestamp = Number(originalMessage.timestamp);

      const sendOriginalMessage = async () => {
        debug('sending original message', originalMessageTimestamp);
        const sendOptions = {
          timestamp: originalMessageTimestamp,
        };
        await phone.sendRaw(
          desktop,
          wrap({ dataMessage: originalMessage }),
          sendOptions
        );
      };

      debug('sending all messages + edits');
      let targetSentTimestamp = originalMessage.timestamp;
      let editTimestamp = Date.now() + 1;
      const editedMessages: Array<Proto.IEditMessage> = [
        'v2',
        'v3',
        'v4',
        'v5',
      ].map(body => {
        const message = createEditedMessage(
          targetSentTimestamp,
          body,
          editTimestamp
        );
        targetSentTimestamp = Long.fromNumber(editTimestamp);
        editTimestamp += 1;
        return message;
      });
      {
        const sendEditMessages = editedMessages.map(editMessage => {
          const timestamp = Number(editMessage.dataMessage?.timestamp);
          const sendOptions = {
            timestamp,
          };
          return () => {
            debug(
              `sending edit timestamp=${timestamp}, target=${editMessage.targetSentTimestamp}`
            );

            return phone.sendRaw(desktop, wrap({ editMessage }), sendOptions);
          };
        });
        await Promise.all(sendEditMessages.reverse().map(f => f()));
        await sendOriginalMessage();
      }

      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for latest message');
      await window.locator('.module-message__text >> "v5"').waitFor();

      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');
    });

    it('is fine with out of order edits with quotes removed', async () => {
      const { phone, desktop } = bootstrap;

      const originalMessage = createMessageWithQuote('v1');
      const originalMessageTimestamp = Number(originalMessage.timestamp);

      debug('sending edit');
      const targetSentTimestamp = originalMessage.timestamp;
      const editTimestamp = Date.now() + 1;
      const editMessage: Proto.IEditMessage = createEditedMessage(
        targetSentTimestamp,
        'v2',
        editTimestamp
      );
      const timestamp = Number(editMessage.dataMessage?.timestamp);
      drop(phone.sendRaw(desktop, wrap({ editMessage }), { timestamp }));

      debug('sending original message', originalMessageTimestamp);
      const sendOptions = {
        timestamp: originalMessageTimestamp,
      };
      drop(
        phone.sendRaw(
          desktop,
          wrap({ dataMessage: originalMessage }),
          sendOptions
        )
      );

      const window = await app.getWindow();

      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for latest message');
      await window.locator('.module-message__text >> "v2"').waitFor();
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');
      const quotes = window.locator('.module-quote');
      assert.strictEqual(await quotes.count(), 0, 'quote count');
    });

    it('tracks message send state for edits', async () => {
      async function getMessageFromApp(
        originalMessageTimestamp: number
      ): Promise<MessageAttributesType> {
        await sleep(RECEIPT_BATCHER_WAIT_MS + 20);
        const messages = await page.evaluate(
          timestamp => window.SignalCI?.getMessagesBySentAt(timestamp),
          originalMessageTimestamp
        );
        strictAssert(messages, 'messages does not exist');
        strictAssert(messages.length === 1, 'message does not exist');

        return messages[0];
      }

      const { contacts, desktop } = bootstrap;

      const [friend] = contacts;
      const contact = friend.toContact();

      const page = await app.getWindow();

      debug('message sent friend -> desktop');
      await friend.sendText(desktop, 'hello', {
        timestamp: bootstrap.getTimestamp(),
      });

      debug('opening conversation');
      const leftPane = page.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await page.locator('.module-conversation-hero').waitFor();

      debug('accepting conversation');
      await page.getByRole('button', { name: 'Continue' }).click();

      const { dataMessage: profileKeyMsg } = await friend.waitForMessage();
      assert(profileKeyMsg.profileKey != null, 'Profile key message');

      // Sending the original message
      // getting a read receipt
      // testing the message's send state
      const originalText = '1';
      debug('finding composition input and clicking it');
      {
        const input = await waitForEnabledComposer(page);

        debug('sending message desktop -> friend');
        await typeIntoInput(input, originalText);
        await input.press('Enter');
      }

      debug("waiting for message on friend's device");
      const { dataMessage: originalMessage } = await friend.waitForMessage();
      assert.strictEqual(
        originalMessage.body,
        originalText,
        'original message is correct'
      );
      strictAssert(originalMessage.timestamp, 'timestamp missing');

      const originalMessageTimestamp = Number(originalMessage.timestamp);
      debug('original message', { timestamp: originalMessageTimestamp });

      debug("getting friend's conversationId");
      const conversationId = await page.evaluate(
        serviceId => window.SignalCI?.getConversationId(serviceId),
        contact.aci
      );
      debug(`got friend's conversationId: ${conversationId}`);
      strictAssert(conversationId, 'conversationId exists');

      {
        const deliveryReceiptTimestamp = bootstrap.getTimestamp();
        debug(
          'sending delivery receipt for original message friend -> desktop',
          {
            target: originalMessageTimestamp,
            timestamp: deliveryReceiptTimestamp,
          }
        );
        const deliveryReceiptSendOptions = {
          timestamp: deliveryReceiptTimestamp,
        };
        await friend.sendRaw(
          desktop,
          {
            receiptMessage: {
              type: Proto.ReceiptMessage.Type.DELIVERY,
              timestamp: [originalMessage.timestamp],
            },
          },
          deliveryReceiptSendOptions
        );
      }

      debug("testing message's send state (original)");
      {
        debug('getting message from app (original)');
        const message = await getMessageFromApp(originalMessageTimestamp);

        strictAssert(
          message.sendStateByConversationId,
          'sendStateByConversationId'
        );
        assert.strictEqual(
          message.sendStateByConversationId[conversationId].status,
          SendStatus.Delivered,
          'send state is delivered for main message'
        );
        assert.isUndefined(message.editHistory, 'no edit history, yet');
      }

      // Sending a v2 edited message targetting the original
      const editMessageV2Text = '12';
      debug('finding composition input and clicking it v2');

      debug('sending edit message v2 desktop -> friend');
      await sendEditedMessage(page, originalMessageTimestamp, '2');

      {
        const readReceiptTimestamp = bootstrap.getTimestamp();
        debug('sending read receipt for original message friend -> desktop', {
          target: originalMessageTimestamp,
          timestamp: readReceiptTimestamp,
        });
        const readReceiptSendOptions = {
          timestamp: readReceiptTimestamp,
        };
        await friend.sendRaw(
          desktop,
          {
            receiptMessage: {
              type: Proto.ReceiptMessage.Type.READ,
              timestamp: [originalMessage.timestamp],
            },
          },
          readReceiptSendOptions
        );
      }

      debug("testing message's send state (current(v2) and original (v1))");
      {
        const message = await getMessageFromApp(originalMessageTimestamp);
        strictAssert(message.editHistory, 'edit history exists');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_v2, v1] = message.editHistory;
        assert.strictEqual(
          message.sendStateByConversationId?.[conversationId].status,
          SendStatus.Sent,
          'send state is reverted back to sent for main message'
        );
        assert.strictEqual(
          v1.sendStateByConversationId?.[conversationId].status,
          SendStatus.Read,
          'original message is marked read'
        );
      }

      debug("waiting for message on friend's device (original)");
      const { editMessage: editMessageV2 } = await friend.waitForEditMessage();
      assert.strictEqual(editMessageV2.dataMessage?.body, editMessageV2Text);
      debug('v2 message', {
        timestamp: Number(editMessageV2.dataMessage?.timestamp),
      });

      // Sending a v3 edited message targetting v2
      // v3 will be read after we receive v4
      const editMessageV3Text = '123';
      debug('sending edit message v3 desktop -> friend');
      await sendEditedMessage(
        page,
        originalMessage?.timestamp?.toNumber() ?? 0,
        '3'
      );

      debug("waiting for message on friend's device (v3)");
      const { editMessage: editMessageV3 } = await friend.waitForEditMessage();
      assert.strictEqual(editMessageV3.dataMessage?.body, editMessageV3Text);
      strictAssert(editMessageV3.dataMessage?.timestamp, 'timestamp missing');

      const editMessageV3Timestamp = Number(
        editMessageV3.dataMessage.timestamp
      );
      debug('v3 message', { timestamp: editMessageV3Timestamp });

      // Sending a v4 edited message targetting v3
      // getting a read receipt for v3
      // testing send state of the full message
      const editMessageV4Text = '1234';
      debug('sending edit message v4 desktop -> friend');
      await sendEditedMessage(
        page,
        originalMessage?.timestamp?.toNumber() ?? 0,
        '4'
      );

      debug("waiting for message on friend's device (v4)");
      const { editMessage: editMessageV4 } = await friend.waitForEditMessage();
      assert.strictEqual(editMessageV4.dataMessage?.body, editMessageV4Text);
      strictAssert(editMessageV4.dataMessage?.timestamp, 'timestamp missing');

      const editMessageV4Timestamp = Number(
        editMessageV4.dataMessage.timestamp
      );
      debug('v4 message', { timestamp: editMessageV4Timestamp });

      {
        const readReceiptTimestamp = bootstrap.getTimestamp();
        debug('sending read receipt for edit v3 friend -> desktop', {
          target: editMessageV3Timestamp,
          timestamp: readReceiptTimestamp,
        });
        const readReceiptSendOptions = {
          timestamp: readReceiptTimestamp,
        };
        await friend.sendRaw(
          desktop,
          {
            receiptMessage: {
              type: 1,
              timestamp: [editMessageV3.dataMessage.timestamp],
            },
          },
          readReceiptSendOptions
        );
      }

      debug("testing v4's send state");
      {
        debug('getting edited message from app (v4)');
        const message = await getMessageFromApp(originalMessageTimestamp);

        strictAssert(
          message.sendStateByConversationId,
          'sendStateByConversationId'
        );
        assert.strictEqual(
          message.sendStateByConversationId[conversationId].status,
          SendStatus.Sent,
          'original message send state is sent (v4)'
        );

        strictAssert(message.editHistory, 'edit history exists');
        const [v4, v3, v2, v1] = message.editHistory;

        strictAssert(v1.sendStateByConversationId, 'v1 has send state');
        assert.strictEqual(
          v1.sendStateByConversationId[conversationId].status,
          SendStatus.Read,
          'send state for first message is read'
        );

        strictAssert(v2.sendStateByConversationId, 'v2 has send state');
        assert.strictEqual(
          v2.sendStateByConversationId[conversationId].status,
          SendStatus.Sent,
          'send state for v2 message is sent'
        );

        strictAssert(v3.sendStateByConversationId, 'v3 has send state');
        assert.strictEqual(
          v3.sendStateByConversationId[conversationId].status,
          SendStatus.Read,
          'send state for v3 message is read'
        );

        strictAssert(v4.sendStateByConversationId, 'v4 has send state');
        assert.strictEqual(
          v4.sendStateByConversationId[conversationId].status,
          SendStatus.Sent,
          'send state for v4 message is sent'
        );

        assert.strictEqual(
          v4.body,
          message.body,
          'body is same for v4 and main message'
        );
      }
    });
  });

  describe('offline', function (this: Mocha.Suite) {
    beforeEach(async () => {
      await bootstrap.linkAndClose();
    });

    it('is fine with out of order edits with quotes removed', async () => {
      const { phone, desktop } = bootstrap;

      const originalMessage = createMessageWithQuote('v1');
      const originalMessageTimestamp = Number(originalMessage.timestamp);

      debug('sending edit');
      const targetSentTimestamp = originalMessage.timestamp;
      const editTimestamp = Date.now() + 1;
      const editMessage: Proto.IEditMessage = createEditedMessage(
        targetSentTimestamp,
        'v2',
        editTimestamp
      );
      const timestamp = Number(editMessage.dataMessage?.timestamp);
      drop(phone.sendRaw(desktop, wrap({ editMessage }), { timestamp }));

      debug('sending original message', originalMessageTimestamp);
      const sendOptions = {
        timestamp: originalMessageTimestamp,
      };
      drop(
        phone.sendRaw(
          desktop,
          wrap({ dataMessage: originalMessage }),
          sendOptions
        )
      );

      app = await bootstrap.startApp();
      const window = await app.getWindow();

      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for latest message');
      await window.locator('.module-message__text >> "v2"').waitFor();
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');
      const quotes = window.locator('.module-quote');
      assert.strictEqual(await quotes.count(), 0, 'quote count');
    });

    it('is fine with out of order edit processing', async () => {
      const { phone, desktop } = bootstrap;

      const originalMessage = createMessage('v1');
      const originalMessageTimestamp = Number(originalMessage.timestamp);

      const sendOriginalMessage = async () => {
        debug('sending original message', originalMessageTimestamp);
        const sendOptions = {
          timestamp: originalMessageTimestamp,
        };
        await phone.sendRaw(
          desktop,
          wrap({ dataMessage: originalMessage }),
          sendOptions
        );
      };

      debug('sending all messages + edits');
      let targetSentTimestamp = originalMessage.timestamp;
      let editTimestamp = Date.now() + 1;
      const editedMessages: Array<Proto.IEditMessage> = [
        'v2',
        'v3',
        'v4',
        'v5',
      ].map(body => {
        const message = createEditedMessage(
          targetSentTimestamp,
          body,
          editTimestamp
        );
        targetSentTimestamp = Long.fromNumber(editTimestamp);
        editTimestamp += 1;
        return message;
      });
      {
        const sendEditMessages = editedMessages.map(editMessage => {
          const timestamp = Number(editMessage.dataMessage?.timestamp);
          const sendOptions = {
            timestamp,
          };
          return () => {
            debug(
              `sending edit timestamp=${timestamp}, target=${editMessage.targetSentTimestamp}`
            );

            return phone.sendRaw(desktop, wrap({ editMessage }), sendOptions);
          };
        });
        drop(Promise.all(sendEditMessages.reverse().map(f => f())));
        drop(sendOriginalMessage());
      }

      app = await bootstrap.startApp();
      const window = await app.getWindow();
      debug('opening conversation');
      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator('.module-conversation-list__item--contact-or-conversation')
        .first()
        .click();
      await window.locator('.module-conversation-hero').waitFor();

      debug('checking for latest message');
      await window.locator('.module-message__text >> "v5"').waitFor();

      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');
    });
  });
});
