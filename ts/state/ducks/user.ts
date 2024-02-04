// State

export type UserStateType = {
  ourDisplayNameInProfile: string;
  ourNumber: string;
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourDisplayNameInProfile: string;
    ourNumber: string;
    ourPrimary: string;
  };
};

export type UserActionType = UserChangedActionType;

// Action Creators

export const actions = {
  userChanged,
};

function userChanged(attributes: {
  ourDisplayNameInProfile: string;
  ourNumber: string;
  ourPrimary: string;
}): UserChangedActionType {
  return {
    type: 'USER_CHANGED',
    payload: attributes,
  };
}

// Reducer

function getEmptyState(): UserStateType {
  return {
    ourDisplayNameInProfile: '',
    ourNumber: 'missing',
  };
}

export function reducer(state: UserStateType, action: UserActionType): UserStateType {
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
