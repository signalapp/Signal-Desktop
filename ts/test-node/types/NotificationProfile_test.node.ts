// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { DAY, HOUR, MINUTE } from '../../util/durations/index.std.js';

import {
  DayOfWeek,
  findNextProfileEvent,
  getDayOfWeek,
  getEndTime,
  getMidnight,
  getStartTime,
  loopThroughWeek,
  sortProfiles,
} from '../../types/NotificationProfile.std.js';
import { generateNotificationProfileId } from '../../types/NotificationProfile-node.node.js';

import type {
  NextProfileEvent,
  NotificationProfileType,
} from '../../types/NotificationProfile.std.js';

describe('NotificationProfile', () => {
  const startingTime = Date.now();
  const startingTimeDay = getDayOfWeek(startingTime);
  const delta = startingTimeDay - 1;

  const mondayOfThisWeek = startingTime - DAY * delta;
  const midnight = getMidnight(mondayOfThisWeek);

  // 10am on Monday of this week, local time
  const now = midnight + 10 * HOUR;

  const CONVERSATION1 = 'conversation-1';
  const CONVERSATION2 = 'conversation-2';

  function createBasicProfile(
    partial?: Partial<NotificationProfileType>
  ): NotificationProfileType {
    return {
      id: generateNotificationProfileId(),
      name: 'After Hours',
      emoji: '💤 ',
      color: 0xff111111,

      createdAtMs: now,

      allowAllCalls: true,
      allowAllMentions: false,

      allowedMembers: new Set([CONVERSATION1, CONVERSATION2]),
      scheduleEnabled: false,

      scheduleStartTime: undefined,
      scheduleEndTime: undefined,

      scheduleDaysEnabled: {
        [DayOfWeek.MONDAY]: false,
        [DayOfWeek.TUESDAY]: false,
        [DayOfWeek.WEDNESDAY]: false,
        [DayOfWeek.THURSDAY]: false,
        [DayOfWeek.FRIDAY]: false,
        [DayOfWeek.SATURDAY]: false,
        [DayOfWeek.SUNDAY]: false,
      },
      deletedAtTimestampMs: undefined,
      storageID: 'storageId-1',
      storageVersion: 56,
      storageUnknownFields: undefined,
      storageNeedsSync: false,

      ...partial,
    };
  }

  describe('findNextProfileEvent', () => {
    it('should return noChange with no profiles', () => {
      const expected: NextProfileEvent = {
        type: 'noChange',
        activeProfile: undefined,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return noChange with no profiles with schedules', () => {
      const expected: NextProfileEvent = {
        type: 'noChange',
        activeProfile: undefined,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        createBasicProfile(),
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return noChange if manual enable override w/o end time and profile has no schedule', () => {
      const defaultProfile = createBasicProfile();
      const expected: NextProfileEvent = {
        type: 'noChange',
        activeProfile: defaultProfile.id,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: defaultProfile.id,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable if manual enable override w/ end time and profile has no schedule', () => {
      const defaultProfile = createBasicProfile();
      const disableAt = now + HOUR;

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: disableAt,
        clearEnableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: defaultProfile.id,
            endsAtMs: disableAt,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable if manual enable override w/ end time overlaps with scheduled time', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + HOUR,
        clearEnableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: defaultProfile.id,
            endsAtMs: now + HOUR,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });
    it('should return willDisable if manual enable override w/ end time if different profile enables at end time', () => {
      const newProfile = createBasicProfile({
        name: 'new',
        createdAtMs: now,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });
      const oldProfile = createBasicProfile({
        name: 'old',
        createdAtMs: now - 10,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });
      const profiles = sortProfiles([oldProfile, newProfile]);

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: oldProfile.id,
        willDisableAt: now + HOUR,
        clearEnableOverride: true,
      };

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: oldProfile.id,
            endsAtMs: now + HOUR,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable if manual enable override w/o end time refers to profile with schedule, enabled now', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + 2 * HOUR,
        clearEnableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: defaultProfile.id,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });
    it('should return willDisable if manual enable override w/o end time refers to profile with schedule, enabled via previous day schedule', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: false,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: true,
        },
        scheduleStartTime: 2000,
        scheduleEndTime: 1100,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + HOUR,
        clearEnableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: defaultProfile.id,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });
    it('should return willDisable if manual enable override w/o end time refers to profile with schedule, not enabled now', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: false,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: true,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + 2 * DAY + 2 * HOUR,
        clearEnableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: undefined,
          enabled: {
            profileId: defaultProfile.id,
          },
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable if profile should be active right now', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + 2 * HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable if profile should be active right now, with earlier preempt time', () => {
      const defaultProfile = createBasicProfile({
        createdAtMs: now,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });
      const preemptProfile = createBasicProfile({
        createdAtMs: now + 10,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1030,
        scheduleEndTime: 1200,
      });
      const noPreemptProfile = createBasicProfile({
        createdAtMs: now - 10,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1015,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + 30 * MINUTE,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = sortProfiles([
        preemptProfile,
        noPreemptProfile,
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ]);

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable with newer profile if two profiles should be active right now, different start time', () => {
      const oldProfile = createBasicProfile({
        createdAtMs: now - 10,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 800,
        scheduleEndTime: 1200,
      });
      const newProfile = createBasicProfile({
        createdAtMs: now,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: newProfile.id,
        willDisableAt: now + 2 * HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = sortProfiles([
        oldProfile,
        newProfile,
      ]);

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });
    it('should return willDisable with newer profile if two profiles should be active right now, same start time', () => {
      const oldProfile = createBasicProfile({
        createdAtMs: now - 10,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });
      const newProfile = createBasicProfile({
        createdAtMs: now,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1200,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: newProfile.id,
        willDisableAt: now + 2 * HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = sortProfiles([
        oldProfile,
        newProfile,
      ]);

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willDisable if profile has end before start, and is scheduled to end soon', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: false,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: true,
        },
        scheduleStartTime: 2000,
        scheduleEndTime: 1100,
      });

      const expected: NextProfileEvent = {
        type: 'willDisable',
        activeProfile: defaultProfile.id,
        willDisableAt: now + HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable if profile is scheduled to start soon', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: defaultProfile.id,
        willEnableAt: now + HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable if profile has end before start, and is scheduled to start soon', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 2000,
        scheduleEndTime: 1100,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: defaultProfile.id,
        willEnableAt: now + 10 * HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable w/ manual disable override if profile will start soon', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: defaultProfile.id,
        willEnableAt: now + HOUR,
        clearDisableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: now,
          enabled: undefined,
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable w/ manual disable override if profile should be active now, another starts tomorrow', () => {
      const activeProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 900,
        scheduleEndTime: 1100,
      });
      const willStartProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: false,
          [DayOfWeek.TUESDAY]: true,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: willStartProfile.id,
        willEnableAt: now + DAY + HOUR,
        clearDisableOverride: true,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        activeProfile,
        willStartProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: {
          disabledAtMs: now,
          enabled: undefined,
        },
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable if profile schedule starts in six days', () => {
      const defaultProfile = createBasicProfile({
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: false,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: true,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: defaultProfile.id,
        willEnableAt: now + HOUR + 6 * DAY,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = [
        defaultProfile,
        createBasicProfile({
          name: 'Work',
        }),
      ];

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable for newer profile if there is a conflict', () => {
      const newProfile = createBasicProfile({
        name: 'new-profile',
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });
      const oldProfile = createBasicProfile({
        name: 'old-profile',
        createdAtMs: now - HOUR,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: newProfile.id,
        willEnableAt: now + HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = sortProfiles([
        oldProfile,
        newProfile,
      ]);

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });

    it('should return willEnable for older profile if it will activate first', () => {
      const newProfile = createBasicProfile({
        name: 'new-profile',
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: false,
          [DayOfWeek.TUESDAY]: true,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });
      const oldProfile = createBasicProfile({
        name: 'old-profile',
        createdAtMs: now - HOUR,
        scheduleEnabled: true,
        scheduleDaysEnabled: {
          [DayOfWeek.MONDAY]: true,
          [DayOfWeek.TUESDAY]: false,
          [DayOfWeek.WEDNESDAY]: false,
          [DayOfWeek.THURSDAY]: false,
          [DayOfWeek.FRIDAY]: false,
          [DayOfWeek.SATURDAY]: false,
          [DayOfWeek.SUNDAY]: false,
        },
        scheduleStartTime: 1100,
        scheduleEndTime: 1400,
      });

      const expected: NextProfileEvent = {
        type: 'willEnable',
        toEnable: oldProfile.id,
        willEnableAt: now + HOUR,
      };
      const profiles: ReadonlyArray<NotificationProfileType> = sortProfiles([
        oldProfile,
        newProfile,
      ]);

      const actual = findNextProfileEvent({
        override: undefined,
        profiles,
        time: now,
      });
      assert.deepEqual(actual, expected);
    });
  });

  describe('loopThroughWeek', () => {
    it('finds result on first day checked', () => {
      let count = 0;
      const startingDay = getDayOfWeek(now);

      loopThroughWeek({
        time: now,
        startingDay,
        check: _options => {
          count += 1;
          return true;
        },
      });

      assert.strictEqual(count, 1);
    });
    it('finds result on second-to-last day checked', () => {
      let count = 0;
      const startingDay = getDayOfWeek(now);

      loopThroughWeek({
        time: now,
        startingDay,
        check: ({ day }) => {
          count += 1;
          if (day === DayOfWeek.SATURDAY) {
            return true;
          }
          return false;
        },
      });

      assert.strictEqual(count, 7);
    });
    it('loops through entire week if check returns false', () => {
      let count = 0;
      const startingDay = getDayOfWeek(now);

      loopThroughWeek({
        time: now,
        startingDay,
        check: _options => {
          count += 1;
          return false;
        },
      });

      assert.strictEqual(count, 8);
    });
    it('loops from sunday (yesterday) to next sunday', () => {
      let count = 0;
      const startingDay = getDayOfWeek(now);

      loopThroughWeek({
        time: now,
        startingDay,
        check: ({ day }) => {
          count += 1;
          if (day === DayOfWeek.SUNDAY && count !== 1) {
            return true;
          }
          return false;
        },
      });

      assert.strictEqual(count, 8);
    });
    it('loops from saturday (yesterday) to next saturday', () => {
      const sundayAt10 = now + 6 * DAY;
      let count = 0;
      const startingDay = getDayOfWeek(sundayAt10);

      loopThroughWeek({
        time: sundayAt10,
        startingDay,
        check: ({ day }) => {
          count += 1;
          if (day === DayOfWeek.SATURDAY && count !== 1) {
            return true;
          }
          return false;
        },
      });

      assert.strictEqual(count, 8);
    });
  });

  describe('sortProfiles', () => {
    it('sorts profiles in descending by create date', () => {
      const old = createBasicProfile({ name: 'old', createdAtMs: now - 10 });
      const middle = createBasicProfile({ name: 'middle', createdAtMs: now });
      const newest = createBasicProfile({
        name: 'newest',
        createdAtMs: now + 10,
      });

      const starting = [middle, old, newest];
      const actual = sortProfiles(starting);

      assert.strictEqual(actual[0].name, 'newest');
      assert.strictEqual(actual[1].name, 'middle');
      assert.strictEqual(actual[2].name, 'old');
    });
  });

  describe('getStartTime', () => {
    it('returns start time for today, without considering end time', () => {
      const scheduleStartTime = 1100;

      const expected = now + HOUR;
      const actual = getStartTime(midnight, {
        scheduleStartTime,
      });
      assert.strictEqual(actual, expected);
    });
  });

  describe('getEndTime', () => {
    it('returns end time for today if it is later', () => {
      const scheduleStartTime = 1100;
      const scheduleEndTime = 1200;

      const expected = now + 2 * HOUR;
      const actual = getEndTime(midnight, {
        scheduleStartTime,
        scheduleEndTime,
      });
      assert.strictEqual(actual, expected);
    });

    it('returns start time tomorrow if it start is later', () => {
      const scheduleStartTime = 1200;
      const scheduleEndTime = 1100;

      const expected = now + DAY + HOUR;
      const actual = getEndTime(midnight, {
        scheduleStartTime,
        scheduleEndTime,
      });
      assert.strictEqual(actual, expected);
    });
  });
});
