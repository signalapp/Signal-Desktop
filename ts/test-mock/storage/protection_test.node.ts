// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { PrivateKey } from '@signalapp/libsignal-client';

import * as durations from '../../util/durations/index.std.ts';
import { initStorage } from './fixtures.node.ts';
import { debug } from './fixtures.node.ts';
import { getRandomBytes } from '../../Crypto.node.ts';
import { isNotEmpty, toBase64 } from '../../Bytes.std.ts';

import type { Bootstrap } from './fixtures.node.ts';
import type { App } from './fixtures.node.ts';
import { fromAciUuidBytes } from '../../util/ServiceId.node.ts';

describe('storage service/protection', function (this: Mocha.Suite) {
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

  it('should not take contact fields from storage service', async () => {
    const { phone, contacts } = bootstrap;

    const alice = contacts[0];
    assert.exists(alice, 'first contact');

    let state = await phone.expectStorageState('initial state');

    debug(`waitng for desktop to pick up manifest version ${state.version}`);
    await app.waitForManifestVersion(state.version);

    debug('updating contact record in storage service via phone');
    const newIdentityKey = PrivateKey.generate().getPublicKey().serialize();
    const newProfileKey = getRandomBytes(32);
    const newGivenName = 'Alice, updated';

    state = state.updateContact(alice, {
      identityKey: newIdentityKey,
      profileKey: newProfileKey,
      givenName: newGivenName,
    });
    state = state.pin(alice);

    const updatedState = await phone.setStorageState(state);
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    debug(
      `waiting for Desktop to pick up manifest version ${updatedState.version}`
    );
    await app.waitForManifestVersion(updatedState.version);

    const window = await app.getWindow();
    const conversationStack = window.locator('.Inbox__conversation-stack');

    const leftPane = window.locator('#LeftPane');

    debug('verifying that contact is pinned');
    await leftPane.locator(`[data-testid="${alice.device.aci}"]`).waitFor();

    debug('unpinning via desktop');
    {
      const convo = leftPane.getByTestId(alice.device.aci);
      await convo.click();

      const moreButton = conversationStack.getByRole('button', {
        name: 'More Info',
      });
      await moreButton.click();

      const pinButton = window.getByRole('menuitem', {
        name: 'Unpin chat',
        exact: true,
      });
      await pinButton.click();
    }

    debug("waiting for desktop's storage service update to get back to phone");

    const newState = await phone.waitForStorageState({
      after: updatedState,
      predicate: maybeState => !maybeState.isPinned(alice),
    });

    debug(
      "validating what's in storage service - alice should have original data"
    );

    const aliceIdentityKey = (await alice.device.getIdentityKey()).serialize();

    assert.isTrue(
      newState.hasRecord(item => {
        const contactRecord = item.record.contact;
        if (!isNotEmpty(contactRecord?.aciBinary)) {
          return false;
        }

        const aci = fromAciUuidBytes(contactRecord.aciBinary);
        if (aci !== alice.device.aci) {
          return false;
        }

        assert.strictEqual(
          contactRecord.identityKey ? toBase64(contactRecord.identityKey) : '',
          toBase64(aliceIdentityKey),
          'identityKey'
        );

        assert.strictEqual(
          contactRecord.profileKey ? toBase64(contactRecord.profileKey) : '',
          toBase64(alice.profileKey.serialize()),
          'profileKey'
        );
        assert.strictEqual(
          contactRecord.givenName,
          alice.profileName,
          'profileName'
        );

        return true;
      }),
      'verifying data on alice record'
    );
  });
});
