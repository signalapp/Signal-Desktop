// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { getNotificationProfileSyncDisabled } from './items.dom.js';

import type { StateType } from '../reducer.preload.js';
import type { NotificationProfilesStateType } from '../ducks/notificationProfiles.preload.js';
import type {
  NextProfileEvent,
  NotificationProfileOverride,
  NotificationProfileType,
} from '../../types/NotificationProfile.std.js';

export const getNotificationProfileData = (
  state: StateType
): NotificationProfilesStateType => {
  return state.notificationProfiles;
};

export const getProfiles = createSelector(
  getNotificationProfileSyncDisabled,
  getNotificationProfileData,
  (
    syncDisabled: boolean,
    state: NotificationProfilesStateType
  ): ReadonlyArray<NotificationProfileType> => {
    const notDeleted = state.profiles.filter(
      profile =>
        profile.deletedAtTimestampMs == null ||
        profile.deletedAtTimestampMs === 0
    );

    if (syncDisabled) {
      return notDeleted.filter(profile => !profile.storageID);
    }

    return notDeleted;
  }
);

export const getDeletedProfiles = createSelector(
  getNotificationProfileSyncDisabled,
  getNotificationProfileData,
  (
    syncDisabled: boolean,
    state: NotificationProfilesStateType
  ): ReadonlyArray<NotificationProfileType> => {
    const deleted = state.profiles.filter(
      profile =>
        profile.deletedAtTimestampMs != null &&
        profile.deletedAtTimestampMs !== 0
    );

    if (syncDisabled) {
      return deleted.filter(profile => !profile.storageID);
    }

    return deleted;
  }
);

export const getLoading = createSelector(
  getNotificationProfileData,
  (state: NotificationProfilesStateType): boolean => {
    return state.loading;
  }
);

export const getOverride = createSelector(
  getNotificationProfileData,
  (
    state: NotificationProfilesStateType
  ): NotificationProfileOverride | undefined => {
    return state.override;
  }
);

export const getCurrentState = createSelector(
  getNotificationProfileData,
  (state: NotificationProfilesStateType): NextProfileEvent => {
    return state.currentState;
  }
);

export const getActiveProfile = createSelector(
  getNotificationProfileData,
  (
    state: NotificationProfilesStateType
  ): NotificationProfileType | undefined => {
    return state.activeProfile;
  }
);
