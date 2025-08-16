// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { runTurnInContainer, tearDownTurnContainer } from './helpers';

describe('callMessages', function callMessages(this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap1: Bootstrap;
  let bootstrap2: Bootstrap;
  let app1: App;
  let app2: App;

  beforeEach(async () => {
    runTurnInContainer();

    bootstrap1 = new Bootstrap();
    await bootstrap1.init();

    bootstrap2 = new Bootstrap({ server: bootstrap1.server });
    await bootstrap2.init();

    let state1 = StorageState.getEmpty();
    state1 = state1.updateAccount({
      profileKey: bootstrap1.phone.profileKey.serialize(),
    });

    state1 = state1.addContact(bootstrap2.phone, {
      whitelisted: true,
      profileKey: bootstrap2.phone.profileKey.serialize(),
      givenName: 'Contact2',
    });

    state1 = state1.pin(bootstrap2.phone);

    await bootstrap1.phone.setStorageState(state1);

    app1 = await bootstrap1.link();

    let state2 = StorageState.getEmpty();
    state2 = state2.updateAccount({
      profileKey: bootstrap2.phone.profileKey.serialize(),
    });

    state2 = state2.addContact(bootstrap1.phone, {
      whitelisted: true,
      profileKey: bootstrap1.phone.profileKey.serialize(),
      givenName: 'Contact1',
    });

    state2 = state2.pin(bootstrap1.phone);
    await bootstrap2.phone.setStorageState(state2);

    app2 = await bootstrap2.link();
  });

  afterEach(async function after(this: Mocha.Context) {
    tearDownTurnContainer();

    if (!bootstrap1) {
      return;
    }
    await bootstrap1.maybeSaveLogs(this.currentTest, app1);
    await bootstrap2.maybeSaveLogs(this.currentTest, app2);

    await app2.close();
    await app1.close();

    await bootstrap2.teardown();
    await bootstrap1.teardown();
  });

  it('can call and decline a call', async () => {
    const window1 = await app1.getWindow();
    const leftPane1 = window1.locator('#LeftPane');

    await leftPane1
      .locator(`[data-testid="${bootstrap2.phone.device.aci}"]`)
      .click();
    // Try to start a call
    await window1.locator('.module-ConversationHeader__button--audio').click();
    const window1Permissions = await app1.waitForWindow();
    await window1Permissions.getByText('Allow Access').click();
    await window1
      .locator('.CallingLobbyJoinButton')
      .and(window1.locator('button:visible'))
      .click();

    const window2 = await app2.getWindow();

    // Only wait for 3 seconds to make sure that this succeeded properly rather
    // than timing out after ~10 seconds and using a direct connection
    await window2
      .locator('.IncomingCallBar__button--decline')
      .click({ timeout: 3000 });

    await expect(
      window1.locator('.module-calling__modal-container')
    ).toBeEmpty();

    await expect(
      window2.locator('.module-calling__modal-container')
    ).toBeEmpty();
  });
});
