// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { StateType as RootStateType } from '../reducer';
import type { StoryDistributionWithMembersType } from '../../sql/Interface';
import type { UUIDStringType } from '../../types/UUID';
import * as log from '../../logging/log';
import dataInterface from '../../sql/Client';
import { MY_STORIES_ID } from '../../types/Stories';
import { UUID } from '../../types/UUID';
import { replaceIndex } from '../../util/replaceIndex';
import { storageServiceUploadJob } from '../../services/storage';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type StoryDistributionListDataType = {
  id: UUIDStringType;
  deletedAtTimestamp?: number;
  name: string;
  allowsReplies: boolean;
  isBlockList: boolean;
  memberUuids: Array<string>;
};

export type StoryDistributionListStateType = {
  distributionLists: Array<StoryDistributionListDataType>;
};

// Actions

const ALLOW_REPLIES_CHANGED = 'storyDistributionLists/ALLOW_REPLIES_CHANGED';
const CREATE_LIST = 'storyDistributionLists/CREATE_LIST';
const DELETE_LIST = 'storyDistributionLists/DELETE_LIST';
const HIDE_MY_STORIES_FROM = 'storyDistributionLists/HIDE_MY_STORIES_FROM';
const MODIFY_LIST = 'storyDistributionLists/MODIFY_LIST';
const REMOVE_MEMBER = 'storyDistributionLists/REMOVE_MEMBER';
const RESET_MY_STORIES = 'storyDistributionLists/RESET_MY_STORIES';
const VIEWERS_CHANGED = 'storyDistributionLists/VIEWERS_CHANGED';

type AllowRepliesChangedActionType = {
  type: typeof ALLOW_REPLIES_CHANGED;
  payload: {
    listId: string;
    allowsReplies: boolean;
  };
};

type CreateListActionType = {
  type: typeof CREATE_LIST;
  payload: StoryDistributionListDataType;
};

type DeleteListActionType = {
  type: typeof DELETE_LIST;
  payload: {
    listId: string;
    deletedAtTimestamp: number;
  };
};

type HideMyStoriesFromActionType = {
  type: typeof HIDE_MY_STORIES_FROM;
  payload: Array<string>;
};

type ModifyDistributionListType = Omit<
  StoryDistributionListDataType,
  'memberUuids'
> & {
  membersToAdd: Array<string>;
  membersToRemove: Array<string>;
};

export type ModifyListActionType = {
  type: typeof MODIFY_LIST;
  payload: ModifyDistributionListType;
};

type RemoveMemberActionType = {
  type: typeof REMOVE_MEMBER;
  payload: {
    listId: string;
    memberUuid: string;
  };
};

type ResetMyStoriesActionType = {
  type: typeof RESET_MY_STORIES;
};

type ViewersChangedActionType = {
  type: typeof VIEWERS_CHANGED;
  payload: {
    listId: string;
    memberUuids: Array<string>;
  };
};

type StoryDistributionListsActionType =
  | AllowRepliesChangedActionType
  | CreateListActionType
  | DeleteListActionType
  | HideMyStoriesFromActionType
  | ModifyListActionType
  | RemoveMemberActionType
  | ResetMyStoriesActionType
  | ViewersChangedActionType;

// Action Creators

function allowsRepliesChanged(
  listId: string,
  allowsReplies: boolean
): ThunkAction<void, RootStateType, null, AllowRepliesChangedActionType> {
  return async dispatch => {
    const storyDistribution =
      await dataInterface.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn(
        'storyDistributionLists.allowsRepliesChanged: No story found for id',
        listId
      );
      return;
    }

    if (storyDistribution.allowsReplies === allowsReplies) {
      log.warn(
        'storyDistributionLists.allowsRepliesChanged: story already has the same value',
        { listId, allowsReplies }
      );
      return;
    }

    await dataInterface.modifyStoryDistribution({
      ...storyDistribution,
      allowsReplies,
      storageNeedsSync: true,
    });

    storageServiceUploadJob();

    log.info(
      'storyDistributionLists.allowsRepliesChanged: allowsReplies has changed',
      listId
    );

    dispatch({
      type: ALLOW_REPLIES_CHANGED,
      payload: {
        listId,
        allowsReplies,
      },
    });
  };
}

