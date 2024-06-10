// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { expect } from 'playwright/test';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

describe('calling/callLinkAdmin', function (this: Mocha.Suite) {
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

  it('can create and edit a call link', async () => {
    const window = await app.getWindow();

    await window.locator('[data-testid="NavTabsItem--Calls"]').click();

    await window
      .locator('.NavSidebar__HeaderTitle')
      .getByText('Calls')
      .waitFor();

    await window
      .locator('.CallsList__ItemTile')
      .getByText('Create a Call Link')
      .click();

    const callLinkItem = window.locator('.CallsList__Item[data-type="Adhoc"]');

    const modal = window.locator('.CallLinkEditModal');
    await modal.waitFor();

    const row = modal.locator('.CallLinkEditModal__ApproveAllMembers__Row');

    await expect(row).toHaveAttribute('data-restrictions', '0');

    const select = modal.locator('select');
    await select.selectOption({ label: 'On' });
    await expect(row).toHaveAttribute('data-restrictions', '1');

    const nameInput = modal.locator('.CallLinkEditModal__Input--Name__input');
    await nameInput.fill('New Name');
    await nameInput.blur();

    await expect(callLinkItem).toContainText('New Name');
  });
});
