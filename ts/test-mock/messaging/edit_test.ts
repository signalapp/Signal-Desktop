// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Proto } from '@signalapp/mock-server';
import { assert } from 'chai';
import createDebug from 'debug';
import Long from 'long';
import { strictAssert } from '../../util/assert';

import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

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

    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs(app);
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should edit a message', async () => {
    const { phone, desktop } = bootstrap;

    const window = await app.getWindow();

    const originalMessage = createMessage();

    debug('sending message');
    {
      const sendOptions = {
        timestamp: Number(originalMessage.timestamp),
      };
      await phone.sendRaw(
        desktop,
        wrap({ dataMessage: originalMessage }),
        sendOptions
      );
    }

    debug('opening conversation');
    const leftPane = window.locator('.left-pane-wrapper');
    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();
    await window.locator('.module-conversation-hero').waitFor();

    debug('checking for message');
    await window.locator('.module-message__text >> "hey yhere"').waitFor();

    debug('sending edited message');
    {
      const editedMessage = createEditedMessage(originalMessage);
      const sendOptions = {
        timestamp: Number(editedMessage.dataMessage?.timestamp),
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
});
