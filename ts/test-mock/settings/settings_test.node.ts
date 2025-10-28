// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';

import * as durations from '../../util/durations/index.std.js';
import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';

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

  it('settings tab and all panes load when opened', async () => {
    const window = await app.getWindow();

    await window.locator('.NavTabs__ItemIcon--Settings').click();
    await window.getByRole('heading', { name: 'Settings' }).waitFor();

    await window.getByRole('button', { name: 'General' }).click();
    await window.getByText('Device Name').waitFor();

    await window.getByRole('button', { name: 'Appearance' }).click();
    await window.getByText('Language').first().waitFor();

    await window.getByRole('button', { name: 'Chats' }).click();
    await window.getByText('Spell check text').waitFor();

    await window.getByRole('button', { name: 'Calls' }).click();
    await window.getByText('Enable incoming calls').waitFor();

    await window.getByRole('button', { name: 'Notifications' }).click();
    await window.getByText('Notification content').waitFor();

    await window.getByRole('button', { name: 'Privacy' }).click();
    await window.getByText('Read receipts').waitFor();

    await window.getByRole('button', { name: 'Data usage' }).click();
    await window.getByText('Sent media quality').waitFor();
  });
});
