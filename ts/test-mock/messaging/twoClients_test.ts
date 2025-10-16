// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { StorageState } from '@signalapp/mock-server';
import * as durations from '../../util/durations/index.std.js';
import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';
import { typeIntoInput, waitForEnabledComposer } from '../helpers.node.js';

describe('twoClients', function twoClients(this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap1: Bootstrap;
  let bootstrap2: Bootstrap;
  let app1: App;
  let app2: App;

  beforeEach(async () => {
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

  it('can send a message from one client to another', async () => {
    const window1 = await app1.getWindow();
    const leftPane1 = window1.locator('#LeftPane');

    await leftPane1
      .locator(`[data-testid="${bootstrap2.phone.device.aci}"]`)
      .click();
    const window2 = await app2.getWindow();

    const messageBody = 'Hello world';
    const compositionInput = await waitForEnabledComposer(window1);
    await typeIntoInput(compositionInput, messageBody, '');
    await compositionInput.press('Enter');

    const leftPane = window2.locator('#LeftPane');
    await leftPane
      .locator(`[data-testid="${bootstrap1.phone.device.aci}"]`)
      .click();

    await window2
      .locator(`.module-message__text >> "${messageBody}"`)
      .waitFor();
  });
});
