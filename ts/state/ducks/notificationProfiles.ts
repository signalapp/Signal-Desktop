// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, difference } from 'lodash';

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { createLogger } from '../../logging/log.std.js';
import {
  update as updateProfileService,
  fastUpdate as fastUpdateProfileService,
} from '../../services/notificationProfilesService.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import {
  type BoundActionCreatorsMapObject,
  useBoundActions,
} from '../../hooks/useBoundActions.std.js';
import { DataWriter } from '../../sql/Client.preload.js';
import {
  redactNotificationProfileId,
  sortProfiles,
} from '../../types/NotificationProfile.std.js';
import { generateNotificationProfileId } from '../../types/NotificationProfile-node.node.js';
import { getOverride } from '../selectors/notificationProfiles.dom.js';
import { getItems } from '../selectors/items.dom.js';
import {
  prepareForDisabledNotificationProfileSync,
  prepareForEnabledNotificationProfileSync,
} from '../../services/storageRecordOps.preload.js';
import { storageServiceUploadJob } from '../../services/storage.preload.js';
import { SECOND } from '../../util/durations/constants.std.js';

import type {
  NextProfileEvent,
  NotificationProfileIdString,
  NotificationProfileOverride,
  NotificationProfileType,
} from '../../types/NotificationProfile.std.js';
import type { StateType } from '../reducer.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const log = createLogger('ducks/notificationProfiles');

const {
  updateNotificationProfile,
  createNotificationProfile,
  markNotificationProfileDeleted,
} = DataWriter;

// State

export type NotificationProfilesStateType = ReadonlyDeep<{
  activeProfile: NotificationProfileType | undefined;
  currentState: NextProfileEvent;
  loading: boolean;
  override: NotificationProfileOverride | undefined;
  profiles: ReadonlyArray<NotificationProfileType>;
}>;

// Actions

const CREATE_PROFILE = 'NotificationProfiles/CREATE_PROFILE';
const GLOBAL_UPDATE = 'NotificationProfiles/GLOBAL_UPDATE';
const MARK_PROFILE_DELETED = 'NotificationProfiles/MARK_PROFILE_DELETED';
const REMOVE_PROFILE = 'NotificationProfiles/REMOVE_PROFILE';
const UPDATE_CURRENT_STATE = 'NotificationProfiles/UPDATE_CURRENT_STATE';
const UPDATE_LOADING = 'NotificationProfiles/UPDATE_LOADING';
const UPDATE_OVERRIDE = 'NotificationProfiles/UPDATE_OVERRIDE';
const UPDATE_PROFILE = 'NotificationProfiles/UPDATE_PROFILE';

export type CreateProfile = ReadonlyDeep<{
  type: typeof CREATE_PROFILE;
  payload: NotificationProfileType;
}>;

export type GlobalUpdate = ReadonlyDeep<{
  type: typeof GLOBAL_UPDATE;
  payload: {
    toAdd: Array<NotificationProfileType>;
    toRemove: Array<NotificationProfileType>;
    newOverride: NotificationProfileOverride | undefined;
  };
}>;

export type MarkProfileDeleted = ReadonlyDeep<{
  type: typeof MARK_PROFILE_DELETED;
  payload: {
    id: string;
    deletedAtTimestampMs: number;
  };
}>;

export type RemoveProfile = ReadonlyDeep<{
  type: typeof REMOVE_PROFILE;
  payload: string;
}>;

export type UpdateCurrentState = ReadonlyDeep<{
  type: typeof UPDATE_CURRENT_STATE;
  payload: {
    currentState: NextProfileEvent;
    activeProfile: NotificationProfileType | undefined;
  };
}>;

export type UpdateLoading = ReadonlyDeep<{
  type: typeof UPDATE_LOADING;
  payload: boolean;
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
  | GlobalUpdate
  | MarkProfileDeleted
  | RemoveProfile
  | UpdateCurrentState
  | UpdateLoading
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
  setIsSyncEnabled,
  setProfileOverride,
  updateCurrentState,
  updateOverride,
  updateProfile,
};

