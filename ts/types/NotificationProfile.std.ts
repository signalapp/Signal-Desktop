// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { DAY, HOUR, MINUTE } from '../util/durations/index.std.js';
import { strictAssert } from '../util/assert.std.js';

import type { StorageServiceFieldsType } from '../sql/Interface.std.js';

const { isNumber, orderBy } = lodash;

// Note: this must match the Backup and Storage Service protos for NotificationProfile
export enum DayOfWeek {
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 7,
}
export type ScheduleDays = { [key in DayOfWeek]: boolean };

// This variable is separate so we aren't forced to add it to ScheduleDays type
export const DayOfWeekUnknown = 0;

export type NotificationProfileIdString = string & {
  __notification_profile_id: never;
};
export type NotificationProfileType = Readonly<{
  id: NotificationProfileIdString;

  name: string;
  emoji: string | undefined;
  /* A numeric representation of a color, like 0xAARRGGBB */
  color: number;

  createdAtMs: number;

  allowAllCalls: boolean;
  allowAllMentions: boolean;

  // conversationIds
  allowedMembers: ReadonlySet<string>;
  scheduleEnabled: boolean;

  // These two are 24-hour clock int, 0000-2359 (e.g., 15, 900, 1130, 2345) */
  scheduleStartTime: number | undefined;
  scheduleEndTime: number | undefined;

  scheduleDaysEnabled: ScheduleDays | undefined;
  deletedAtTimestampMs: number | undefined;
}> &
  StorageServiceFieldsType;

export type NotificationProfileOverride =
  | {
      disabledAtMs: number;
      enabled: undefined;
    }
  | {
      disabledAtMs: undefined;
      enabled: {
        profileId: string;
        endsAtMs?: number;
      };
    };

export type CurrentNotificationProfileState = {
  enabledProfileId: string;
  nextChangeAt: number | undefined;
};

export type NextProfileEvent =
  | {
      type: 'noChange';
      activeProfile: string | undefined;
    }
  | {
      type: 'willDisable';
      willDisableAt: number;
      activeProfile: string;
      clearEnableOverride?: boolean;
    }
  | {
      type: 'willEnable';
      willEnableAt: number;
      toEnable: string;
      clearDisableOverride?: boolean;
    };

// This is A100 background color
export const DEFAULT_PROFILE_COLOR = 0xffe3e3fe;

export const NOTIFICATION_PROFILE_ID_LENGTH = 16;

export function shouldNotify({
  isCall,
  isMention,
  conversationId,
  activeProfile,
}: {
  isCall: boolean;
  isMention: boolean;
  conversationId: string;
  activeProfile: NotificationProfileType | undefined;
}): boolean {
  if (!activeProfile) {
    return true;
  }

  if (isCall && activeProfile.allowAllCalls) {
    return true;
  }

  if (isMention && activeProfile.allowAllMentions) {
    return true;
  }

  if (activeProfile.allowedMembers.has(conversationId)) {
    return true;
  }

  return false;
}

