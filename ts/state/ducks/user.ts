// State

export type UserStateType = {
  ourNumber: string;
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourNumber: string;
    ourPrimary: string;
  };
};

export type UserActionType = UserChangedActionType;

// Action Creators

export const actions = {
  userChanged,
};

function userChanged(attributes: { ourNumber: string; ourPrimary: string }): UserChangedActionType {
  return {
    type: 'USER_CHANGED',
    payload: attributes,
  };
}

// Reducer

function getEmptyState(): UserStateType {
  return {
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
