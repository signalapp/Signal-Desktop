// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { assert } from 'chai';
import {
  ClientZkGroupCipher,
  GroupSecretParams,
  ProfileKey,
  ProfileKeyCiphertext,
} from '@signalapp/libsignal-client/zkgroup';
import { Group } from '@signalapp/mock-server';

import type { PrimaryDevice } from '@signalapp/mock-server';

import { Bootstrap } from '../bootstrap.node.ts';
import * as durations from '../../util/durations/index.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { areEqual } from '../../Bytes.std.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { toServiceIdObject } from '../../util/ServiceId.node.ts';

import type { App, StandaloneLinkData } from '../bootstrap.node.ts';
import type { AciString } from '../../types/ServiceId.std.ts';

export const debug = createDebug('mock:test:standalone:reencrypt');

describe('standalone/rotate-profile', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let standaloneLinkData: StandaloneLinkData | undefined;

  let groupA: Group;
  let groupB: Group;

  async function createGroup({
    title,
    members: memberDevices,
    ourAci,
    ourProfileKey,
  }: {
    title: string;
    members: Array<PrimaryDevice>;
    ourAci: AciString;
    ourProfileKey: ProfileKey;
  }): Promise<Group> {
    const { server } = bootstrap;
    const groupParams = GroupSecretParams.generate();

    const members = await Promise.all(
      memberDevices.map(async member => {
        const { profileKey } = member;
        const { aci, profileKeyCommitment } = member.device;

        const presentation = await server.getProfileKeyPresentation({
          aci,
          profileKey,
          profileKeyCommitment,
          groupParams,
        });

        return {
          aci: member.device.aci,
          profileKey: member.profileKey,
          presentation,
          joinedAtVersion: 0n,
        };
      })
    );

    const presentation = await server.getProfileKeyPresentation({
      aci: ourAci,
      profileKey: ourProfileKey,
      profileKeyCommitment: undefined,
      groupParams,
    });
    members.push({
      aci: ourAci,
      profileKey: ourProfileKey,
      presentation,
      joinedAtVersion: 0n,
    });

    const clientGroup = Group.fromConfig({
      secretParams: groupParams,

      title,
      members,
    });

    await server.createGroup(clientGroup.state);

    return clientGroup;
  }

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
    const { aci, profileKey, recordIkm, storageKey } = standaloneLinkData;

    const firstState = await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
      predicate: () => true,
    });

    const [firstContact, secondContact] = contacts as [
      PrimaryDevice,
      PrimaryDevice,
    ];

    groupA = await createGroup({
      ourAci: aci,
      ourProfileKey: new ProfileKey(profileKey),
      title: 'groupWithFirstContactAndMe',
      members: [firstContact],
    });
    groupB = await createGroup({
      ourAci: aci,
      ourProfileKey: new ProfileKey(profileKey),
      title: 'groupWithJustMe',
      members: [],
    });

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

    secondState = secondState.addGroup(groupA, { whitelisted: true });
    secondState = secondState.addGroup(groupB, { whitelisted: true });

    secondState = secondState.pin(firstContact);
    secondState = secondState.pin(secondContact);

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

  it(`rotates profileKey and all groups when blocking contact`, async () => {
    const { server, contacts } = bootstrap;

    strictAssert(standaloneLinkData, 'Need basics in place!');
    const { aci, profileKey, storageKey, recordIkm } = standaloneLinkData;

    const [firstContact, secondContact] = contacts as [
      PrimaryDevice,
      PrimaryDevice,
    ];

    debug('Block first contact, which is in shared groups');

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');
    await leftPane
      .locator(`[data-testid="${firstContact.device.aci}"]`)
      .click();

    await window.getByRole('button', { name: 'More Info' }).click();
    await window.getByRole('menuitem', { name: 'Block' }).click();
    await window.getByRole('button', { name: 'Block' }).click();

    debug('Wait for storage service update with the block');

    await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
      predicate: state => {
        return (
          state.getContact(firstContact)?.blocked === true &&
          areEqual(state.getAccountRecord()?.profileKey, profileKey)
        );
      },
    });

    debug('Block second contact, NOT in any shared groups');

    await leftPane
      .locator(`[data-testid="${secondContact.device.aci}"]`)
      .click();

    await window.getByRole('button', { name: 'More Info' }).click();
    await window.getByRole('menuitem', { name: 'Block' }).click();
    await window.getByRole('button', { name: 'Block' }).click();

    debug('Wait for new profileKey');

    const { profileKey: newProfileKey, reason } =
      await app.waitForSetProfileKey();

    assert.strictEqual(
      reason,
      'rotateProfileKey',
      'Expect to get profileKey from profile key rotation'
    );

    debug('Wait for storage service update with new block and new profileKey');

    await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
      predicate: state => {
        return (
          state.getContact(secondContact)?.blocked === true &&
          areEqual(state.getAccountRecord()?.profileKey, newProfileKey)
        );
      },
    });

    debug('Wait for updates to all groups with new profiles');

    await app.waitForUpdateGroupsWithNewProfileKey();

    debug('Check group A');

    const groupALocal = await server.getGroup(groupA.publicParams.serialize());
    const clientZkA = new ClientZkGroupCipher(groupA.secretParams);
    const ourUuidCiphertextA = clientZkA.encryptServiceId(
      toServiceIdObject(aci)
    );
    const ourMemberA = groupALocal?.getMember(ourUuidCiphertextA);

    strictAssert(ourMemberA, 'should find our own member in group A');
    strictAssert(
      ourMemberA?.profileKey,
      'our member in group A should have a profile key'
    );
    const ourProfileAPlaintext = clientZkA.decryptProfileKey(
      new ProfileKeyCiphertext(ourMemberA?.profileKey),
      toServiceIdObject(aci)
    );
    assert.isTrue(
      areEqual(ourProfileAPlaintext.serialize(), newProfileKey),
      'Profile key should be updated in group A'
    );

    debug('Check group B');

    const groupBLocal = await server.getGroup(groupB.publicParams.serialize());
    const clientZkB = new ClientZkGroupCipher(groupB.secretParams);
    const ourUuidCiphertextB = clientZkB.encryptServiceId(
      toServiceIdObject(aci)
    );
    const ourMemberB = groupBLocal?.getMember(ourUuidCiphertextB);

    strictAssert(ourMemberB, 'should find our own member in group B');
    strictAssert(
      ourMemberB?.profileKey,
      'our member in group B should have a profile key'
    );
    const ourProfileBPlaintext = clientZkB.decryptProfileKey(
      new ProfileKeyCiphertext(ourMemberB?.profileKey),
      toServiceIdObject(aci)
    );
    assert.isTrue(
      areEqual(ourProfileBPlaintext.serialize(), newProfileKey),
      'Profile key should be updated in group B'
    );
  });
});