export function findNextProfileEvent({
  override,
  profiles,
  time,
}: {
  override: NotificationProfileOverride | undefined;
  profiles: ReadonlyArray<NotificationProfileType>;
  time: number;
}): NextProfileEvent {
  if (override?.enabled?.endsAtMs) {
    const profile = getProfileById(override.enabled.profileId, profiles);

    // Note: we may go immediately from this to the same profile enabled, if its schedule
    // dictates that it should be on. But we return this timestamp to clear the override.
    return {
      type: 'willDisable',
      willDisableAt: override.enabled.endsAtMs,
      activeProfile: profile.id,
      clearEnableOverride: true,
    };
  }
  if (override?.enabled) {
    const profile = getProfileById(override.enabled.profileId, profiles);

    const isEnabled =
      isProfileEnabledBySchedule({
        time,
        timeForSchedule: time - DAY,
        profile,
      }) ||
      isProfileEnabledBySchedule({
        time,
        timeForSchedule: time,
        profile,
      });
    if (isEnabled) {
      const willDisableAt = findNextScheduledDisable({ time, profile });
      strictAssert(
        willDisableAt,
        'findNextProfileEvent: override enabled - profile is also enabled by schedule, it should disable!'
      );
      return {
        type: 'willDisable',
        willDisableAt,
        activeProfile: profile.id,
        clearEnableOverride: true,
      };
    }

    const nextEnableTime = findNextScheduledEnable({ time, profile });
    if (!nextEnableTime) {
      return {
        type: 'noChange',
        activeProfile: profile.id,
      };
    }

    const nextDisableTime = findNextScheduledDisable({
      time: nextEnableTime + 1,
      profile,
    });
    strictAssert(
      nextDisableTime,
      'findNextProfileEvent: override enabled - profile will enable by schedule, it should disable!'
    );
    return {
      type: 'willDisable',
      activeProfile: profile.id,
      willDisableAt: nextDisableTime,
      clearEnableOverride: true,
    };
  }
  if (override?.disabledAtMs) {
    const rightAfterDisable = override.disabledAtMs + 1;
    const nextScheduledEnable = findNextScheduledEnableForAll({
      profiles,
      time: rightAfterDisable,
    });
    if (nextScheduledEnable) {
      return {
        type: 'willEnable',
        willEnableAt: nextScheduledEnable.time,
        toEnable: nextScheduledEnable.profile.id,
        clearDisableOverride: true,
      };
    }

    return {
      type: 'noChange',
      activeProfile: undefined,
    };
  }

  const activeProfileBySchedule = areAnyProfilesEnabledBySchedule({
    profiles,
    time,
  });
  if (activeProfileBySchedule) {
    const disabledAt = findNextScheduledDisable({
      profile: activeProfileBySchedule,
      time,
    });

    // A newer profile will preempt this active profile if its schedule overlaps.
    const newerProfiles = profiles.filter(
      item => item.createdAtMs > activeProfileBySchedule.createdAtMs
    );
    const preemptResult = findNextScheduledEnableForAll({
      profiles: newerProfiles,
      time: time + 1,
    });

    strictAssert(
      disabledAt,
      `Schedule ${activeProfileBySchedule.id} is enabled by schedule right now, it should disable soon!`
    );
    return {
      type: 'willDisable',
      activeProfile: activeProfileBySchedule.id,
      willDisableAt: preemptResult
        ? Math.min(preemptResult.time, disabledAt)
        : disabledAt,
    };
  }

  const nextProfileToEnable = findNextScheduledEnableForAll({ profiles, time });
  if (nextProfileToEnable) {
    return {
      type: 'willEnable',
      willEnableAt: nextProfileToEnable.time,
      toEnable: nextProfileToEnable.profile.id,
    };
  }

  return {
    type: 'noChange',
    activeProfile: undefined,
  };
}

// Should this profile be active right now, based on its schedule?
export function isProfileEnabledBySchedule({
  time,
  timeForSchedule,
  profile,
}: {
  time: number;
  timeForSchedule: number;
  profile: NotificationProfileType;
}): boolean {
  const day = getDayOfWeek(timeForSchedule);
  const midnight = getMidnight(timeForSchedule);

  const {
    scheduleEnabled,
    scheduleDaysEnabled,
    scheduleEndTime,
    scheduleStartTime,
  } = profile;

  if (
    !scheduleEnabled ||
    !scheduleDaysEnabled?.[day] ||
    !isNumber(scheduleEndTime) ||
    !isNumber(scheduleStartTime)
  ) {
    return false;
  }

  const scheduleStart = getStartTime(midnight, {
    scheduleStartTime,
  });
  const scheduleEnd = getEndTime(midnight, {
    scheduleEndTime,
    scheduleStartTime,
  });
  if (time >= scheduleStart && time <= scheduleEnd) {
    return true;
  }

  return false;
}

// For a schedule like start: 8pm, end: 8am, it's an overnight schedule. But we still just
// start with the start time.
export function getStartTime(
  midnight: number,
  { scheduleStartTime }: { scheduleStartTime: number }
): number {
  const scheduleStart = scheduleToTime(midnight, scheduleStartTime);

  return scheduleStart;
}

