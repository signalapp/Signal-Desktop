// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';

import type { Locator } from 'playwright/test';
import { expect } from 'playwright/test';
import { writeFile } from 'fs/promises';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:language');

describe('language', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    // Note: We need to use the `localeOverride` config directly because you
    // cannot restart an electron app in a puppeteer test
    await writeFile(
      bootstrap.ephemeralConfigPath,
      JSON.stringify({
        localeOverride: 'ar',
      })
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

  it('renders correctly with a locale override', async () => {
    const window = await app.getWindow();

    debug('must have correct html attributes');
    await expect(window.locator(':root')).toHaveAttribute('lang', 'ar');
    await expect(window.locator(':root')).toHaveAttribute('dir', 'rtl');

    function getLeftBound(locator: Locator): Promise<number> {
      return locator.evaluate(element => {
        return element.getBoundingClientRect().left;
      });
    }

    debug('must be rendered in correct order');
    const navTabsLeft = await getLeftBound(window.locator('.NavTabs'));
    const leftPaneLeft = await getLeftBound(window.locator('#LeftPane'));
    const emptyInboxLeft = await getLeftBound(
      window.locator('.Inbox__conversation-stack')
    );

    expect(navTabsLeft).toBeGreaterThan(leftPaneLeft);
    expect(leftPaneLeft).toBeGreaterThan(emptyInboxLeft);
  });
});
