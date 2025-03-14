// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import createDebug from 'debug';
import type { Page } from 'playwright';

import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import {
  assertAppWasUsingLibsignalWebsockets,
  getLeftPane,
  setupAppToUseLibsignalWebsockets,
} from '../helpers';
import { MINUTE } from '../../util/durations';

export const debug = createDebug('mock:test:serverAlerts');

describe('serverAlerts', function (this: Mocha.Suite) {
  this.timeout(MINUTE);
  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
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
    for (const transport of ['classic', 'libsignal']) {
      // eslint-disable-next-line no-loop-func
      it(`${testCase.name}: ${transport} socket`, async () => {
        bootstrap.server.setWebsocketUpgradeResponseHeaders(testCase.headers);
        app =
          transport === 'classic'
            ? await bootstrap.link()
            : await setupAppToUseLibsignalWebsockets(bootstrap);
        const window = await app.getWindow();
        await testCase.test(window);

        if (transport === 'libsignal') {
          debug('confirming that app was actually using libsignal');
          await assertAppWasUsingLibsignalWebsockets(app);
        }
      });
    }
  }
});
