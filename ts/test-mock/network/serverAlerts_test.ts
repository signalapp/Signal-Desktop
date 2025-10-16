// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import createDebug from 'debug';
import type { Page } from 'playwright';
import { StorageState, type PrimaryDevice } from '@signalapp/mock-server';

import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';
import { getLeftPane } from '../helpers.node.js';
import { MINUTE } from '../../util/durations/index.std.js';

export const debug = createDebug('mock:test:serverAlerts');

describe('serverAlerts', function (this: Mocha.Suite) {
  this.timeout(MINUTE);
  let bootstrap: Bootstrap;
  let app: App;
  let pinned: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    // Set up a pinned contact to trigger profile fetch to test unauth socket
    let state = StorageState.getEmpty();
    const { phone, contacts } = bootstrap;
    [pinned] = contacts;

    state = state.addContact(pinned, {
      identityKey: pinned.publicKey.serialize(),
      profileKey: pinned.profileKey.serialize(),
      whitelisted: true,
    });

    state = state.pin(pinned);
    await phone.setStorageState(state);
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  const TEST_CASES = [
    {
      name: 'shows critical idle primary device alert',
      headers: {
        'X-Signal-Alert': 'critical-idle-primary-device',
      },
      test: async (window: Page) => {
        await getLeftPane(window)
          .getByText('Your account will be deleted soon')
          .waitFor();
      },
    },
    {
      name: 'handles different ordering of response values',
      headers: {
        'X-Signal-Alert':
          'idle-primary-device, unknown-alert, critical-idle-primary-device',
      },
      test: async (window: Page) => {
        await getLeftPane(window)
          .getByText('Your account will be deleted soon')
          .waitFor();
      },
    },
    {
      name: 'shows idle primary device warning',
      headers: {
        'X-Signal-Alert': 'idle-primary-device',
      },
      test: async (window: Page) => {
        await getLeftPane(window)
          .getByText('Open signal on your phone to keep your account active')
          .waitFor();
      },
    },
  ] as const;

  for (const testCase of TEST_CASES) {
    // eslint-disable-next-line no-loop-func
    it(`${testCase.name}`, async () => {
      bootstrap.server.setWebsocketUpgradeResponseHeaders(testCase.headers);
      app = await bootstrap.link();
      const window = await app.getWindow();

      // Trigger a profile fetch for a contact to ensure unauth websocket is used
      await window.getByTestId(pinned.device.aci).click();

      await testCase.test(window);
    });
  }
});
