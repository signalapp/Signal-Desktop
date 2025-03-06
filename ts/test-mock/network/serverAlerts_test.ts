// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import createDebug from 'debug';

import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { getLeftPane } from '../helpers';
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

  it('shows idle primary device alert', async () => {
    bootstrap.server.setWebsocketUpgradeResponseHeaders({
      'X-Signal-Alert': 'critical-idle-primary-device',
    });
    app = await bootstrap.link();
    const window = await app.getWindow();
    await getLeftPane(window).getByText('Open Signal on your phone').waitFor();
  });
});
