// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { DataReader, DataWriter } from '../../sql/Client.preload.js';

import { DayOfWeek } from '../../types/NotificationProfile.std.js';
import { generateNotificationProfileId } from '../../types/NotificationProfile-node.node.js';

import type { NotificationProfileType } from '../../types/NotificationProfile.std.js';

const { getAllNotificationProfiles } = DataReader;
const {
  _deleteAllNotificationProfiles,
  createNotificationProfile,
  deleteNotificationProfileById,
  markNotificationProfileDeleted,
  updateNotificationProfile,
} = DataWriter;

describe('sql/notificationProfiles', () => {
  beforeEach(async () => {
    await _deleteAllNotificationProfiles();
  });
  after(async () => {
    await _deleteAllNotificationProfiles();
  });

  it('should roundtrip', async () => {
    const now = Date.now();
    const profile1: NotificationProfileType = {
      id: generateNotificationProfileId(),
      name: 'After Hours',
      emoji: '💤 ',
      color: 0xff111111,

      createdAtMs: now,

      allowAllCalls: true,
      allowAllMentions: true,

      allowedMembers: new Set(['conversation-1', 'conversation-2']),
      scheduleEnabled: true,

      scheduleStartTime: 1800,
      scheduleEndTime: 2400,

      scheduleDaysEnabled: {
        [DayOfWeek.MONDAY]: true,
        [DayOfWeek.TUESDAY]: true,
        [DayOfWeek.WEDNESDAY]: true,
        [DayOfWeek.THURSDAY]: true,
        [DayOfWeek.FRIDAY]: true,
        [DayOfWeek.SATURDAY]: false,
        [DayOfWeek.SUNDAY]: false,
      },
      deletedAtTimestampMs: undefined,
      storageID: 'storageId-1',
      storageVersion: 56,
      storageUnknownFields: new Uint8Array([1, 2, 3, 4]),
      storageNeedsSync: false,
    };
    const profile2: NotificationProfileType = {
      id: generateNotificationProfileId(),
      name: 'Holiday',
      emoji: undefined,
      color: 0xff222222,

      createdAtMs: now + 1,

      allowAllCalls: false,
      allowAllMentions: false,

      allowedMembers: new Set<string>(),
      scheduleEnabled: false,

      scheduleStartTime: undefined,
      scheduleEndTime: undefined,
      scheduleDaysEnabled: undefined,

      deletedAtTimestampMs: undefined,
      storageID: undefined,
      storageVersion: undefined,
      storageUnknownFields: undefined,
      storageNeedsSync: true,
    };

    await createNotificationProfile(profile1);
    const oneProfile = await getAllNotificationProfiles();
    assert.lengthOf(oneProfile, 1);
    assert.deepEqual(oneProfile[0], profile1);

    await createNotificationProfile(profile2);
    const twoProfiles = await getAllNotificationProfiles();
    assert.lengthOf(twoProfiles, 2);
    assert.deepEqual(twoProfiles[0], profile2);
    assert.deepEqual(twoProfiles[1], profile1);

    await deleteNotificationProfileById(profile1.id);
    const backToOneProfile = await getAllNotificationProfiles();
    assert.lengthOf(backToOneProfile, 1);
    assert.deepEqual(backToOneProfile[0], profile2);
  });

  it('can mark a profile as deleted', async () => {
    const now = Date.now();
    const profile1: NotificationProfileType = {
      id: generateNotificationProfileId(),
      name: 'After Hours',
      emoji: '💤 ',
      color: 0xff111111,

      createdAtMs: now,

      allowAllCalls: true,
      allowAllMentions: true,

      allowedMembers: new Set(['conversation-1', 'conversation-2']),
      scheduleEnabled: true,

      scheduleStartTime: 1800,
      scheduleEndTime: 2400,

      scheduleDaysEnabled: {
        [DayOfWeek.MONDAY]: true,
        [DayOfWeek.TUESDAY]: true,
        [DayOfWeek.WEDNESDAY]: true,
        [DayOfWeek.THURSDAY]: true,
        [DayOfWeek.FRIDAY]: true,
        [DayOfWeek.SATURDAY]: false,
        [DayOfWeek.SUNDAY]: false,
      },
      deletedAtTimestampMs: undefined,
      storageID: 'storageId-1',
      storageVersion: 56,
      storageUnknownFields: new Uint8Array([1, 2, 3, 4]),
      storageNeedsSync: false,
    };
    const profile2: NotificationProfileType = {
      id: generateNotificationProfileId(),
      name: 'Holiday',
      emoji: undefined,
      color: 0xff222222,

      createdAtMs: now + 1,

      allowAllCalls: false,
      allowAllMentions: false,

      allowedMembers: new Set<string>(),
      scheduleEnabled: false,

      scheduleStartTime: undefined,
      scheduleEndTime: undefined,
      scheduleDaysEnabled: undefined,

      deletedAtTimestampMs: undefined,
      storageID: undefined,
      storageVersion: undefined,
      storageUnknownFields: undefined,
      storageNeedsSync: true,
    };

    await createNotificationProfile(profile1);
    await createNotificationProfile(profile2);

    const timestamp = await markNotificationProfileDeleted(profile1.id);
    assert.isDefined(timestamp);

    const twoProfiles = await getAllNotificationProfiles();
    assert.lengthOf(twoProfiles, 2);
    assert.strictEqual(twoProfiles[1].deletedAtTimestampMs, timestamp);
  });

  it('can update a profile', async () => {
    const now = Date.now();
    const id = generateNotificationProfileId();

    const profile: NotificationProfileType = {
      id,
      name: 'After Hours',
      emoji: '💤 ',
      color: 0xff111111,

      createdAtMs: now,

      allowAllCalls: true,
      allowAllMentions: true,

      allowedMembers: new Set(['conversation-1', 'conversation-2']),
      scheduleEnabled: true,

      scheduleStartTime: 1800,
      scheduleEndTime: 2400,

      scheduleDaysEnabled: {
        [DayOfWeek.MONDAY]: true,
        [DayOfWeek.TUESDAY]: true,
        [DayOfWeek.WEDNESDAY]: true,
        [DayOfWeek.THURSDAY]: true,
        [DayOfWeek.FRIDAY]: true,
        [DayOfWeek.SATURDAY]: false,
        [DayOfWeek.SUNDAY]: false,
      },
      deletedAtTimestampMs: undefined,
      storageID: 'storageId-1',
      storageVersion: 56,
      storageUnknownFields: new Uint8Array([1, 2, 3, 4]),
      storageNeedsSync: false,
    };
    const update: NotificationProfileType = {
      id,
      name: 'Holiday',
      emoji: '📆 ',
      color: 0xff222222,

      createdAtMs: now + 1,

      allowAllCalls: false,
      allowAllMentions: false,

      allowedMembers: new Set<string>(),
      scheduleEnabled: false,

      scheduleStartTime: undefined,
      scheduleEndTime: undefined,
      scheduleDaysEnabled: undefined,

      deletedAtTimestampMs: undefined,
      storageID: undefined,
      storageVersion: undefined,
      storageUnknownFields: undefined,
      storageNeedsSync: true,
    };

    await createNotificationProfile(profile);
    const oneProfile = await getAllNotificationProfiles();
    assert.lengthOf(oneProfile, 1);
    assert.deepEqual(oneProfile[0], profile);

    await updateNotificationProfile(update);
    const stillOneProfile = await getAllNotificationProfiles();
    assert.lengthOf(stillOneProfile, 1);
    assert.deepEqual(stillOneProfile[0], update);
  });
});