export const useNotificationProfilesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

const updateStorageService = debounce(
  (reason: string, options: { force?: boolean } = {}) => {
    const disabled = itemStorage.get('notificationProfileSyncDisabled');
    if (disabled && !options.force) {
      return;
    }

    storageServiceUploadJob({
      reason,
    });
  },
  SECOND
);

function createProfile(
  profile: Omit<NotificationProfileType, 'id'>
): ThunkAction<void, unknown, unknown, CreateProfile> {
  return async dispatch => {
    // We must generate this id here, because we need crypto to generate random bytes, and
    // don't want to load that in our UI components.
    const id = generateNotificationProfileId();
    const payload = { ...profile, id };

    await createNotificationProfile(payload);
    dispatch({
      type: CREATE_PROFILE,
      payload,
    });
    fastUpdateProfileService();
    updateStorageService(`createProfile/${redactNotificationProfileId(id)}`);
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
    fastUpdateProfileService();
    updateStorageService(
      `markProfileDeleted/${redactNotificationProfileId(id)}`
    );
  };
}

// If called based on a local change, this function is run before the storage service
// upload. If called based on a storage service update, it is called at the end of
// processing, as the AccountRecord is processed. All profiles have been processed at
// that point, and the override from AccountRecord has been processed as well.
function setIsSyncEnabled(
  enabled: boolean,
  { fromStorageService }: { fromStorageService: boolean }
): ThunkAction<void, StateType, unknown, GlobalUpdate | UpdateLoading> {
  return async (dispatch, getState) => {
    const logId = `setIsSyncEnabled/enabled=${enabled}`;
    const items = getItems(getState());
    const disabled = !enabled;

    if (items.notificationProfileSyncDisabled === disabled) {
      log.warn('No change to current sync state, returning early');
      return;
    }

    // Because we can't update everything (itemStorage and our redux slice), there is
    // the risk of a flash of content on the list page when enabling/disabling sync. So
    // we set this loading flag and show something else until everything is ready.
    try {
      dispatch({
        type: UPDATE_LOADING,
        payload: true,
      });

      await itemStorage.put('notificationProfileSyncDisabled', disabled);
      if (disabled) {
        if (!fromStorageService) {
          const globalOverride = await itemStorage.get(
            'notificationProfileOverride'
          );

          await itemStorage.put(
            'notificationProfileOverrideFromPrimary',
            globalOverride
          );
        }
        const { toAdd, newOverride } =
          prepareForDisabledNotificationProfileSync();
        dispatch({
          type: GLOBAL_UPDATE,
          payload: {
            toAdd,
            toRemove: [],
            newOverride,
          },
        });
        await itemStorage.put('notificationProfileOverride', newOverride);
        await Promise.all(
          toAdd.map(async profile => {
            await DataWriter.createNotificationProfile(profile);
          })
        );
      } else {
        await itemStorage.put(
          'notificationProfileOverrideFromPrimary',
          undefined
        );
        const { toAdd, toRemove, newOverride } =
          prepareForEnabledNotificationProfileSync();
        dispatch({
          type: GLOBAL_UPDATE,
          payload: {
            toAdd,
            toRemove,
            newOverride,
          },
        });
        await itemStorage.put('notificationProfileOverride', newOverride);
        await Promise.all(
          toRemove.map(async profile => {
            await DataWriter.deleteNotificationProfileById(profile.id);
          })
        );
        await Promise.all(
          toAdd.map(async profile => {
            await DataWriter.createNotificationProfile(profile);
          })
        );
      }
    } finally {
      dispatch({
        type: UPDATE_LOADING,
        payload: false,
      });
    }

    if (!fromStorageService) {
      const me = window.ConversationController.getOurConversationOrThrow();
      me.captureChange(logId);
      // We need to force because we don't need to update storage service with sync
      // disabled - except in the case where we just disabled it.
      updateStorageService(logId, { force: true });
    }

    fastUpdateProfileService();
  };
}