// For a schedule like start: 8pm, end: 8am, it's an overnight schedule. It ends with
// the stated start time, 24 hours added.
export function getEndTime(
  midnight: number,
  {
    scheduleStartTime,
    scheduleEndTime,
  }: { scheduleStartTime: number; scheduleEndTime: number }
): number {
  const scheduleStart = scheduleToTime(midnight, scheduleStartTime);
  const scheduleEnd = scheduleToTime(midnight, scheduleEndTime);

  // The normal case, where the end comes after the start.
  if (scheduleEnd > scheduleStart) {
    return scheduleEnd;
  }

  return scheduleEnd + DAY;
}

// Find the profile that should be active right, based on schedules
export function areAnyProfilesEnabledBySchedule({
  time,
  profiles,
}: {
  time: number;
  profiles: ReadonlyArray<NotificationProfileType>;
}): NotificationProfileType | undefined {
  // We find the first match, assuming the array is sorted, newest to oldest
  for (const profile of profiles) {
    const enabledYesterday = isProfileEnabledBySchedule({
      time,
      timeForSchedule: time - DAY,
      profile,
    });
    if (enabledYesterday) {
      return profile;
    }

    const enabledNow = isProfileEnabledBySchedule({
      time,
      timeForSchedule: time,
      profile,
    });
    if (enabledNow) {
      return profile;
    }
  }

  return undefined;
}

// Find the next time this profile's schedule will tell it to disable
export function findNextScheduledDisable({
  profile,
  time,
}: {
  profile: NotificationProfileType;
  time: number;
}): number | undefined {
  const startingDay = getDayOfWeek(time);
  let result;

  const { scheduleEnabled } = profile;
  if (!scheduleEnabled) {
    return undefined;
  }

  loopThroughWeek({
    time,
    startingDay,
    check: ({ startOfDay, day }) => {
      const { scheduleDaysEnabled, scheduleEndTime, scheduleStartTime } =
        profile;
      if (
        !scheduleDaysEnabled?.[day] ||
        !isNumber(scheduleEndTime) ||
        !isNumber(scheduleStartTime)
      ) {
        return false;
      }

      const scheduleEnd = getEndTime(startOfDay, {
        scheduleEndTime,
        scheduleStartTime,
      });

      if (time < scheduleEnd) {
        result = scheduleEnd;
        return true;
      }

      return false;
    },
  });

  return result;
}

// Find the next time this profile's schedule will tell it to enable
export function findNextScheduledEnable({
  profile,
  time,
}: {
  profile: NotificationProfileType;
  time: number;
}): number | undefined {
  const startingDay = getDayOfWeek(time);
  let result: number | undefined;

  const { scheduleEnabled } = profile;
  if (!scheduleEnabled) {
    return undefined;
  }

  loopThroughWeek({
    time,
    startingDay,
    check: ({ startOfDay, day }) => {
      const { scheduleDaysEnabled, scheduleEndTime, scheduleStartTime } =
        profile;

      if (
        !scheduleDaysEnabled?.[day] ||
        !isNumber(scheduleEndTime) ||
        !isNumber(scheduleStartTime)
      ) {
        return false;
      }

      const scheduleStart = getStartTime(startOfDay, {
        scheduleStartTime,
      });
      if (time < scheduleStart) {
        result = scheduleStart;
        return true;
      }

      return false;
    },
  });

  return result;
}

// This is specifically about finding a schedule that will enable later. It will not
// return a schedule enabled right now unless it also has the next scheduled start.
export function findNextScheduledEnableForAll({
  profiles,
  time,
}: {
  profiles: ReadonlyArray<NotificationProfileType>;
  time: number;
}): { profile: NotificationProfileType; time: number } | undefined {
  let earliestResult:
    | { profile: NotificationProfileType; time: number }
    | undefined;

  for (const profile of profiles) {
    const result = findNextScheduledEnable({ time, profile });
    if (isNumber(result) && (!earliestResult || result < earliestResult.time)) {
      earliestResult = {
        profile,
        time: result,
      };
    }
  }

  return earliestResult;
}

export function getDayOfWeek(time: number): DayOfWeek {
  const date = new Date(time);
  const day = date.getDay();

  if (day === 0) {
    return DayOfWeek.SUNDAY;
  }

  if (day < DayOfWeek.MONDAY || day > DayOfWeek.SUNDAY) {
    throw new Error(`getDayOfWeek: Got day that was out of range: ${day}`);
  }

  return day;
}

