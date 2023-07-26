// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Proto } from '@signalapp/mock-server';
import { assert } from 'chai';
import createDebug from 'debug';
import Long from 'long';
import { strictAssert } from '../../util/assert';

import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { ReceiptType } from '../../types/Receipt';

export const debug = createDebug('mock:test:edit');

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

function createMessage(): Proto.IDataMessage {
  return {
    body: 'hey yhere',
    groupV2: undefined,
    timestamp: Long.fromNumber(Date.now()),
  };
}

function createEditedMessage(
  targetMessage: Proto.IDataMessage
): Proto.IEditMessage {
  strictAssert(targetMessage.timestamp, 'timestamp missing');

  return {
    targetSentTimestamp: targetMessage.timestamp,
    dataMessage: {
      body: 'hey there',
      groupV2: undefined,
      timestamp: Long.fromNumber(Date.now()),
    },
  };
}

describe('editing', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
    app = await bootstrap.link();
  });

  afterEach(async function after() {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('handles outgoing edited messages phone to desktop', async () => {
    const { phone, desktop } = bootstrap;

    const window = await app.getWindow();

    const originalMessage = createMessage();
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
    await window.locator('.module-message__text >> "hey yhere"').waitFor();

    debug('waiting for receipts for original message');
    const receipts = await app.waitForReceipts();
    assert.strictEqual(receipts.type, ReceiptType.Read);
    assert.strictEqual(receipts.timestamps.length, 1);
    assert.strictEqual(receipts.timestamps[0], originalMessageTimestamp);

    debug('sending edited message');
    const editedMessage = createEditedMessage(originalMessage);
    const editedMessageTimestamp = Number(editedMessage.dataMessage?.timestamp);
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
    await window.locator('.module-message__text >> "hey there"').waitFor();

    const messages = window.locator('.module-message__text');
    assert.strictEqual(await messages.count(), 1, 'message count');
  });

  it('handles incoming edited messages contact to desktop', async () => {
    const { contacts, desktop } = bootstrap;

    const window = await app.getWindow();

    const [friend] = contacts;

    const originalMessage = createMessage();
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
    await window.locator('.module-message__text >> "hey yhere"').waitFor();

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
    const editedMessage = createEditedMessage(originalMessage);
    const editedMessageTimestamp = Number(editedMessage.dataMessage?.timestamp);
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
    await window.locator('.module-message__text >> "hey there"').waitFor();

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

    debug('finding composition input and clicking it');
    {
      const input = await app.waitForEnabledComposer();

      debug('entering original message text');
      await input.type('edit message 1');
      await input.press('Enter');
    }

    debug('waiting for the original message from the app');
    const { dataMessage: originalMessage } = await friend.waitForMessage();
    assert.strictEqual(originalMessage.body, 'edit message 1');

    const message = window.locator(
      `.module-message[data-testid="${originalMessage.timestamp}"]`
    );
    await message.waitFor();

    debug('opening context menu');
    await message.locator('[aria-label="More actions"]').click();

    debug('starting message edit');
    await window.locator('.module-message__context__edit-message').click();

    {
      const input = await app.waitForEnabledComposer();
      await input.press('Backspace');
      await input.type('2');
      await input.press('Enter');
    }

    const { editMessage: firstEdit } = await friend.waitForEditMessage();
    assert.strictEqual(
      firstEdit.targetSentTimestamp?.toNumber(),
      originalMessage.timestamp?.toNumber()
    );
    assert.strictEqual(firstEdit.dataMessage?.body, 'edit message 2');

    debug('opening context menu again');
    const firstEditMessage = window.locator(
      `.module-message[data-testid="${firstEdit.dataMessage?.timestamp?.toNumber()}"]`
    );
    await firstEditMessage.locator('[aria-label="More actions"]').click();

    debug('starting second message edit');
    await window.locator('.module-message__context__edit-message').click();

    {
      const input = await app.waitForEnabledComposer();
      await input.press('Backspace');
      await input.type('3');
      await input.press('Enter');
    }

    const { editMessage: secondEdit } = await friend.waitForEditMessage();
    assert.strictEqual(
      secondEdit.targetSentTimestamp?.toNumber(),
      firstEdit.dataMessage?.timestamp?.toNumber()
    );
    assert.strictEqual(secondEdit.dataMessage?.body, 'edit message 3');

    debug('opening edit history');
    const secondEditMessage = window.locator(
      `.module-message[data-testid="${secondEdit.dataMessage?.timestamp?.toNumber()}"]`
    );
    await secondEditMessage
      .locator('.module-message__metadata__edited')
      .click();

    const history = await window.locator(
      '.EditHistoryMessagesModal .module-message'
    );
    assert.strictEqual(await history.count(), 3);

    assert.isTrue(await history.locator('"edit message 1"').isVisible());
    assert.isTrue(await history.locator('"edit message 2"').isVisible());
    assert.isTrue(await history.locator('"edit message 3"').isVisible());
  });
});
