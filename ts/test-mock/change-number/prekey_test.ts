// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UUIDKind } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:change-number');

describe('change number', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
    app = await bootstrap.link();
  });

  afterEach(async function after() {
    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs();
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should accept sync message and update keys', async () => {
    const { server, phone, desktop, contacts } = bootstrap;

    const [first] = contacts;

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');

    debug('prepare a message for original PNI');
    const messageBefore = await first.encryptText(desktop, 'Before', {
      uuidKind: UUIDKind.PNI,
    });

    debug('preparing change number');
    const changeNumber = await phone.prepareChangeNumber();

    const newKey = await desktop.popSingleUseKey(UUIDKind.PNI);
    await first.addSingleUseKey(desktop, newKey, UUIDKind.PNI);

    debug('prepare a message for updated PNI');
    const messageAfter = await first.encryptText(desktop, 'After', {
      uuidKind: UUIDKind.PNI,
    });

    debug('sending all messages');
    await Promise.all([
      server.send(desktop, messageBefore),
      phone.sendChangeNumber(changeNumber),
      server.send(desktop, messageAfter),
    ]);

    debug('opening conversation with the first contact');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          `[title = ${JSON.stringify(first.profileName)}] ` +
          ' >> "After"'
      )
      .click();

    debug('done');
  });
});