function createDistributionList(
  name: string,
  memberUuids: Array<UUIDStringType>,
  storageServiceDistributionListRecord?: StoryDistributionWithMembersType,
  shouldSave = true
): ThunkAction<void, RootStateType, null, CreateListActionType> {
  return async dispatch => {
    const storyDistribution: StoryDistributionWithMembersType = {
      allowsReplies: true,
      id: UUID.generate().toString(),
      isBlockList: false,
      members: memberUuids,
      name,
      senderKeyInfo: undefined,
      storageNeedsSync: true,
      ...(storageServiceDistributionListRecord || {}),
    };

    if (shouldSave) {
      await dataInterface.createNewStoryDistribution(storyDistribution);
    }

    if (storyDistribution.storageNeedsSync) {
      storageServiceUploadJob();
    }

    dispatch({
      type: CREATE_LIST,
      payload: {
        allowsReplies: Boolean(storyDistribution.allowsReplies),
        deletedAtTimestamp: storyDistribution.deletedAtTimestamp,
        id: storyDistribution.id,
        isBlockList: Boolean(storyDistribution.isBlockList),
        memberUuids,
        name: storyDistribution.name,
      },
    });
  };
}

function deleteDistributionList(
  listId: string
): ThunkAction<void, RootStateType, unknown, DeleteListActionType> {
  return async dispatch => {
    const deletedAtTimestamp = Date.now();

    const storyDistribution =
      await dataInterface.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn('No story distribution found for id', listId);
      return;
    }

    await dataInterface.modifyStoryDistributionWithMembers(
      {
        ...storyDistribution,
        deletedAtTimestamp,
        name: '',
        storageNeedsSync: true,
      },
      {
        toAdd: [],
        toRemove: storyDistribution.members,
      }
    );

    log.info(
      'storyDistributionLists.deleteDistributionList: list deleted',
      listId
    );

    storageServiceUploadJob();

    dispatch({
      type: DELETE_LIST,
      payload: {
        listId,
        deletedAtTimestamp,
      },
    });
  };
}

function modifyDistributionList(
  distributionList: ModifyDistributionListType
): ModifyListActionType {
  return {
    type: MODIFY_LIST,
    payload: distributionList,
  };
}

function hideMyStoriesFrom(
  memberUuids: Array<UUIDStringType>
): ThunkAction<void, RootStateType, null, HideMyStoriesFromActionType> {
  return async dispatch => {
    const myStories = await dataInterface.getStoryDistributionWithMembers(
      MY_STORIES_ID
    );

    if (!myStories) {
      log.error(
        'storyDistributionLists.hideMyStoriesFrom: Could not find My Stories!'
      );
      return;
    }

    const toAdd = new Set<UUIDStringType>(memberUuids);

    await dataInterface.modifyStoryDistributionWithMembers(
      {
        ...myStories,
        isBlockList: true,
        storageNeedsSync: true,
      },
      {
        toAdd: Array.from(toAdd),
        toRemove: myStories.members.filter(uuid => !toAdd.has(uuid)),
      }
    );

    storageServiceUploadJob();

    dispatch({
      type: HIDE_MY_STORIES_FROM,
      payload: memberUuids,
    });
  };
}

function removeMemberFromDistributionList(
  listId: string,
  memberUuid: UUIDStringType | undefined
): ThunkAction<void, RootStateType, null, RemoveMemberActionType> {
  return async dispatch => {
    if (!memberUuid) {
      log.warn(
        'storyDistributionLists.removeMemberFromDistributionList cannot remove a member without uuid',
        listId
      );
      return;
    }

    const storyDistribution =
      await dataInterface.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn(
        'storyDistributionLists.removeMemberFromDistributionList: No story found for id',
        listId
      );
      return;
    }

    await dataInterface.modifyStoryDistributionWithMembers(
      {
        ...storyDistribution,
        storageNeedsSync: true,
      },
      {
        toAdd: [],
        toRemove: [memberUuid],
      }
    );

    log.info(
      'storyDistributionLists.removeMemberFromDistributionList: removed',
      {
        listId,
        memberUuid,
      }
    );

    storageServiceUploadJob();

    dispatch({
      type: REMOVE_MEMBER,
      payload: {
        listId,
        memberUuid,
      },
    });
  };
}

function setMyStoriesToAllSignalConnections(): ThunkAction<
  void,
  RootStateType,
  null,
  ResetMyStoriesActionType
> {
  return async dispatch => {
    const myStories = await dataInterface.getStoryDistributionWithMembers(
      MY_STORIES_ID
    );

    if (!myStories) {
      log.error(
        'storyDistributionLists.setMyStoriesToAllSignalConnections: Could not find My Stories!'
      );
      return;
    }

    if (myStories.isBlockList || myStories.members.length > 0) {
      await dataInterface.modifyStoryDistributionWithMembers(
        {
          ...myStories,
          isBlockList: true,
          storageNeedsSync: true,
        },
        {
          toAdd: [],
          toRemove: myStories.members,
        }
      );

      storageServiceUploadJob();
    }

    dispatch({
      type: RESET_MY_STORIES,
    });
  };
}

