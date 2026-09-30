// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { assert } from 'chai';

import type { PrimaryDevice } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.ts';
import { getRandomBytes } from '../../Crypto.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { isNotEmpty } from '../../Bytes.std.ts';

import type { App, StandaloneLinkData } from '../bootstrap.node.ts';

export const debug = createDebug('mock:test:standalone:reencrypt');

describe('standalone/reencrypt', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let standaloneLinkData: StandaloneLinkData | undefined;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init({ isStandalone: true });

    app = await bootstrap.prepareForStandaloneRegistration();
    standaloneLinkData = await bootstrap.doStandaloneRegistration({
      app,
      e164: '+14155551111',
      verificationCode: '111111',
      pin: '123456',
    });

    const { contacts, server } = bootstrap;
    const { aci, storageKey, recordIkm } = standaloneLinkData;

    const firstState = await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
    });

    const [firstContact, secondContact] = contacts as [
      PrimaryDevice,
      PrimaryDevice,
    ];
    let secondState = firstState.addContact(firstContact, {
      identityState: Proto.ContactRecord.IdentityState.VERIFIED,
      whitelisted: true,

      identityKey: firstContact.publicKey.serialize(),
      profileKey: firstContact.profileKey.serialize(),
      givenName: firstContact.profileName,
    });
    secondState = secondState.addContact(secondContact, {
      identityState: Proto.ContactRecord.IdentityState.VERIFIED,
      whitelisted: true,

      identityKey: secondContact.publicKey.serialize(),
      profileKey: secondContact.profileKey.serialize(),
      givenName: secondContact.profileName,
    });

    secondState = secondState.pin(firstContact);

    await server.setStorageState({
      aci,
      state: secondState,
      previousState: firstState,
      storageKey,
      recordIkm,
    });

    await app.fetchManifestForPrimary();

    const window = await app.getWindow();
    {
      debug('verify firstContact is now pinned');

      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator(`[data-testid="${firstContact.device.aci}"]`)
        .waitFor();
    }
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it(`reencrypts on failed decrypt of storage service when primary`, async () => {
    const { server, contacts } = bootstrap;

    strictAssert(standaloneLinkData, 'Need basics in place!');
    const { aci, storageKey, recordIkm } = standaloneLinkData;

    debug('First, update storage service on server with bad key');

    const existingState = await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
    });

    const stateForEncryptionUpdate = existingState.updateAccount({
      givenName: 'Cannot decypt!',
    });

    const badStorageKey = Buffer.from(getRandomBytes(32));
    const badRecordIkm = Buffer.from(getRandomBytes(32));

    await server.setStorageState({
      aci,
      state: stateForEncryptionUpdate,
      storageKey: badStorageKey,
      recordIkm: badRecordIkm,
    });

    debug('Tell app to fetch the latest manifest');

    await app.fetchManifestForPrimary();

    debug('Wait for desktop to upload with a fixed key');

    const expectedVersion = stateForEncryptionUpdate.version + 2n;
    const {
      version: newVersion,
      storageKey: newStorageKey,
      recordIkm: newRecordIkm,
    } = await app.waitForUploadManifest(expectedVersion);

    debug('Check details of the upload');

    assert.strictEqual(BigInt(newVersion), expectedVersion);
    assert.deepEqual(newStorageKey, storageKey, 'Storage key should match!');
    assert.isTrue(isNotEmpty(newRecordIkm), 'newRecordIkm should be present');
    assert.notDeepEqual(
      newRecordIkm,
      badRecordIkm,
      'newRecordIkm should not be the badRecordIkm'
    );

    const finalState = await server.waitForStorageState({
      aci,
      after: stateForEncryptionUpdate,
      storageKey,
      recordIkm: newRecordIkm,
    });

    debug('Ensure firstContact is in storage service');

    const [firstContact] = contacts as [PrimaryDevice];

    assert.isTrue(
      finalState.hasRecord(
        item => item.record.contact?.givenName === firstContact.profileName
      ),
      'looking for contact record that matches givenName'
    );
  });
});
