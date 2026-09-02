// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../../util/durations/index.std.ts';
import type { App } from '../playwright.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';

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
    await window.getByRole('listitem', { name: 'Device Name' }).waitFor();

    await window.getByRole('button', { name: 'Appearance' }).click();
    await window.getByRole('listitem', { name: 'Language' }).waitFor();

    await window.getByRole('button', { name: 'Chats' }).click();
    await window.getByRole('listitem', { name: 'Spell check text' }).waitFor();

    await window.getByRole('button', { name: 'Calls' }).click();
    await window
      .getByRole('listitem', { name: 'Enable incoming calls' })
      .waitFor();

    await window.getByRole('button', { name: 'Notifications' }).click();
    await window
      .getByRole('listitem', { name: 'Enable notifications' })
      .waitFor();

    await window.getByRole('button', { name: 'Privacy' }).click();
    await window
      .getByRole('listitem', { name: 'Read receipts', exact: true })
      .waitFor();

    await window.getByRole('button', { name: 'Data usage' }).click();
    await window
      .getByRole('listitem', { name: 'Sent media quality' })
      .waitFor();
  });
});
