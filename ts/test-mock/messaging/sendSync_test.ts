// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import Long from 'long';
import { StorageState } from '@signalapp/mock-server';

import type { App } from '../playwright';
import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:sendSync');

describe('sendSync', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
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

  it('processes a send sync in a group', async () => {
    const { contacts, desktop, phone } = bootstrap;

    const window = await app.getWindow();

    const members = contacts.slice(4);

    const group = await phone.createGroup({
      title: 'Mock Group',
      members: [phone, ...members],
    });

    await phone.setStorageState(
      StorageState.getEmpty()
        .addGroup(group, { whitelisted: true })
        .pinGroup(group)
    );

    debug('Send a group sync sent message from phone');
    const messageBody = 'Hi everybody!';
    const timestamp = bootstrap.getTimestamp();
    const originalDataMessage = {
      body: messageBody,
      timestamp: Long.fromNumber(timestamp),
      groupV2: {
        masterKey: group.masterKey,
        revision: group.revision,
      },
    };
    const content = {
      syncMessage: {
        sent: {
          timestamp: Long.fromNumber(timestamp),
          message: originalDataMessage,
          unidentifiedStatus: members.map(member => ({
            destinationServiceId: member.device.aci,
            destination: member.device.number,
          })),
        },
      },
    };
    const sendOptions = {
      timestamp,
    };
    await phone.sendRaw(desktop, content, sendOptions);

    debug('opening conversation');
    const leftPane = window.locator('#LeftPane');

    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();

    debug('checking for latest message');
    await window.locator(`.module-message__text >> "${messageBody}"`).waitFor();
  });
});