function updateStoryViewers(
  listId: string,
  memberUuids: Array<UUIDStringType>
): ThunkAction<void, RootStateType, null, ViewersChangedActionType> {
  return async dispatch => {
    const storyDistribution =
      await dataInterface.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn(
        'storyDistributionLists.updateStoryViewers: No story found for id',
        listId
      );
      return;
    }

    const existingUuids = new Set<UUIDStringType>(storyDistribution.members);
    const toAdd: Array<UUIDStringType> = [];

    memberUuids.forEach(uuid => {
      if (!existingUuids.has(uuid)) {
        toAdd.push(uuid);
      }
    });

    const updatedUuids = new Set<UUIDStringType>(memberUuids);
    const toRemove: Array<UUIDStringType> = [];

    storyDistribution.members.forEach(uuid => {
      if (!updatedUuids.has(uuid)) {
        toRemove.push(uuid);
      }
    });

    await dataInterface.modifyStoryDistributionWithMembers(
      {
        ...storyDistribution,
        isBlockList: false,
        storageNeedsSync: true,
      },
      {
        toAdd,
        toRemove,
      }
    );

    storageServiceUploadJob();

    dispatch({
      type: VIEWERS_CHANGED,
      payload: {
        listId,
        memberUuids,
      },
    });
  };
}

export const actions = {
  allowsRepliesChanged,
  createDistributionList,
  deleteDistributionList,
  hideMyStoriesFrom,
  modifyDistributionList,
  removeMemberFromDistributionList,
  setMyStoriesToAllSignalConnections,
  updateStoryViewers,
};

export const useStoryDistributionListsActions = (): typeof actions =>
  useBoundActions(actions);

// Reducer

export function getEmptyState(): StoryDistributionListStateType {
  return {
    distributionLists: [],
  };
}

function replaceDistributionListData(
  distributionLists: Array<StoryDistributionListDataType>,
  listId: string,
  getNextDistributionListData: (
    list: StoryDistributionListDataType
  ) => Partial<StoryDistributionListDataType>
): Array<StoryDistributionListDataType> | undefined {
  const listIndex = distributionLists.findIndex(list => list.id === listId);

  if (listIndex < 0) {
    return;
  }

  return replaceIndex(distributionLists, listIndex, {
    ...distributionLists[listIndex],
    ...getNextDistributionListData(distributionLists[listIndex]),
  });
}

export function reducer(
  state: Readonly<StoryDistributionListStateType> = getEmptyState(),
  action: Readonly<StoryDistributionListsActionType>
): StoryDistributionListStateType {
  if (action.type === MODIFY_LIST) {
    const { payload } = action;

    const { membersToAdd, membersToRemove, ...distributionListDetails } =
      payload;

    const listIndex = state.distributionLists.findIndex(
      list => list.id === distributionListDetails.id
    );
    if (listIndex >= 0) {
      const existingDistributionList = state.distributionLists[listIndex];
      const memberUuids = new Set<string>(existingDistributionList.memberUuids);
      membersToAdd.forEach(uuid => memberUuids.add(uuid));
      membersToRemove.forEach(uuid => memberUuids.delete(uuid));

      return {
        distributionLists: replaceIndex(state.distributionLists, listIndex, {
          ...existingDistributionList,
          ...distributionListDetails,
          memberUuids: Array.from(memberUuids),
        }),
      };
    }

    return {
      distributionLists: [
        ...state.distributionLists,
        {
          ...distributionListDetails,
          memberUuids: membersToAdd,
        },
      ],
    };
  }

  if (action.type === CREATE_LIST) {
    return {
      distributionLists: [...state.distributionLists, action.payload],
    };
  }

  if (action.type === DELETE_LIST) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      action.payload.listId,
      () => ({
        deletedAtTimestamp: action.payload.deletedAtTimestamp,
        memberUuids: [],
        name: '',
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === HIDE_MY_STORIES_FROM) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      MY_STORIES_ID,
      () => ({
        isBlockList: true,
        memberUuids: action.payload,
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === REMOVE_MEMBER) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      action.payload.listId,
      list => ({
        memberUuids: list.memberUuids.filter(
          uuid => uuid !== action.payload.memberUuid
        ),
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === ALLOW_REPLIES_CHANGED) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      action.payload.listId,
      () => ({
        allowsReplies: action.payload.allowsReplies,
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === VIEWERS_CHANGED) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      action.payload.listId,
      () => ({
        isBlockList: false,
        memberUuids: Array.from(new Set(action.payload.memberUuids)),
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === RESET_MY_STORIES) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      MY_STORIES_ID,
      () => ({
        isBlockList: false,
        memberUuids: [],
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  return state;
}
