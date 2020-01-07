import { LocalizerType } from '../../types/Util';

// State

export type UserStateType = {
  attachmentsPath: string;
  stickersPath: string;
  tempPath: string;
  ourNumber: string;
  platform: string;
  regionCode: string;
  i18n: LocalizerType;
  interactionMode: 'mouse' | 'keyboard';
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourNumber?: string;
    regionCode?: string;
    interactionMode?: 'mouse' | 'keyboard';
  };
};

export type UserActionType = UserChangedActionType;

// Action Creators

export const actions = {
  userChanged,
};

function userChanged(attributes: {
  interactionMode?: 'mouse' | 'keyboard';
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
    platform: 'missing',
    interactionMode: 'mouse',
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
