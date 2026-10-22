// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { writeFile } from 'node:fs/promises';
import { assert } from 'chai';
import { strictAssert } from '../../util/assert.std.ts';
import { expect } from 'playwright/test';
import {
  typeIntoInput,
  waitForEnabledComposer,
  waitForNonProfileKeyUpdateMessage,
} from '../helpers.node.ts';
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
    // These tests locate settings using their English labels.
    await writeFile(
      bootstrap.ephemeralConfigPath,
      JSON.stringify({ localeOverride: 'en' })
    );
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

  it('persists the send-on-Enter preference and applies changes to the composer', async function () {
    this.timeout(2 * durations.MINUTE);
    const window = await app.getWindow();
    const friend = bootstrap.contacts[0];
    strictAssert(friend, 'Missing test contact');
    await friend.sendText(bootstrap.desktop, 'Hello');
    await window
      .locator(`#LeftPane [data-testid="${friend.device.aci}"]`)
      .click();
    let input = await waitForEnabledComposer(window);

    // The default preserves Enter-to-send.
    await typeIntoInput(input, 'Default send', '');
    await input.press('Enter');
    assert.strictEqual(
      (await waitForNonProfileKeyUpdateMessage(friend)).body,
      'Default send'
    );

    await window.locator('.NavTabs__ItemIcon--Settings').click();
    await window.getByRole('button', { name: 'Chats', exact: true }).click();
    const setting = window.getByRole('switch', {
      name: 'Send messages with Enter',
      exact: true,
    });
    await expect(setting).toBeChecked();
    await setting.click();
    await expect(setting).not.toBeChecked();

    // Reloading must retain the persisted setting.
    await window.reload();
    await window.locator('.NavTabs__ItemIcon--Settings').click();
    await window.getByRole('button', { name: 'Chats', exact: true }).click();
    await expect(setting).not.toBeChecked();
    await window.getByRole('tab', { name: /^Chats/ }).click();
    await window
      .locator(`#LeftPane [data-testid="${friend.device.aci}"]`)
      .click();
    input = await waitForEnabledComposer(window);
    await typeIntoInput(input, 'First line', '');
    await input.press('Enter');
    await input.pressSequentially('Second line');
    await input.press(
      process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter'
    );
    assert.strictEqual(
      (await waitForNonProfileKeyUpdateMessage(friend)).body,
      'First line\nSecond line'
    );

    await window.locator('.NavTabs__ItemIcon--Settings').click();
    await window.getByRole('button', { name: 'Chats', exact: true }).click();
    await setting.click();
    await expect(setting).toBeChecked();
    await window.getByRole('tab', { name: /^Chats/ }).click();
    await window
      .locator(`#LeftPane [data-testid="${friend.device.aci}"]`)
      .click();
    input = await waitForEnabledComposer(window);
    await typeIntoInput(input, 'Enter sends again', '');
    await input.press('Enter');
    assert.strictEqual(
      (await waitForNonProfileKeyUpdateMessage(friend)).body,
      'Enter sends again'
    );
  });
});
