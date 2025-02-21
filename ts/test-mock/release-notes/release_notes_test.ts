// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';

import { expect } from 'playwright/test';
import { assert } from 'chai';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { MINUTE } from '../../util/durations';

import { SIGNAL_ACI } from '../../types/SignalConversation';
import {
  clickOnConversationWithAci,
  getTimelineMessageWithText,
} from '../helpers';

export const debug = createDebug('mock:test:releaseNotes');

describe('release notes', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;
  let nextApp: App;

  this.timeout(MINUTE);
  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    bootstrap.server.setRemoteConfig('desktop.releaseNotes', {
      enabled: true,
    });

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    if (nextApp) {
      await bootstrap.maybeSaveLogs(this.currentTest, nextApp);
    }
    await nextApp?.close();
    await bootstrap.teardown();
  });

  it('shows release notes with an image and body ranges', async () => {
    const firstWindow = await app.getWindow();

    await app.waitForReleaseNotesFetcher();
    await firstWindow.evaluate('window.SignalCI.resetReleaseNotesFetcher()');

    await app.close();

    nextApp = await bootstrap.startApp();

    const secondWindow = await nextApp.getWindow();

    const leftPane = secondWindow.locator('#LeftPane');
    const releaseNoteConversation = leftPane.getByTestId(SIGNAL_ACI);
    await releaseNoteConversation.waitFor();

    await expect(releaseNoteConversation).toBeVisible();

    await clickOnConversationWithAci(secondWindow, SIGNAL_ACI);

    const timelineMessage = await getTimelineMessageWithText(
      secondWindow,
      'Call links'
    );

    await expect(
      timelineMessage.locator('img.module-image__image')
    ).toBeVisible();
    const boldCallBodyRange = timelineMessage
      .locator('span > strong')
      .getByText('Call', { exact: true });

    assert.isTrue(
      await boldCallBodyRange.isVisible(),
      'expected message to have bold text'
    );

    const italicBodyRange = timelineMessage
      .locator('span > em')
      .getByText('links', { exact: true });

    assert.isTrue(
      await italicBodyRange.isVisible(),
      'expected message to have italicized text'
    );

    const strikethroughBodyRange = timelineMessage
      .locator('span > s')
      .getByText('are', { exact: true });

    assert.isTrue(
      await strikethroughBodyRange.isVisible(),
      'expected message to have strikethrough text'
    );

    const spoilerBodyRange = timelineMessage
      .locator('.MessageTextRenderer__formatting--spoiler')
      .getByText('the', { exact: true });

    assert.isTrue(
      (await spoilerBodyRange.count()) > 0,
      'expected message to have spoiler text'
    );

    const monospaceBodyRange = timelineMessage
      .locator('span.MessageTextRenderer__formatting--monospace')
      .getByText('missing', { exact: true });

    assert.isTrue(
      await monospaceBodyRange.isVisible(),
      'expected message to have monospace text'
    );

    const secondTimelineMessage = await getTimelineMessageWithText(
      secondWindow,
      'Bold text has invalid ranges, italic has valid'
    );

    await expect(secondTimelineMessage).toBeVisible();

    const boldCallBodyRanges = secondTimelineMessage.locator('span > strong');

    // 1 for the title
    assert.isTrue((await boldCallBodyRanges.count()) === 1);

    const italicBodyRanges = secondTimelineMessage.locator('span > em');

    assert.isTrue(
      (await italicBodyRanges.count()) === 1,
      'expected message to have italic text'
    );
  });
});
