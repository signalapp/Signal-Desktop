// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { ReadonlyDeep } from 'type-fest';
import type { UsernameReservationType } from '../../types/Username';
import {
  ReserveUsernameError,
  ConfirmUsernameResult,
} from '../../types/Username';
import * as usernameServices from '../../services/username';
import { storageServiceUploadJob } from '../../services/storage';
import type { ReserveUsernameResultType } from '../../services/username';
import { missingCaseError } from '../../util/missingCaseError';
import { sleep } from '../../util/sleep';
import { assertDev } from '../../util/assert';
import type { StateType as RootStateType } from '../reducer';
import type { PromiseAction } from '../util';
import { getMe } from '../selectors/conversations';
import { getUsernameCorrupted } from '../selectors/items';
import {
  UsernameEditState,
  UsernameLinkState,
  UsernameReservationState,
  UsernameReservationError,
} from './usernameEnums';
import { showToast } from './toast';
import { ToastType } from '../../types/Toast';
import type { ToastActionType } from './toast';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

export type UsernameReservationStateType = ReadonlyDeep<{
  state: UsernameReservationState;
  recoveredUsername?: string;
  reservation?: UsernameReservationType;
  error?: UsernameReservationError;
  abortController?: AbortController;
}>;

export type UsernameStateType = ReadonlyDeep<{
  // ProfileEditor
  editState: UsernameEditState;

  // UsernameLinkModalBody
  linkState: UsernameLinkState;

  // EditUsernameModalBody
  usernameReservation: UsernameReservationStateType;
}>;

// Actions

const SET_USERNAME_EDIT_STATE = 'username/SET_USERNAME_EDIT_STATE';
const OPEN_USERNAME_RESERVATION_MODAL = 'username/OPEN_RESERVATION_MODAL';
const CLOSE_USERNAME_RESERVATION_MODAL = 'username/CLOSE_RESERVATION_MODAL';
const SET_USERNAME_RESERVATION_ERROR = 'username/SET_RESERVATION_ERROR';
const CLEAR_USERNAME_RESERVATION = 'username/CLEAR_RESERVATION';
const RESERVE_USERNAME = 'username/RESERVE_USERNAME';
const CONFIRM_USERNAME = 'username/CONFIRM_USERNAME';
const DELETE_USERNAME = 'username/DELETE_USERNAME';
const RESET_USERNAME_LINK = 'username/RESET_USERNAME_LINK';

type SetUsernameEditStateActionType = ReadonlyDeep<{
  type: typeof SET_USERNAME_EDIT_STATE;
  payload: {
    editState: UsernameEditState;
  };
}>;

type OpenUsernameReservationModalActionType = ReadonlyDeep<{
  type: typeof OPEN_USERNAME_RESERVATION_MODAL;
}>;

type CloseUsernameReservationModalActionType = ReadonlyDeep<{
  type: typeof CLOSE_USERNAME_RESERVATION_MODAL;
}>;

type SetUsernameReservationErrorActionType = ReadonlyDeep<{
  type: typeof SET_USERNAME_RESERVATION_ERROR;
  payload: {
    error: UsernameReservationError | undefined;
  };
}>;

type ClearUsernameReservationActionType = ReadonlyDeep<{
  type: typeof CLEAR_USERNAME_RESERVATION;
}>;

type ReserveUsernameActionType = ReadonlyDeep<
  PromiseAction<
    typeof RESERVE_USERNAME,
    ReserveUsernameResultType | undefined,
    { abortController: AbortController }
  >
>;
type ConfirmUsernameActionType = ReadonlyDeep<
  PromiseAction<typeof CONFIRM_USERNAME, ConfirmUsernameResult>
>;
type DeleteUsernameActionType = ReadonlyDeep<
  PromiseAction<typeof DELETE_USERNAME, void>
>;
type ResetUsernameLinkActionType = ReadonlyDeep<
  PromiseAction<typeof RESET_USERNAME_LINK, void>
>;

export type UsernameActionType = ReadonlyDeep<
  | SetUsernameEditStateActionType
  | OpenUsernameReservationModalActionType
  | CloseUsernameReservationModalActionType
  | SetUsernameReservationErrorActionType
  | ClearUsernameReservationActionType
  | ReserveUsernameActionType
  | ConfirmUsernameActionType
  | DeleteUsernameActionType
  | ResetUsernameLinkActionType
>;

