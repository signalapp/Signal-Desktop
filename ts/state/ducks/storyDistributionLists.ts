// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUIDStringType } from '../../types/UUID';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type StoryDistributionListDataType = {
  id: UUIDStringType;
  name: string;
  allowsReplies: boolean;
  isBlockList: boolean;
};

export type StoryDistributionListStateType = {
  distributionLists: Array<StoryDistributionListDataType>;
};

// Actions

export const CREATE_LIST = 'storyDistributionLists/CREATE_LIST';
export const MODIFY_LIST = 'storyDistributionLists/MODIFY_LIST';

type CreateListActionType = {
  type: typeof CREATE_LIST;
  payload: StoryDistributionListDataType;
};

export type ModifyListActionType = {
  type: typeof MODIFY_LIST;
  payload: StoryDistributionListDataType;
};

type StoryDistributionListsActionType =
  | CreateListActionType
  | ModifyListActionType;

// Action Creators

function createDistributionList(
  distributionList: StoryDistributionListDataType
): CreateListActionType {
  return {
    type: CREATE_LIST,
    payload: distributionList,
  };
}

function modifyDistributionList(
  distributionList: StoryDistributionListDataType
): ModifyListActionType {
  return {
    type: MODIFY_LIST,
    payload: distributionList,
  };
}

export const actions = {
  createDistributionList,
  modifyDistributionList,
};

export const useStoryDistributionListsActions = (): typeof actions =>
  useBoundActions(actions);

// Reducer

export function getEmptyState(): StoryDistributionListStateType {
  return {
    distributionLists: [],
  };
}

export function reducer(
  state: Readonly<StoryDistributionListStateType> = getEmptyState(),
  action: Readonly<StoryDistributionListsActionType>
): StoryDistributionListStateType {
  if (action.type === MODIFY_LIST) {
    const { payload } = action;
    const distributionLists = [...state.distributionLists];

    const existingList = distributionLists.find(list => list.id === payload.id);
    if (existingList) {
      Object.assign(existingList, payload);
    } else {
      distributionLists.concat(payload);
    }

    return {
      distributionLists: [...distributionLists],
    };
  }

  if (action.type === CREATE_LIST) {
    return {
      distributionLists: [...state.distributionLists, action.payload],
    };
  }

  return state;
}
