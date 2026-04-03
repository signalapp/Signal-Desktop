// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.ts';
import { generateAci } from '../../types/ServiceId.std.ts';
import { toAciObject } from '../../util/ServiceId.node.ts';
import { MAX_READ_KEYS } from '../../services/storageConstants.std.ts';
import type { App, Bootstrap } from './fixtures.node.ts';
import { initStorage, debug } from './fixtures.node.ts';

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
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const firstContact = contacts[0]!;
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const lastContact = contacts[contacts.length - 1]!;

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    debug('wait for first contact to be pinned in the left pane');
    await leftPane
      .locator(`[data-testid="${firstContact.device.aci}"]`)
      .waitFor();

    {
      let state = await phone.expectStorageState('consistency check');

      debug('generating a lot of fake contacts');
      for (let i = 0; i < MAX_READ_KEYS + 1; i += 1) {
        state = state.addRecord({
          type: IdentifierType.CONTACT,
          record: {
            contact: {
              aciBinary: toAciObject(generateAci()).getRawUuidBytes(),
              e164: null,
              profileKey: null,
              identityKey: null,
              identityState: null,
              givenName: null,
              familyName: null,
              username: null,
              blocked: null,
              whitelisted: null,
              archived: null,
              markedUnread: null,
              mutedUntilTimestamp: null,
              hideStory: null,
              unregisteredAtTimestamp: null,
              systemGivenName: null,
              systemFamilyName: null,
              systemNickname: null,
              hidden: null,
              pniSignatureVerified: null,
              nickname: null,
              note: null,
              avatarColor: null,
              pniBinary: null,
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
      .locator(`[data-testid="${lastContact.device.aci}"]`)
      .waitFor({ timeout: durations.MINUTE });

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 2n);
  });
});
