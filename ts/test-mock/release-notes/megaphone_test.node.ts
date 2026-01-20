// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';

import { expect } from 'playwright/test';
import { StorageState } from '@signalapp/mock-server';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup.js';
import Long from 'long';

import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';
import { MINUTE } from '../../util/durations/index.std.js';

export const debug = createDebug('mock:test:megaphone');

describe('megaphone', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;
  let nextApp: App;

  this.timeout(MINUTE);

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    let state = StorageState.getEmpty();

    const { phone } = bootstrap;

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      readReceipts: true,
      hasCompletedUsernameOnboarding: true,
      backupTier: Long.fromNumber(BackupLevel.Free),
    });

    await phone.setStorageState(state);

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

  it('shows megaphone', async () => {
    const firstWindow = await app.getWindow();

    await app.waitForReleaseNoteAndMegaphoneFetcher();
    await firstWindow.evaluate(
      'window.SignalCI.resetReleaseNoteAndMegaphoneFetcher()'
    );

    await app.close();

    nextApp = await bootstrap.startApp();

    const secondWindow = await nextApp.getWindow();

    debug('waiting for megaphone');
    const megaphoneEl = secondWindow.getByTestId('RemoteMegaphone');
    await megaphoneEl.waitFor();

    await expect(megaphoneEl.locator('text=/Donate Today/')).toBeVisible();
    await expect(megaphoneEl.locator('img')).toBeVisible();
    await expect(
      megaphoneEl.getByText('Donate', { exact: true })
    ).toBeVisible();
    await expect(megaphoneEl.locator('text=/Not now/')).toBeVisible();
  });
});
