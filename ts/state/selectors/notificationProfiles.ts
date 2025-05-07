// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import * as log from '../../logging/log';

import type { StateType } from '../reducer';
import type { NotificationProfilesStateType } from '../ducks/notificationProfiles';
import {
  redactNotificationProfileId,
  type NextProfileEvent,
  type NotificationProfileOverride,
  type NotificationProfileType,
} from '../../types/NotificationProfile';

export const getNotificationProfileData = (
  state: StateType
): NotificationProfilesStateType => {
  return state.notificationProfiles;
};

export const getProfiles = createSelector(
  getNotificationProfileData,
  (
    state: NotificationProfilesStateType
  ): ReadonlyArray<NotificationProfileType> => {
    return state.profiles.filter(
      profile => profile.deletedAtTimestampMs == null
    );
  }
);

export const getDeletedProfiles = createSelector(
  getNotificationProfileData,
  (
    state: NotificationProfilesStateType
  ): ReadonlyArray<NotificationProfileType> => {
    return state.profiles.filter(
      profile => profile.deletedAtTimestampMs != null
    );
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
  getCurrentState,
  getProfiles,
  (
    state: NextProfileEvent,
    profiles: ReadonlyArray<NotificationProfileType>
  ): NotificationProfileType | undefined => {
    let profileId: string;

    if (state.type === 'noChange' && state.activeProfile) {
      profileId = state.activeProfile;
    } else if (state.type === 'willDisable') {
      profileId = state.activeProfile;
    } else {
      return undefined;
    }

    const profile = profiles.find(item => item.id === profileId);
    if (!profile) {
      log.warn(
        `getActiveProfile: currentState referred to profileId ${redactNotificationProfileId(profileId)} not in the list`
      );
    }

    return profile;
  }
);