// scheduleTime is of the format 2200 for 10:00pm.
export function scheduleToTime(midnight: number, scheduleTime: number): number {
  const hours = Math.floor(scheduleTime / 100);
  const minutes = scheduleTime % 100;

  return midnight + hours * HOUR + minutes * MINUTE;
}

export function getMidnight(time: number): number {
  const now = new Date(time);
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0
  );
  return midnight.getTime();
}

export function loopThroughWeek({
  time,
  startingDay,
  check,
}: {
  time: number;
  startingDay: DayOfWeek;
  check: (options: { startOfDay: number; day: DayOfWeek }) => boolean;
}): void {
  const todayAtMidnight = getMidnight(time);
  let index = -1;

  while (index < DayOfWeek.SUNDAY) {
    let indexDay = startingDay + index;
    if (indexDay <= 0) {
      indexDay += DayOfWeek.SUNDAY;
    }
    if (indexDay > DayOfWeek.SUNDAY) {
      indexDay -= DayOfWeek.SUNDAY;
    }
    const startOfDay = todayAtMidnight + DAY * index;
    const result = check({ startOfDay, day: indexDay });
    if (result) {
      return;
    }

    index += 1;
  }
}

export function getProfileById(
  id: string,
  profiles: ReadonlyArray<NotificationProfileType>
): NotificationProfileType {
  const profile = profiles.find(value => value.id === id);
  if (!profile) {
    throw new Error(
      `getProfileById: Unable to find profile with id ${redactNotificationProfileId(id)}`
    );
  }
  return profile;
}

// We want the most recently-created at the beginning; they take precedence in conflicts
export function sortProfiles(
  profiles: ReadonlyArray<NotificationProfileType>
): ReadonlyArray<NotificationProfileType> {
  return orderBy(profiles, ['createdAtMs'], ['desc']);
}

export function redactNotificationProfileId(id: string): string {
  return `[REDACTED]${id.slice(-3)}`;
}

export function fromDayOfWeekArray(
  scheduleDaysEnabled: Array<number> | null | undefined
): ScheduleDays | undefined {
  if (!scheduleDaysEnabled) {
    return undefined;
  }

  return {
    [DayOfWeek.MONDAY]:
      scheduleDaysEnabled.includes(DayOfWeek.MONDAY) ||
      scheduleDaysEnabled.includes(DayOfWeekUnknown),
    [DayOfWeek.TUESDAY]: scheduleDaysEnabled.includes(DayOfWeek.TUESDAY),
    [DayOfWeek.WEDNESDAY]: scheduleDaysEnabled.includes(DayOfWeek.WEDNESDAY),
    [DayOfWeek.THURSDAY]: scheduleDaysEnabled.includes(DayOfWeek.THURSDAY),
    [DayOfWeek.FRIDAY]: scheduleDaysEnabled.includes(DayOfWeek.FRIDAY),
    [DayOfWeek.SATURDAY]: scheduleDaysEnabled.includes(DayOfWeek.SATURDAY),
    [DayOfWeek.SUNDAY]: scheduleDaysEnabled.includes(DayOfWeek.SUNDAY),
  };
}

export function toDayOfWeekArray(
  scheduleDaysEnabled: ScheduleDays | undefined
): Array<number> | undefined {
  if (!scheduleDaysEnabled) {
    return undefined;
  }
  const scheduleDaysEnabledArray: Array<number> = [];

  if (scheduleDaysEnabled[DayOfWeek.MONDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.MONDAY);
  }
  if (scheduleDaysEnabled[DayOfWeek.TUESDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.TUESDAY);
  }
  if (scheduleDaysEnabled[DayOfWeek.WEDNESDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.WEDNESDAY);
  }
  if (scheduleDaysEnabled[DayOfWeek.THURSDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.THURSDAY);
  }
  if (scheduleDaysEnabled[DayOfWeek.FRIDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.FRIDAY);
  }
  if (scheduleDaysEnabled[DayOfWeek.SATURDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.SATURDAY);
  }
  if (scheduleDaysEnabled[DayOfWeek.SUNDAY]) {
    scheduleDaysEnabledArray.push(DayOfWeek.SUNDAY);
  }

  return scheduleDaysEnabledArray;
}
