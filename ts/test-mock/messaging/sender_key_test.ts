// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { StorageState } from '@signalapp/mock-server';
import type { Group } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:senderKey');

describe('senderKey', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { contacts, phone } = bootstrap;
    const [first] = contacts;

    group = await first.createGroup({
      title: 'Group',
      members: [first, phone],
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });

    state = state
      .addGroup(group, {
        whitelisted: true,
      })
      .pinGroup(group);

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('handles incoming senderKey distributions and messages', async () => {
    const { desktop, contacts } = bootstrap;
    const [first] = contacts;

    const window = await app.getWindow();

    const distributionId = await first.sendSenderKey(desktop, {
      timestamp: bootstrap.getTimestamp(),
    });

    await first.sendText(desktop, 'hello', {
      timestamp: bootstrap.getTimestamp(),
      sealed: true,
      group,
      distributionId,
    });

    const leftPane = window.locator('#LeftPane');

    debug('Opening group');
    await leftPane.locator(`[data-testid="${group.id}"]`).click();

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('Verifying message');
    await conversationStack
      .locator('.module-message--incoming >> "hello"')
      .waitFor();
  });
});