export const actions = {
  setUsernameEditState,
  openUsernameReservationModal,
  closeUsernameReservationModal,
  setUsernameReservationError,
  clearUsernameReservation,
  reserveUsername,
  confirmUsername,
  deleteUsername,
  markCompletedUsernameOnboarding,
  resetUsernameLink,
  setUsernameLinkColor,
  markCompletedUsernameLinkOnboarding,
};

export const useUsernameActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function setUsernameEditState(
  editState: UsernameEditState
): SetUsernameEditStateActionType {
  return {
    type: SET_USERNAME_EDIT_STATE,
    payload: { editState },
  };
}

export function openUsernameReservationModal(): OpenUsernameReservationModalActionType {
  return {
    type: OPEN_USERNAME_RESERVATION_MODAL,
  };
}

export function closeUsernameReservationModal(): CloseUsernameReservationModalActionType {
  return {
    type: CLOSE_USERNAME_RESERVATION_MODAL,
  };
}

export function setUsernameReservationError(
  error: UsernameReservationError | undefined
): SetUsernameReservationErrorActionType {
  return {
    type: SET_USERNAME_RESERVATION_ERROR,
    payload: { error },
  };
}

export function clearUsernameReservation(): ClearUsernameReservationActionType {
  return {
    type: CLEAR_USERNAME_RESERVATION,
  };
}

const INPUT_DELAY_MS = 500;

export type ReserveUsernameOptionsType = ReadonlyDeep<{
  nickname: string;
  customDiscriminator?: string;
  doReserveUsername?: typeof usernameServices.reserveUsername;
  delay?: number;
}>;

export function reserveUsername({
  nickname,
  customDiscriminator,
  doReserveUsername = usernameServices.reserveUsername,
  delay = INPUT_DELAY_MS,
}: ReserveUsernameOptionsType): ThunkAction<
  void,
  RootStateType,
  unknown,
  ReserveUsernameActionType | SetUsernameReservationErrorActionType
> {
  return (dispatch, getState) => {
    if (!nickname) {
      return;
    }

    const { username } = getMe(getState());

    const abortController = new AbortController();
    const { signal: abortSignal } = abortController;

    const run = async () => {
      try {
        await sleep(delay, abortSignal);
      } catch {
        // Aborted
        return;
      }

      return doReserveUsername({
        previousUsername: username,
        nickname,
        customDiscriminator,
        abortSignal,
      });
    };

    dispatch({
      type: RESERVE_USERNAME,
      payload: run(),
      meta: { abortController },
    });
  };
}

export type ConfirmUsernameOptionsType = ReadonlyDeep<{
  doConfirmUsername?: typeof usernameServices.confirmUsername;
}>;

export function confirmUsername({
  doConfirmUsername = usernameServices.confirmUsername,
}: ConfirmUsernameOptionsType = {}): ThunkAction<
  void,
  RootStateType,
  unknown,
  ConfirmUsernameActionType | SetUsernameReservationErrorActionType
> {
  return (dispatch, getState) => {
    const { reservation } = getState().username.usernameReservation;
    if (reservation === undefined) {
      assertDev(false, 'This should not happen');
      dispatch(setUsernameReservationError(UsernameReservationError.General));
      return;
    }

    dispatch({
      type: CONFIRM_USERNAME,
      payload: doConfirmUsername(reservation),
    });
  };
}

export type DeleteUsernameOptionsType = ReadonlyDeep<{
  doDeleteUsername?: typeof usernameServices.deleteUsername;

  // Only for testing
  username?: string;
}>;

export function deleteUsername({
  doDeleteUsername = usernameServices.deleteUsername,
  username: defaultUsername,
}: DeleteUsernameOptionsType = {}): ThunkAction<
  void,
  RootStateType,
  unknown,
  DeleteUsernameActionType | ToastActionType
> {
  return (dispatch, getState) => {
    const me = getMe(getState());
    const isUsernameCorrupted = getUsernameCorrupted(getState());
    const username = me.username ?? defaultUsername;

    if (!username && !isUsernameCorrupted) {
      return;
    }

    const run = async () => {
      try {
        await doDeleteUsername(username);
      } catch {
        dispatch(showToast({ toastType: ToastType.FailedToDeleteUsername }));
      }
    };

    dispatch({
      type: DELETE_USERNAME,
      payload: run(),
    });
  };
}

export type ResetUsernameLinkOptionsType = ReadonlyDeep<{
  doResetLink?: typeof usernameServices.resetLink;
}>;

