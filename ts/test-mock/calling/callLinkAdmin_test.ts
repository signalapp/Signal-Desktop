// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { expect } from 'playwright/test';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { createCallLink } from '../helpers';

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

    {
      const name = 'New Name';
      await createCallLink(window, { name });

      const title = await window
        .locator('.CallsList__ItemTile')
        .getByText(name);

      await expect(title).toContainText(name);
    }

    {
      const name = 'Public call link';
      await createCallLink(window, {
        name,
        isAdminApprovalRequired: false,
      });

      const callLinkItem = await window.getByText(name);
      await callLinkItem.click();

      const callLinkDetails = window.locator(
        '.CallsTab__ConversationCallDetails'
      );
      await callLinkDetails.waitFor();

      const restrictionsSelect = await window.locator(
        '.CallLinkRestrictionsSelect select'
      );
      await expect(restrictionsSelect).toHaveJSProperty('value', '0');
    }

    {
      const name = 'Restricted call link';
      await createCallLink(window, {
        name,
        isAdminApprovalRequired: true,
      });

      const callLinkItem = await window.getByText(name);
      await callLinkItem.click();

      const callLinkDetails = window.locator(
        '.CallsTab__ConversationCallDetails'
      );
      await callLinkDetails.waitFor();

      const restrictionsSelect = await window.locator(
        '.CallLinkRestrictionsSelect select'
      );
      await expect(restrictionsSelect).toHaveJSProperty('value', '1');
    }
  });
});
