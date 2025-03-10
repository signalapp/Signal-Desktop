// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import createDebug from 'debug';

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

  it('shows critical idle primary device alert using classic desktop socket', async () => {
    bootstrap.server.setWebsocketUpgradeResponseHeaders({
      'X-Signal-Alert': 'critical-idle-primary-device',
    });
    app = await bootstrap.link();
    const window = await app.getWindow();
    await getLeftPane(window).getByText('Open Signal on your phone').waitFor();
  });

  it('shows critical idle primary device alert using libsignal socket', async () => {
    bootstrap.server.setWebsocketUpgradeResponseHeaders({
      'X-Signal-Alert': 'critical-idle-primary-device',
    });

    app = await setupAppToUseLibsignalWebsockets(bootstrap);

    const window = await app.getWindow();
    await getLeftPane(window).getByText('Open Signal on your phone').waitFor();

    debug('confirming that app was actually using libsignal');
    await assertAppWasUsingLibsignalWebsockets(app);
  });
});