export function resetUsernameLink({
  doResetLink = usernameServices.resetLink,
}: ResetUsernameLinkOptionsType = {}): ThunkAction<
  void,
  RootStateType,
  unknown,
  ResetUsernameLinkActionType
> {
  return dispatch => {
    const me = window.ConversationController.getOurConversationOrThrow();
    const username = me.get('username');
    assertDev(username, 'Username is required for resetting link');

    dispatch({
      type: RESET_USERNAME_LINK,
      payload: doResetLink(username),
    });
  };
}

function markCompletedUsernameOnboarding(): ThunkAction<
  void,
  RootStateType,
  unknown,
  never
> {
  return async () => {
    await window.storage.put('hasCompletedUsernameOnboarding', true);
    const me = window.ConversationController.getOurConversationOrThrow();
    me.captureChange('usernameOnboarding');
    storageServiceUploadJob({ reason: 'markCompletedUsernameOnboarding' });
  };
}

function markCompletedUsernameLinkOnboarding(): ThunkAction<
  void,
  RootStateType,
  unknown,
  never
> {
  return async () => {
    await window.storage.put('hasCompletedUsernameLinkOnboarding', true);
  };
}

function setUsernameLinkColor(
  color: number
): ThunkAction<void, RootStateType, unknown, never> {
  return async () => {
    await window.storage.put('usernameLinkColor', color);
    const me = window.ConversationController.getOurConversationOrThrow();
    me.captureChange('usernameLinkColor');
    storageServiceUploadJob({ reason: 'setUsernameLinkColor' });
  };
}

// Reducers

export function getEmptyState(): UsernameStateType {
  return {
    editState: UsernameEditState.Editing,
    linkState: UsernameLinkState.Ready,
    usernameReservation: {
      state: UsernameReservationState.Closed,
    },
  };
}

