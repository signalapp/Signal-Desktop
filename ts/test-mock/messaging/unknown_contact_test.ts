// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';
import Long from 'long';
import type { Page } from 'playwright';
import assert from 'assert';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:edit');

describe('unknown contacts', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);
  this.retries(4);

  let bootstrap: Bootstrap;
  let app: App;
  let page: Page;
  let unknownContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 1, unknownContactCount: 1 });
    await bootstrap.init();
    app = await bootstrap.link();
    page = await app.getWindow();

    const { unknownContacts } = bootstrap;
    [unknownContact] = unknownContacts;
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('blocks incoming calls from unknown contacts & shows message request', async () => {
    const { desktop } = bootstrap;

    debug('sending calling offer message');
    await unknownContact.sendRaw(desktop, {
      callingMessage: {
        offer: {
          callId: new Long(Math.floor(Math.random() * 1e10)),
        },
      },
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    const conversationStack = page.locator('.Inbox__conversation-stack');
    await conversationStack.getByText('Missed voice call').waitFor();

    debug('accepting message request');
    await page.getByText('message you and share your name').waitFor();
    await page.getByRole('button', { name: 'Accept' }).click();
    assert.strictEqual(
      await page.getByText('message you and share your name').count(),
      0
    );
  });
});
