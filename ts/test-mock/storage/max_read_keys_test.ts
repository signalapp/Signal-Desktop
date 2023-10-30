// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import { generateAci } from '../../types/ServiceId';
import { MAX_READ_KEYS } from '../../services/storageConstants';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should receive all contacts despite low read keys limit', async () => {
    debug('prepare for a slow test');

    const { phone, contacts } = bootstrap;
    const firstContact = contacts[0];
    const lastContact = contacts[contacts.length - 1];

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    debug('wait for first contact to be pinned in the left pane');
    await leftPane
      .locator(`[data-testid="${firstContact.toContact().aci}"]`)
      .waitFor();

    {
      let state = await phone.expectStorageState('consistency check');

      debug('generating a lot of fake contacts');
      for (let i = 0; i < MAX_READ_KEYS + 1; i += 1) {
        state = state.addRecord({
          type: IdentifierType.CONTACT,
          record: {
            contact: {
              aci: generateAci(),
            },
          },
        });
      }

      debug('pinning last contact');
      state = state.pin(lastContact);

      await phone.setStorageState(state);

      debug('sending fetch storage');
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });
    }

    debug('wait for last contact to be pinned in the left pane');
    await leftPane
      .locator(`[data-testid="${lastContact.toContact().aci}"]`)
      .waitFor({ timeout: durations.MINUTE });

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 2);
  });
});
