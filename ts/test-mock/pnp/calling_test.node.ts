// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { type PrimaryDevice, ServiceIdKind } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations/index.std.js';
import { Bootstrap } from '../bootstrap.node.js';
import type { App } from '../bootstrap.node.js';
import { acceptConversation } from '../helpers.node.js';

chai.use(chaiAsPromised);

export const debug = createDebug('mock:test:pnp:calling');

describe('pnp/calling', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let alice: PrimaryDevice;
  let stranger: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { server } = bootstrap;

    alice = await server.createPrimaryDevice({
      profileName: 'Alice',
    });
    stranger = await server.createPrimaryDevice({
      profileName: 'Stranger',
    });

    app = await bootstrap.link();

    const { desktop } = bootstrap;

    const ourPniKey = await desktop.popSingleUseKey(ServiceIdKind.PNI);
    await stranger.addSingleUseKey(desktop, ourPniKey, ServiceIdKind.PNI);

    const ourAciKey = await desktop.popSingleUseKey(ServiceIdKind.ACI);
    await alice.addSingleUseKey(desktop, ourAciKey, ServiceIdKind.ACI);
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should ignore calling message received on PNI', async () => {
    const { desktop } = bootstrap;

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    debug('Sending a calling message from stranger to PNI');
    await stranger.sendRaw(
      desktop,
      {
        callMessage: {
          offer: {
            opaque: new Uint8Array(1),
          },
        },
      },
      {
        timestamp: bootstrap.getTimestamp(),
        serviceIdKind: ServiceIdKind.PNI,
      }
    );

    debug('Sending a message from a known contact');
    await alice.sendText(desktop, 'hey', {
      withProfileKey: true,
    });

    debug('Open conversation with a known contact');
    await leftPane.locator(`[data-testid="${alice.device.aci}"]`).click();

    debug('Accept conversation from a known contact');
    await acceptConversation(window);

    debug('Wait for a message from a known contact');
    await alice.waitForMessage();

    debug('Verify no session with stranger');
    await assert.isRejected(
      stranger.sendText(desktop, 'Hello on ACI'),
      /session with.*not found/
    );
  });
});
