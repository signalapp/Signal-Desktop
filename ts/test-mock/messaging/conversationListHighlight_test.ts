// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { expect } from 'playwright/test';

import { Bootstrap } from '../bootstrap';
import type { App } from '../playwright';
import * as durations from '../../util/durations';
import { strictAssert } from '../../util/assert';

describe('conversation list highlighting', function (this: Mocha.Suite) {
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

  it('highlights only on hover', async () => {
    const { contacts, desktop } = bootstrap;
    const [friend] = contacts;

    await friend.sendText(desktop, 'hi');

    const page = await app.getWindow();
    const leftPane = page.locator('#LeftPane');
    const item = leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first();

    await item.waitFor();

    const defaultBg = await item.evaluate(
      el => getComputedStyle(el).backgroundColor
    );

    await item.hover();
    const hoverBg = await item.evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    expect(hoverBg).not.toBe(defaultBg);

    await page.mouse.move(0, 0);
    const afterHoverBg = await item.evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    expect(afterHoverBg).toBe(defaultBg);
  });

  it('does not stay highlighted after drag', async () => {
    const { contacts, desktop } = bootstrap;
    const [friend] = contacts;

    await friend.sendText(desktop, 'hi');

    const page = await app.getWindow();
    const leftPane = page.locator('#LeftPane');
    const item = leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first();

    await item.waitFor();

    const defaultBg = await item.evaluate(
      el => getComputedStyle(el).backgroundColor
    );

    const box = await item.boundingBox();
    strictAssert(box, 'Bounding box not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 40);
    await page.mouse.up();
    await page.mouse.move(0, 0);

    const afterDragBg = await item.evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    expect(afterDragBg).toBe(defaultBg);

    const isActive = await item.evaluate(el => document.activeElement === el);
    expect(isActive).toBe(false);
  });
});