export function reducer(
  state: Readonly<UsernameStateType> = getEmptyState(),
  action: Readonly<UsernameActionType>
): UsernameStateType {
  const { usernameReservation } = state;

  if (action.type === OPEN_USERNAME_RESERVATION_MODAL) {
    return {
      ...state,
      editState: UsernameEditState.Editing,
      linkState: UsernameLinkState.Ready,
      usernameReservation: {
        state: UsernameReservationState.Open,
      },
    };
  }

  if (action.type === SET_USERNAME_EDIT_STATE) {
    const { editState } = action.payload;
    return {
      ...state,
      editState,
    };
  }

  if (action.type === CLOSE_USERNAME_RESERVATION_MODAL) {
    return {
      ...state,
      usernameReservation: {
        state: UsernameReservationState.Closed,
      },
    };
  }

  if (action.type === SET_USERNAME_RESERVATION_ERROR) {
    const { error } = action.payload;
    return {
      ...state,
      usernameReservation: {
        ...usernameReservation,
        error,
        reservation: undefined,
      },
    };
  }

  if (action.type === CLEAR_USERNAME_RESERVATION) {
    return {
      ...state,
      usernameReservation: {
        ...usernameReservation,
        error: undefined,
        reservation: undefined,
      },
    };
  }

  if (action.type === 'username/RESERVE_USERNAME_PENDING') {
    usernameReservation.abortController?.abort();

    const { meta } = action;
    return {
      ...state,
      usernameReservation: {
        ...usernameReservation,
        error: undefined,
        state: UsernameReservationState.Reserving,
        abortController: meta.abortController,
      },
    };
  }

  if (action.type === 'username/RESERVE_USERNAME_FULFILLED') {
    const { meta } = action;

    // New reservation is pending
    if (meta.abortController !== usernameReservation.abortController) {
      return state;
    }

    assertDev(
      usernameReservation.state === UsernameReservationState.Reserving,
      'Must be reserving before resolving reservation'
    );

    const { payload } = action;
    assertDev(
      payload !== undefined,
      'Payload can be undefined only when aborted'
    );
    if (!payload.ok) {
      const { error } = payload;
      let stateError: UsernameReservationError;
      if (error === ReserveUsernameError.Unprocessable) {
        stateError = UsernameReservationError.CheckCharacters;
      } else if (error === ReserveUsernameError.Conflict) {
        stateError = UsernameReservationError.UsernameNotAvailable;
      } else if (error === ReserveUsernameError.NotEnoughCharacters) {
        stateError = UsernameReservationError.NotEnoughCharacters;
      } else if (error === ReserveUsernameError.TooManyCharacters) {
        stateError = UsernameReservationError.TooManyCharacters;
      } else if (error === ReserveUsernameError.CheckStartingCharacter) {
        stateError = UsernameReservationError.CheckStartingCharacter;
      } else if (error === ReserveUsernameError.CheckCharacters) {
        stateError = UsernameReservationError.CheckCharacters;
      } else if (error === ReserveUsernameError.NotEnoughDiscriminator) {
        stateError = UsernameReservationError.NotEnoughDiscriminator;
      } else if (error === ReserveUsernameError.AllZeroDiscriminator) {
        stateError = UsernameReservationError.AllZeroDiscriminator;
      } else if (error === ReserveUsernameError.LeadingZeroDiscriminator) {
        stateError = UsernameReservationError.LeadingZeroDiscriminator;
      } else if (error === ReserveUsernameError.TooManyAttempts) {
        stateError = UsernameReservationError.TooManyAttempts;
      } else {
        throw missingCaseError(error);
      }
      return {
        ...state,
        usernameReservation: {
          state: UsernameReservationState.Open,
          error: stateError,
        },
      };
    }

    const { reservation } = payload;
    return {
      ...state,
      usernameReservation: {
        state: UsernameReservationState.Open,
        reservation,
      },
    };
  }

  if (action.type === 'username/RESERVE_USERNAME_REJECTED') {
    const { meta } = action;

    // New reservation is pending
    if (meta.abortController !== usernameReservation.abortController) {
      return state;
    }

    assertDev(
      usernameReservation.state === UsernameReservationState.Reserving,
      'Must be reserving before rejecting reservation'
    );

    return {
      ...state,
      usernameReservation: {
        state: UsernameReservationState.Open,
        error: UsernameReservationError.General,
      },
    };
  }

  if (action.type === 'username/CONFIRM_USERNAME_PENDING') {
    assertDev(
      usernameReservation.state === UsernameReservationState.Open,
      'Must be open before confirmation'
    );
    return {
      ...state,
      usernameReservation: {
        reservation: usernameReservation.reservation,
        state: UsernameReservationState.Confirming,
      },
    };
  }

  if (action.type === 'username/CONFIRM_USERNAME_FULFILLED') {
    assertDev(
      usernameReservation.state === UsernameReservationState.Confirming,
      'Must be reserving before resolving confirmation'
    );

    const { payload } = action;
    if (payload === ConfirmUsernameResult.Ok) {
      return {
        ...state,
        usernameReservation: {
          state: UsernameReservationState.Closed,
        },
      };
    }
    if (payload === ConfirmUsernameResult.OkRecovered) {
      const { reservation } = state.usernameReservation;
      assertDev(
        reservation !== undefined,
        'Must be reserving before resolving confirmation'
      );
      return {
        ...state,
        usernameReservation: {
          state: UsernameReservationState.Closed,
          recoveredUsername: reservation.username,
        },
      };
    }
    if (payload === ConfirmUsernameResult.ConflictOrGone) {
      return {
        ...state,
        usernameReservation: {
          reservation: state.usernameReservation.reservation,
          state: UsernameReservationState.Open,
          error: UsernameReservationError.ConflictOrGone,
        },
      };
    }
    throw missingCaseError(payload);
  }

  if (action.type === 'username/CONFIRM_USERNAME_REJECTED') {
    assertDev(
      usernameReservation.state === UsernameReservationState.Confirming,
      'Must be reserving before rejecting reservation'
    );

    return {
      ...state,
      usernameReservation: {
        state: UsernameReservationState.Open,
        error: UsernameReservationError.General,
      },
    };
  }

  if (action.type === 'username/DELETE_USERNAME_PENDING') {
    return {
      ...state,
      editState: UsernameEditState.Deleting,
    };
  }

  if (action.type === 'username/DELETE_USERNAME_FULFILLED') {
    return {
      ...state,
      editState: UsernameEditState.Editing,
    };
  }

  if (action.type === 'username/DELETE_USERNAME_REJECTED') {
    assertDev(false, 'Should never reject');
    return state;
  }

  if (action.type === 'username/RESET_USERNAME_LINK_PENDING') {
    return {
      ...state,
      linkState: UsernameLinkState.Updating,
    };
  }

  if (action.type === 'username/RESET_USERNAME_LINK_FULFILLED') {
    return {
      ...state,
      linkState: UsernameLinkState.Ready,
    };
  }

  if (action.type === 'username/RESET_USERNAME_LINK_REJECTED') {
    return {
      ...state,
      linkState: UsernameLinkState.Error,
    };
  }

  return state;
}
