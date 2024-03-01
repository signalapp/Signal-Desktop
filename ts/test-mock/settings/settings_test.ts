// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';

import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:settings');

describe('settings', function (this: Mocha.Suite) {
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

  it('settings window and all panes load when opened', async () => {
    const window = await app.getWindow();

    const newPagePromise = window.context().waitForEvent('page');
    await window.locator('.NavTabs__ItemIcon--Settings').click();
    const settingsWindow = await newPagePromise;
    await settingsWindow.getByText('Device Name').waitFor();

    await settingsWindow.getByText('Appearance').click();
    await settingsWindow.getByText('Language').first().waitFor();

    await settingsWindow.getByText('Chats').click();
    await settingsWindow.getByText('Sent media quality').waitFor();

    await settingsWindow.getByText('Calls').click();
    await settingsWindow.getByText('Enable incoming calls').waitFor();

    await settingsWindow.getByText('Notifications').click();
    await settingsWindow.getByText('Notification content').waitFor();

    await settingsWindow.getByText('Privacy').click();
    await settingsWindow.getByText('Read receipts').waitFor();
  });
});
