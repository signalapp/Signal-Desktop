// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert';
import { Proto, StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';
import Long from 'long';

import * as Bytes from '../../Bytes.std.js';
import * as durations from '../../util/durations/index.std.js';
import { dropNull } from '../../util/dropNull.std.js';
import { constantTimeEqual } from '../../Crypto.node.js';
import { generateNotificationProfileId } from '../../types/NotificationProfile-node.node.js';
import { Bootstrap, debug } from './fixtures.node.js';
import { typeIntoInput } from '../helpers.node.js';

import type { App } from './fixtures.node.js';
import { DayOfWeek } from '../../types/NotificationProfile.std.js';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service/notification profiles', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { phone } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    if (app) {
      await app.close();
    }
    await bootstrap.teardown();
  });

  it('updates storage service on initial onboard on desktop', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    const state = await phone.expectStorageState('initial state');

    // wait for initial sync storage service update
    const secondState = await phone.waitForStorageState({ after: state });

    debug('Opening settings tab');
    await window.locator('[data-testid="NavTabsItem--Settings"]').click();

    debug('Opening Notifications page');
    await window.getByRole('button', { name: 'Notifications' }).click();

    const profileName = 'NewProfile';
    debug('Starting Notification Profiles onboarding');
    await window.getByRole('button', { name: 'Set up' }).click();

    debug('Dismiss onboarding dialog');
    await window.getByRole('button', { name: 'Continue' }).click();

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

    debug('Done page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('List page');
    await expect(
      window.getByTestId(`EditProfile--${profileName}`)
    ).toBeVisible();

    // finally, this storage service update should include the new notification profile
    const thirdState = await phone.waitForStorageState({
      after: secondState,
    });

    let profileId: Uint8Array | undefined;
    const profilewasAdded = thirdState.hasRecord(record => {
      const isMatch =
        record.type === IdentifierType.NOTIFICATION_PROFILE &&
        record.record?.notificationProfile?.name === profileName &&
        record.record?.notificationProfile?.scheduleEnabled === true;
      if (isMatch) {
        profileId = dropNull(record.record?.notificationProfile?.id);
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

    debug('Done page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('Done page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('List page');
    await expect(
      window.getByTestId(`EditProfile--${profileName}`)
    ).toBeVisible();

    // finally, this storage service update should include the new notification profile
    const fourthState = await phone.waitForStorageState({
      after: secondState,
    });

    const profileScheduleIsOff = fourthState.hasRecord(record => {
      return (
        record.type === IdentifierType.NOTIFICATION_PROFILE &&
        record.record?.notificationProfile?.name === profileName &&
        record.record?.notificationProfile?.scheduleEnabled === false
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
    const fifthState = await phone.waitForStorageState({
      after: secondState,
    });

    const acountRecordHasOverride = fifthState.hasRecord(record => {
      const id =
        record.record?.account?.notificationProfileManualOverride?.enabled?.id;

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

  it('reconciles profiles from storage service when sync is reenabled', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    const starting = await phone.expectStorageState('initial state');

    const firstState = await phone.waitForStorageState({ after: starting });

    debug('Opening settings tab');
    await window.locator('[data-testid="NavTabsItem--Settings"]').click();

    debug('Opening Notifications page');
    await window.getByRole('button', { name: 'Notifications' }).click();

    debug('Open Notification Profiles list page');
    await window.getByRole('button', { name: 'Set up' }).click();

    debug('Dismiss onboarding dialog');
    await window.getByRole('button', { name: 'Continue' }).click();

    debug('Adding two profiles and an override to storage service');
    const now = Date.now();
    const notificationProfileName1 = 'One';
    const notificationProfileId1 = Bytes.fromHex(
      generateNotificationProfileId()
    );
    const notificationProfileName2 = 'Two';
    const notificationProfileId2 = Bytes.fromHex(
      generateNotificationProfileId()
    );
    const notificationProfileName3 = 'Three';
    const notificationProfileId3 = Bytes.fromHex(
      generateNotificationProfileId()
    );
    const notificationProfileName4 = 'Four';
    const notificationProfileId4 = Bytes.fromHex(
      generateNotificationProfileId()
    );

    const DEFAULT_PROFILE = {
      allowAllCalls: true,
      allowAllMentions: false,
      scheduleStartTime: 900,
      scheduleEndTime: 1700,
      scheduleEnabled: false,
      scheduleDaysEnabled: [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
      ],
    };

    {
      let newState = firstState.addRecord({
        type: IdentifierType.NOTIFICATION_PROFILE,
        record: {
          notificationProfile: {
            id: notificationProfileId1,
            name: notificationProfileName1,
            color: 0xffff0000,
            createdAtMs: Long.fromNumber(now + 1),
            ...DEFAULT_PROFILE,
          },
        },
      });

      newState = newState.addRecord({
        type: IdentifierType.NOTIFICATION_PROFILE,
        record: {
          notificationProfile: {
            id: notificationProfileId2,
            name: notificationProfileName2,
            color: 0xff00ff00,
            createdAtMs: Long.fromNumber(now + 2),
            ...DEFAULT_PROFILE,
            allowAllCalls: false,
          },
        },
      });

      newState = newState.updateAccount({
        notificationProfileManualOverride: {
          enabled: {
            id: notificationProfileId1,
          },
        },
      });

      await phone.setStorageState(newState);
    }

    debug('Waiting for desktop to process storage service updates');
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });
    await app.waitForManifestVersion(firstState.version + 1);

    debug('Now we should be on the Notification Profiles list page');
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName1}`)
    ).toBeVisible();
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName2}`)
    ).toBeVisible();

    debug('Turn off Notification Profiles sync');
    await window.locator('button[role="switch"]').click();

    const secondState = await phone.waitForStorageState({
      after: firstState,
    });

    debug(
      'We should still see the same items on the Notification Profiles list page'
    );
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName1}`)
    ).toBeVisible();
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName2}`)
    ).toBeVisible();

    {
      const accountRecord = secondState.getAccountRecord();
      if (!accountRecord?.notificationProfileSyncDisabled) {
        throw new Error('Notification profile sync is disabled!');
      }

      assert.deepEqual(accountRecord?.notificationProfileManualOverride, {
        enabled: {
          id: notificationProfileId1,
        },
      });

      let countOfProfiles = 0;
      secondState.hasRecord(record => {
        const deletedTimestamp =
          record.record.notificationProfile?.deletedAtTimestampMs;
        if (
          record.type === IdentifierType.NOTIFICATION_PROFILE &&
          (!deletedTimestamp || deletedTimestamp.isZero())
        ) {
          countOfProfiles += 1;
        }
        return false;
      });

      assert.strictEqual(
        countOfProfiles,
        2,
        'Expect the original two still in storage service'
      );
    }

    debug('Open edit page for existing profile');
    await window
      .getByTestId(`EditProfile--${notificationProfileName1}`)
      .click();

    debug('Open edit schedule page, enable schedule');
    await window.getByTestId('EditSchedule').click();
    await window.locator('button[role="switch"]').click();

    debug('Done page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('Done page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('List page');
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName1}`)
    ).toBeVisible();

    debug('Now create a new Notification Profile');
    await window.getByRole('button', { name: 'Create profile' }).click();

    debug('Name page');
    const nameInput = window.locator('.Input__input');
    await typeIntoInput(nameInput, notificationProfileName3, '');
    await window.getByRole('button', { name: 'Next' }).click();

    debug('Allowed page');
    await window.getByRole('button', { name: 'Next' }).click();

    debug('Schedule page');
    await window.getByRole('button', { name: 'Next' }).click();

    debug('Done page');
    await window.getByRole('button', { name: 'Done' }).click();

    debug('List page');
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName3}`)
    ).toBeVisible();

    debug('Turn on sync on storage service, and add two new profiles');
    {
      let newState = secondState.addRecord({
        type: IdentifierType.NOTIFICATION_PROFILE,
        record: {
          notificationProfile: {
            id: notificationProfileId1,
            name: notificationProfileName1,
            color: 0xffff0000,
            createdAtMs: Long.fromNumber(now + 1),
            ...DEFAULT_PROFILE,
          },
        },
      });

      newState = newState.addRecord({
        type: IdentifierType.NOTIFICATION_PROFILE,
        record: {
          notificationProfile: {
            id: notificationProfileId2,
            name: notificationProfileName2,
            color: 0xff00ff00,
            createdAtMs: Long.fromNumber(now + 2),
            ...DEFAULT_PROFILE,
            allowAllCalls: false,
          },
        },
      });

      newState = newState.addRecord({
        type: IdentifierType.NOTIFICATION_PROFILE,
        record: {
          notificationProfile: {
            id: notificationProfileId3,
            name: notificationProfileName3,
            color: 0xff0000ff,
            createdAtMs: Long.fromNumber(now + 3),
            ...DEFAULT_PROFILE,
          },
        },
      });

      newState = newState.addRecord({
        type: IdentifierType.NOTIFICATION_PROFILE,
        record: {
          notificationProfile: {
            id: notificationProfileId4,
            name: notificationProfileName4,
            color: 0xff0000ff,
            createdAtMs: Long.fromNumber(now + 4),
            ...DEFAULT_PROFILE,
            allowAllCalls: false,
            scheduleStartTime: 1000,
            scheduleEndTime: 1100,
            scheduleDaysEnabled: [DayOfWeek.MONDAY],
          },
        },
      });

      newState = newState.updateAccount({
        notificationProfileManualOverride: {
          enabled: {
            id: notificationProfileId1,
          },
        },
        notificationProfileSyncDisabled: false,
      });

      await phone.setStorageState(newState);
    }

    // now desktop will see the off->on flip for sync, and reconcile profiles:
    // #1: was modified on Desktop, so will be duplicated
    // #2: same on both, should not be duplicated
    // #3: created separately on both sides with sync off, structurally similar, no dupe
    // #4: new via storage service after sync
    debug('Waiting for desktop to process storage service updates');
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });
    await app.waitForManifestVersion(secondState.version + 1);

    debug('Check what is on the list page now');
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName1}`)
    ).toBeVisible();
    await expect(
      window.getByTestId(`EditProfile--Copy of ${notificationProfileName1}`)
    ).toBeVisible();
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName2}`)
    ).toBeVisible();
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName3}`)
    ).toBeVisible();
    await expect(
      window.getByTestId(`EditProfile--${notificationProfileName4}`)
    ).toBeVisible();

    const thirdState = await phone.waitForStorageState({
      after: secondState,
    });

    let countOfProfiles = 0;
    thirdState.hasRecord(record => {
      const deletedTimestamp =
        record.record.notificationProfile?.deletedAtTimestampMs;
      if (
        record.type === IdentifierType.NOTIFICATION_PROFILE &&
        (!deletedTimestamp || deletedTimestamp.isZero())
      ) {
        countOfProfiles += 1;
      }
      return false;
    });

    assert.strictEqual(
      countOfProfiles,
      5,
      'Expect all profiles in storage service'
    );
  });
});
