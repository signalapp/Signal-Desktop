import { AnyAction } from 'redux';
import { LocalizerType } from '../../types/Util';

// State

export type UserStateType = {
  attachmentsPath: string;
  stickersPath: string;
  tempPath: string;
  ourNumber: string;
  regionCode: string;
  i18n: LocalizerType;
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourNumber: string;
    regionCode: string;
  };
};

export type UserActionType = AnyAction | UserChangedActionType;

// Action Creators

export const actions = {
  userChanged,
};

function userChanged(attributes: {
  ourNumber: string;
  regionCode: string;
}): UserChangedActionType {
  return {
    type: 'USER_CHANGED',
    payload: attributes,
  };
}

// Reducer

function getEmptyState(): UserStateType {
  return {
    attachmentsPath: 'missing',
    stickersPath: 'missing',
    tempPath: 'missing',
    ourNumber: 'missing',
    regionCode: 'missing',
    i18n: () => 'missing',
  };
}

export function reducer(
  state: UserStateType = getEmptyState(),
  action: UserActionType
): UserStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'USER_CHANGED') {
    const { payload } = action;

    return {
      ...state,
      ...payload,
    };
  }

  return state;
}
