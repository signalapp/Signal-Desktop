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

    const editModal = window.locator('.CallLinkEditModal');
    await editModal.waitFor();

    const restrictionsInput = editModal.getByLabel('Require admin approval');

    await expect(restrictionsInput).toHaveJSProperty('value', '0');
    await restrictionsInput.selectOption({ label: 'On' });
    await expect(restrictionsInput).toHaveJSProperty('value', '1');

    await editModal.locator('button', { hasText: 'Add call name' }).click();

    const addNameModal = window.locator('.CallLinkAddNameModal');
    await addNameModal.waitFor();

    const nameInput = addNameModal.getByLabel('Call name');
    await nameInput.fill('New Name');

    const saveBtn = addNameModal.getByText('Save');
    await saveBtn.click();

    await editModal.waitFor();

    const title = editModal.locator('.CallLinkEditModal__Header__Title');
    await expect(title).toContainText('New Name');
  });
});