function setProfileOverride(
  id: NotificationProfileIdString,
  enabled: boolean,
  endsAtMs?: number
): ThunkAction<void, StateType, unknown, UpdateOverride | UpdateLoading> {
  return async (dispatch, getState) => {
    const logId = `setProfileOverride/${redactNotificationProfileId(id)}/enabled=${enabled}`;
    const state = getState();
    const currentOverride = getOverride(state);

    const me = window.ConversationController.getOurConversationOrThrow();
    me.captureChange(logId);

    if (enabled) {
      if (
        currentOverride?.enabled &&
        currentOverride.enabled.profileId === id &&
        currentOverride.enabled.endsAtMs === endsAtMs
      ) {
        log.info(
          `${logId}: Requested override is already in place; doing nothing.`
        );
        return;
      }

      const newOverride: NotificationProfileOverride = {
        disabledAtMs: undefined,
        enabled: {
          profileId: id,
          endsAtMs,
        },
      };
      await itemStorage.put('notificationProfileOverride', newOverride);
      dispatch({
        type: UPDATE_OVERRIDE,
        payload: newOverride,
      });
      fastUpdateProfileService();
      updateStorageService(logId);

      return;
    }

    const newOverride: NotificationProfileOverride = {
      disabledAtMs: Date.now(),
      enabled: undefined,
    };
    await itemStorage.put('notificationProfileOverride', newOverride);
    dispatch({
      type: UPDATE_OVERRIDE,
      payload: newOverride,
    });
    fastUpdateProfileService();
    updateStorageService(logId);
  };
}

function updateProfile(
  payload: NotificationProfileType
): ThunkAction<void, unknown, unknown, UpdateProfile> {
  return async dispatch => {
    const newProfile = {
      ...payload,
      storageNeedsSync: true,
    };
    await updateNotificationProfile(newProfile);
    dispatch({
      type: UPDATE_PROFILE,
      payload: newProfile,
    });
    fastUpdateProfileService();
    updateStorageService(
      `updateProfile/${redactNotificationProfileId(newProfile.id)}`
    );
  };
}

function updateOverride(
  payload: NotificationProfileOverride | undefined,
  { fromStorageService }: { fromStorageService: boolean }
): ThunkAction<void, unknown, unknown, UpdateOverride> {
  return async dispatch => {
    const id = payload?.enabled?.profileId;
    const enabled = payload?.enabled;
    await itemStorage.put('notificationProfileOverride', payload);

    const logId = `updateOverride/${id ? redactNotificationProfileId(id) : 'undefined'}/enabled=${enabled}`;

    dispatch({
      type: UPDATE_OVERRIDE,
      payload,
    });

    if (!fromStorageService) {
      const me = window.ConversationController.getOurConversationOrThrow();
      me.captureChange(logId);
      updateStorageService(logId);
    }

    fastUpdateProfileService();
  };
}

function updateCurrentState(
  currentState: NextProfileEvent,
  activeProfile: NotificationProfileType | undefined
): UpdateCurrentState {
  // No need for a thunk - redux is the source of truth, and it's only kept in memory
  return {
    type: UPDATE_CURRENT_STATE,
    payload: {
      activeProfile,
      currentState,
    },
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
    activeProfile: undefined,
    currentState: { type: 'noChange', activeProfile: undefined },
    loading: false,
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

  if (action.type === GLOBAL_UPDATE) {
    const { toAdd, toRemove, newOverride } = action.payload;

    return {
      ...state,
      profiles: sortProfiles(
        difference(state.profiles, toRemove).concat(toAdd)
      ),
      override: newOverride,
    };
  }

  if (action.type === MARK_PROFILE_DELETED) {
    const { payload } = action;
    const { id, deletedAtTimestampMs } = payload;

    return {
      ...state,
      profiles: state.profiles.map(item => {
        if (item.id === id) {
          return {
            ...item,
            deletedAtTimestampMs,
            storageNeedsSync: true,
          };
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
    const { activeProfile, currentState } = payload;
    return {
      ...state,
      activeProfile,
      currentState,
    };
  }

  if (action.type === UPDATE_LOADING) {
    return {
      ...state,
      loading: action.payload,
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
