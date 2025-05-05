// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { update as updateProfileService } from '../../services/notificationProfilesService';
import { strictAssert } from '../../util/assert';
import {
  type BoundActionCreatorsMapObject,
  useBoundActions,
} from '../../hooks/useBoundActions';
import { DataWriter } from '../../sql/Client';
import { sortProfiles } from '../../types/NotificationProfile';

import type {
  NextProfileEvent,
  NotificationProfileOverride,
  NotificationProfileType,
} from '../../types/NotificationProfile';

const {
  updateNotificationProfile,
  createNotificationProfile,
  markNotificationProfileDeleted,
} = DataWriter;

// State

export type NotificationProfilesStateType = ReadonlyDeep<{
  currentState: NextProfileEvent;
  override: NotificationProfileOverride | undefined;
  profiles: ReadonlyArray<NotificationProfileType>;
}>;

// Actions

const CREATE_PROFILE = 'NotificationProfiles/CREATE_PROFILE';
const MARK_PROFILE_DELETED = 'NotificationProfiles/MARK_PROFILE_DELETED';
const REMOVE_PROFILE = 'NotificationProfiles/REMOVE_PROFILE';
const UPDATE_CURRENT_STATE = 'NotificationProfiles/UPDATE_CURRENT_STATE';
const UPDATE_OVERRIDE = 'NotificationProfiles/UPDATE_OVERRIDE';
const UPDATE_PROFILE = 'NotificationProfiles/UPDATE_PROFILE';

export type CreateProfile = ReadonlyDeep<{
  type: typeof CREATE_PROFILE;
  payload: NotificationProfileType;
}>;

export type RemoveProfile = ReadonlyDeep<{
  type: typeof REMOVE_PROFILE;
  payload: string;
}>;

export type MarkProfileDeleted = ReadonlyDeep<{
  type: typeof MARK_PROFILE_DELETED;
  payload: {
    id: string;
    deletedAtTimestampMs: number;
  };
}>;

export type UpdateCurrentState = ReadonlyDeep<{
  type: typeof UPDATE_CURRENT_STATE;
  payload: NextProfileEvent;
}>;

export type UpdateOverride = ReadonlyDeep<{
  type: typeof UPDATE_OVERRIDE;
  payload: NotificationProfileOverride | undefined;
}>;

export type UpdateProfile = ReadonlyDeep<{
  type: typeof UPDATE_PROFILE;
  payload: NotificationProfileType;
}>;

type NotificationProfilesActionType = ReadonlyDeep<
  | CreateProfile
  | MarkProfileDeleted
  | RemoveProfile
  | UpdateCurrentState
  | UpdateOverride
  | UpdateProfile
>;

// Action Creators

export const actions = {
  createProfile,
  profileWasCreated,
  profileWasRemoved,
  profileWasUpdated,
  markProfileDeleted,
  updateCurrentState,
  updateOverride,
  updateProfile,
};

export const useNotificationProfilesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function createProfile(
  payload: NotificationProfileType
): ThunkAction<void, unknown, unknown, CreateProfile> {
  return async dispatch => {
    await createNotificationProfile(payload);
    dispatch({
      type: CREATE_PROFILE,
      payload,
    });
    updateProfileService();
  };
}

function markProfileDeleted(
  id: string
): ThunkAction<void, unknown, unknown, MarkProfileDeleted> {
  return async dispatch => {
    // Here we just set deletedAtTimestampMs, which removes it from the UI but keeps
    // it around for agreement between devices in storage service.
    const deletedAtTimestampMs = await markNotificationProfileDeleted(id);
    strictAssert(
      deletedAtTimestampMs,
      'removeProfile: expected when marking profile deleted'
    );
    dispatch({
      type: MARK_PROFILE_DELETED,
      payload: {
        id,
        deletedAtTimestampMs,
      },
    });
    updateProfileService();
  };
}

function updateCurrentState(payload: NextProfileEvent): UpdateCurrentState {
  // No need for a thunk - redux is the source of truth, and it's only kept in memory
  return {
    type: UPDATE_CURRENT_STATE,
    payload,
  };
}

function updateOverride(
  payload: NotificationProfileOverride | undefined
): ThunkAction<void, unknown, unknown, UpdateOverride> {
  return async dispatch => {
    await window.storage.put('notificationProfileOverride', payload);
    dispatch({
      type: UPDATE_OVERRIDE,
      payload,
    });
    updateProfileService();
  };
}

function updateProfile(
  payload: NotificationProfileType
): ThunkAction<void, unknown, unknown, UpdateProfile> {
  return async dispatch => {
    await updateNotificationProfile(payload);
    dispatch({
      type: UPDATE_PROFILE,
      payload,
    });
    updateProfileService();
  };
}

// Used for storage service, where the updates go directly to the database
function profileWasCreated(payload: NotificationProfileType): CreateProfile {
  updateProfileService();
  return {
    type: CREATE_PROFILE,
    payload,
  };
}

// Used for storage service, where the updates go directly to the database
function profileWasUpdated(payload: NotificationProfileType): UpdateProfile {
  updateProfileService();
  return {
    type: UPDATE_PROFILE,
    payload,
  };
}

// Used for when cleaning out profiles that were marked deleted long ago
function profileWasRemoved(payload: string): RemoveProfile {
  updateProfileService();
  return {
    type: REMOVE_PROFILE,
    payload,
  };
}

// Reducer

export function getEmptyState(): NotificationProfilesStateType {
  return {
    currentState: { type: 'noChange', activeProfile: undefined },
    override: undefined,
    profiles: [],
  };
}

export function reducer(
  state: NotificationProfilesStateType = getEmptyState(),
  action: NotificationProfilesActionType
): NotificationProfilesStateType {
  if (action.type === CREATE_PROFILE) {
    const { payload } = action;
    return {
      ...state,
      profiles: sortProfiles([payload, ...state.profiles]),
    };
  }

  if (action.type === MARK_PROFILE_DELETED) {
    const { payload } = action;
    const { id, deletedAtTimestampMs } = payload;

    return {
      ...state,
      profiles: state.profiles.map(item => {
        if (item.id === id) {
          return { ...item, deletedAtTimestampMs };
        }
        return item;
      }),
    };
  }

  if (action.type === REMOVE_PROFILE) {
    const { payload } = action;

    return {
      ...state,
      profiles: state.profiles.filter(item => item.id !== payload),
    };
  }

  if (action.type === UPDATE_CURRENT_STATE) {
    const { payload } = action;
    return {
      ...state,
      currentState: payload,
    };
  }

  if (action.type === UPDATE_OVERRIDE) {
    const { payload } = action;
    return {
      ...state,
      override: payload,
    };
  }

  if (action.type === UPDATE_PROFILE) {
    const { payload } = action;
    return {
      ...state,
      profiles: state.profiles.map(item => {
        if (item.id === payload.id) {
          return payload;
        }

        return item;
      }),
    };
  }

  return state;
}
