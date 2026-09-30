// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import assert from 'node:assert';
import { expect } from 'playwright/test';

import type { PrimaryDevice } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.ts';
import { dropNull } from '../../util/dropNull.std.ts';
import { constantTimeEqual } from '../../Crypto.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { typeIntoInput } from '../helpers.node.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { fromHex } from '../../Bytes.std.ts';
import { generateNotificationProfileId } from '../../types/NotificationProfile-node.node.ts';
import { DEFAULT_PROFILE } from '../storage/notification_profiles_test.node.ts';

import type { App, StandaloneLinkData } from '../bootstrap.node.ts';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

export const debug = createDebug('mock:test:standalone:notification-profiles');

describe('standalone/notification profiles', function (this: Mocha.Suite) {
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
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('updates storage service even if sync=OFF when primary', async () => {
    const { server, contacts } = bootstrap;
    const window = await app.getWindow();

    strictAssert(standaloneLinkData, 'Need basics in place!');
    const { aci, storageKey, recordIkm } = standaloneLinkData;

    const now = Date.now();
    const notificationProfileName = 'One';
    const notificationProfileId = fromHex(generateNotificationProfileId());

    debug('add initial data to storage service');

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

    secondState = secondState.addRecord({
      type: IdentifierType.NOTIFICATION_PROFILE,
      record: {
        notificationProfile: {
          id: notificationProfileId,
          name: notificationProfileName,
          color: 0xffff0000,
          createdAtMs: BigInt(now + 1),
          ...DEFAULT_PROFILE,
        },
      },
    });

    await server.setStorageState({
      aci,
      state: secondState,
      previousState: firstState,
      storageKey,
      recordIkm,
    });

    await app.fetchManifestForPrimary();

    {
      debug('verify firstContact is now pinned');

      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator(`[data-testid="${firstContact.device.aci}"]`)
        .waitFor();
    }

    debug('Opening settings tab');
    await window.locator('[data-testid="NavTabsItem--Settings"]').click();

    debug('Opening Notifications page');
    await window.getByRole('button', { name: 'Notifications' }).click();

    debug('Opening Notification Profiles list page');
    await window.getByRole('button', { name: 'Notification profiles' }).click();

    let thirdState = await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
    });

    thirdState = thirdState.updateAccount({
      notificationProfileSyncDisabled: true,
    });

    thirdState = thirdState.pin(secondContact);

    await server.setStorageState({
      aci,
      state: thirdState,
      storageKey,
      recordIkm,
    });

    await app.fetchManifestForPrimary();

    debug('Opening inbox tab');
    await window.locator('[data-testid="NavTabsItem--Chats"]').click();

    {
      debug('verify secondContact is now pinned');

      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator(`[data-testid="${secondContact.device.aci}"]`)
        .waitFor();
    }

    debug('Opening settings tab');
    await window.locator('[data-testid="NavTabsItem--Settings"]').click();

    debug('Opening Notifications page');
    await window.getByRole('button', { name: 'Notifications' }).click();

    const profileName = 'NewProfile';
    debug('Opening Notification Profiles list page');
    await window.getByRole('button', { name: 'Notification profiles' }).click();

    debug('Start the create flow');
    await window.getByRole('button', { name: 'Create profile' }).click();

    debug('Name page');
    const nameInput = window.locator('.Input__input');
    await typeIntoInput(nameInput, profileName, '');
    await window.getByRole('button', { name: 'Next' }).click();

    debug('Allowed page');
    await window.getByRole('button', { name: 'Next' }).click();

    debug('Schedule page');
    await window.locator('button[role="switch"]').click();
    await window.getByRole('button', { name: 'Next' }).click();

    debug('Done with schedule page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('List page');
    await expect(
      window.getByTestId(`EditProfile--${profileName}`)
    ).toBeVisible();

    // finally, this storage service update should include the new notification profile
    const fourthState = await server.waitForStorageState({
      aci,
      after: thirdState,
      storageKey,
      recordIkm,
    });

    let profileId: Uint8Array<ArrayBuffer> | undefined;
    const profilewasAdded = fourthState.hasRecord(record => {
      if (record.record.notificationProfile == null) {
        return false;
      }

      assert.ok(record.type === IdentifierType.NOTIFICATION_PROFILE);

      const isMatch =
        record.record.notificationProfile.name === profileName &&
        record.record.notificationProfile.scheduleEnabled === true;
      if (isMatch) {
        profileId = dropNull(record.record.notificationProfile.id);
      }

      return isMatch;
    });
    if (!profilewasAdded) {
      throw new Error('Did not find new profile in storage service');
    }
    if (!profileId || !profileId.length) {
      throw new Error('No profileId found on new notification record');
    }

    debug('Open edit page for profile');
    await window.getByTestId(`EditProfile--${profileName}`).click();

    debug('Open edit schedule page');
    await window.getByTestId('EditSchedule').click();
    await window.locator('button[role="switch"]').click();

    debug('Done with schedule page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('Done with edit page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('List page');
    await expect(
      window.getByTestId(`EditProfile--${profileName}`)
    ).toBeVisible();

    // finally, this storage service update should include the new notification profile
    const fifthState = await server.waitForStorageState({
      aci,
      after: fourthState,
      storageKey,
      recordIkm,
    });

    const profileScheduleIsOff = fifthState.hasRecord(record => {
      if (record.record.notificationProfile == null) {
        return false;
      }
      assert.ok(record.type === IdentifierType.NOTIFICATION_PROFILE);

      return (
        record.record.notificationProfile.name === profileName &&
        record.record.notificationProfile.scheduleEnabled === false
      );
    });
    if (!profileScheduleIsOff) {
      throw new Error('Profile schedule was not disabled in storage service');
    }

    debug('Opening chats tab');
    await window.locator('[data-testid="NavTabsItem--Chats"]').click();

    debug('Click triple-dot button');
    await window.getByRole('button', { name: 'More Actions' }).click();
    await window
      .getByRole('menuitem', { name: 'Notification profile', exact: true })
      .click();

    debug('Click to add enabled=true override');
    await window.getByRole('menuitem', { name: profileName }).click();

    // finally, this storage service update should have the new override
    const sixthState = await server.waitForStorageState({
      aci,
      after: fifthState,
      storageKey,
      recordIkm,
    });

    const acountRecordHasOverride = sixthState.hasRecord(record => {
      if (record.record.account == null) {
        return false;
      }
      const { notificationProfileManualOverride } = record.record.account;
      if (notificationProfileManualOverride?.override?.enabled == null) {
        return false;
      }

      const { id } = notificationProfileManualOverride.override.enabled;

      return Boolean(
        record.type === IdentifierType.ACCOUNT &&
        id &&
        id.length &&
        profileId &&
        constantTimeEqual(id, profileId)
      );
    });
    if (!acountRecordHasOverride) {
      throw new Error('Did not find matching override in storage service');
    }
  });
});
