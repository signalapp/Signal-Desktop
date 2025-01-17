// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { assert } from 'chai';

import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { MINUTE } from '../../util/durations';

import { SIGNAL_ACI } from '../../types/SignalConversation';

export const debug = createDebug('mock:test:releaseNotes');

describe('release notes', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;
  let nextApp: App;

  this.timeout(MINUTE);
  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

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

  it('shows release notes', async () => {
    const firstWindow = await app.getWindow();

    await firstWindow.evaluate('window.SignalCI.resetReleaseNotesFetcher()');

    await app.close();

    nextApp = await bootstrap.startApp();

    const secondWindow = await nextApp.getWindow();

    const leftPane = secondWindow.locator('#LeftPane');
    const releaseNoteConversation = leftPane.getByTestId(SIGNAL_ACI);
    await releaseNoteConversation.waitFor();

    assert.isTrue(await releaseNoteConversation.isVisible());
  });
});
