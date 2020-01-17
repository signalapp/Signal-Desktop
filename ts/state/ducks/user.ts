import { LocalizerType } from '../../types/Util';

// State

export type UserStateType = {
  ourNumber: string;
  regionCode: string;
  isSecondaryDevice: boolean;
  i18n: LocalizerType;
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourNumber: string;
    regionCode: string;
    isSecondaryDevice: boolean;
  };
};

export type UserActionType = UserChangedActionType;

// Action Creators

export const actions = {
  userChanged,
};

function userChanged(attributes: {
  ourNumber: string;
  regionCode: string;
  isSecondaryDevice: boolean;
}): UserChangedActionType {
  return {
    type: 'USER_CHANGED',
    payload: attributes,
  };
}

// Reducer

function getEmptyState(): UserStateType {
  return {
    ourNumber: 'missing',
    regionCode: 'missing',
    isSecondaryDevice: false,
    i18n: () => 'missing',
  };
}

export function reducer(
  state: UserStateType,
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
