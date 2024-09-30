// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type { ThunkAction } from 'redux-thunk';

import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer';
import type { StoryDistributionWithMembersType } from '../../sql/Interface';
import type { StoryDistributionIdString } from '../../types/StoryDistributionId';
import type { ServiceIdString } from '../../types/ServiceId';
import * as log from '../../logging/log';
import { DataReader, DataWriter } from '../../sql/Client';
import { MY_STORY_ID } from '../../types/Stories';
import { generateStoryDistributionId } from '../../types/StoryDistributionId';
import { deleteStoryForEveryone } from '../../util/deleteStoryForEveryone';
import { replaceIndex } from '../../util/replaceIndex';
import { storageServiceUploadJob } from '../../services/storage';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type StoryDistributionListDataType = ReadonlyDeep<{
  id: StoryDistributionIdString;
  deletedAtTimestamp?: number;
  name: string;
  allowsReplies: boolean;
  isBlockList: boolean;
  memberServiceIds: Array<ServiceIdString>;
}>;

export type StoryDistributionListStateType = ReadonlyDeep<{
  distributionLists: Array<StoryDistributionListDataType>;
}>;

// Actions

const ALLOW_REPLIES_CHANGED = 'storyDistributionLists/ALLOW_REPLIES_CHANGED';
const CREATE_LIST = 'storyDistributionLists/CREATE_LIST';
export const DELETE_LIST = 'storyDistributionLists/DELETE_LIST';
export const HIDE_MY_STORIES_FROM =
  'storyDistributionLists/HIDE_MY_STORIES_FROM';
export const MODIFY_LIST = 'storyDistributionLists/MODIFY_LIST';
const RESET_MY_STORIES = 'storyDistributionLists/RESET_MY_STORIES';
export const VIEWERS_CHANGED = 'storyDistributionLists/VIEWERS_CHANGED';

type AllowRepliesChangedActionType = ReadonlyDeep<{
  type: typeof ALLOW_REPLIES_CHANGED;
  payload: {
    listId: string;
    allowsReplies: boolean;
  };
}>;

type CreateListActionType = ReadonlyDeep<{
  type: typeof CREATE_LIST;
  payload: StoryDistributionListDataType;
}>;

type DeleteListActionType = ReadonlyDeep<{
  type: typeof DELETE_LIST;
  payload: {
    listId: string;
    deletedAtTimestamp: number;
  };
}>;

type HideMyStoriesFromActionType = ReadonlyDeep<{
  type: typeof HIDE_MY_STORIES_FROM;
  payload: Array<ServiceIdString>;
}>;

type ModifyDistributionListType = ReadonlyDeep<
  Omit<StoryDistributionListDataType, 'memberServiceIds'> & {
    membersToAdd: Array<ServiceIdString>;
    membersToRemove: Array<ServiceIdString>;
  }
>;

export type ModifyListActionType = ReadonlyDeep<{
  type: typeof MODIFY_LIST;
  payload: ModifyDistributionListType;
}>;

type ResetMyStoriesActionType = ReadonlyDeep<{
  type: typeof RESET_MY_STORIES;
}>;

type ViewersChangedActionType = ReadonlyDeep<{
  type: typeof VIEWERS_CHANGED;
  payload: {
    listId: string;
    memberServiceIds: Array<ServiceIdString>;
  };
}>;

export type StoryDistributionListsActionType = ReadonlyDeep<
  | AllowRepliesChangedActionType
  | CreateListActionType
  | DeleteListActionType
  | HideMyStoriesFromActionType
  | ModifyListActionType
  | ResetMyStoriesActionType
  | ViewersChangedActionType
>;

// Action Creators

function allowsRepliesChanged(
  listId: string,
  allowsReplies: boolean
): ThunkAction<void, RootStateType, null, AllowRepliesChangedActionType> {
  return async dispatch => {
    const storyDistribution =
      await DataReader.getStoryDistributionWithMembers(listId);

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

    await DataWriter.modifyStoryDistribution({
      ...storyDistribution,
      allowsReplies,
      storageNeedsSync: true,
    });

    storageServiceUploadJob({
      reason: 'distributionLists/allowsRepliesChanged',
    });

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
  memberServiceIds: Array<ServiceIdString>,
  storageServiceDistributionListRecord?: StoryDistributionWithMembersType,
  shouldSave = true
): ThunkAction<
  Promise<StoryDistributionIdString>,
  RootStateType,
  string,
  CreateListActionType
> {
  return async dispatch => {
    const storyDistribution: StoryDistributionWithMembersType = {
      allowsReplies: true,
      id: generateStoryDistributionId(),
      isBlockList: false,
      members: memberServiceIds,
      name,
      senderKeyInfo: undefined,
      storageNeedsSync: true,
      ...(storageServiceDistributionListRecord || {}),
    };

    if (shouldSave) {
      await DataWriter.createNewStoryDistribution(storyDistribution);
    }

    if (storyDistribution.storageNeedsSync) {
      storageServiceUploadJob({ reason: 'createDistributionList' });
    }

    dispatch({
      type: CREATE_LIST,
      payload: {
        allowsReplies: Boolean(storyDistribution.allowsReplies),
        deletedAtTimestamp: storyDistribution.deletedAtTimestamp,
        id: storyDistribution.id,
        isBlockList: Boolean(storyDistribution.isBlockList),
        memberServiceIds,
        name: storyDistribution.name,
      },
    });

    return storyDistribution.id;
  };
}

function deleteDistributionList(
  listId: string
): ThunkAction<void, RootStateType, unknown, DeleteListActionType> {
  return async (dispatch, getState) => {
    const deletedAtTimestamp = Date.now();

    const storyDistribution =
      await DataReader.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn('No story distribution found for id', listId);
      return;
    }

    await DataWriter.modifyStoryDistributionWithMembers(
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

    const { stories } = getState().stories;
    const storiesToDelete = stories.filter(
      story => story.storyDistributionListId === listId
    );
    await Promise.all(
      storiesToDelete.map(story => deleteStoryForEveryone(stories, story))
    );

    log.info(
      'storyDistributionLists.deleteDistributionList: list deleted',
      listId
    );

    storageServiceUploadJob({ reason: 'deleteDistributionList' });

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
  memberServiceIds: Array<ServiceIdString>
): ThunkAction<void, RootStateType, null, HideMyStoriesFromActionType> {
  return async dispatch => {
    const myStories =
      await DataReader.getStoryDistributionWithMembers(MY_STORY_ID);

    if (!myStories) {
      log.error(
        'storyDistributionLists.hideMyStoriesFrom: Could not find My Stories!'
      );
      return;
    }

    const toAdd = new Set<ServiceIdString>(memberServiceIds);

    await DataWriter.modifyStoryDistributionWithMembers(
      {
        ...myStories,
        isBlockList: true,
        storageNeedsSync: true,
      },
      {
        toAdd: Array.from(toAdd),
        toRemove: myStories.members.filter(serviceId => !toAdd.has(serviceId)),
      }
    );

    storageServiceUploadJob({
      reason: 'storyDistributionLists/hideMyStoriesFrom',
    });

    await window.storage.put('hasSetMyStoriesPrivacy', true);

    dispatch({
      type: HIDE_MY_STORIES_FROM,
      payload: memberServiceIds,
    });
  };
}

function removeMembersFromDistributionList(
  listId: string,
  memberServiceIds: Array<ServiceIdString>
): ThunkAction<void, RootStateType, null, ModifyListActionType> {
  return async dispatch => {
    if (!memberServiceIds.length) {
      log.warn(
        'storyDistributionLists.removeMembersFromDistributionList cannot remove a member without serviceId',
        listId
      );
      return;
    }

    const storyDistribution =
      await DataReader.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn(
        'storyDistributionLists.removeMembersFromDistributionList: No story found for id',
        listId
      );
      return;
    }

    let toAdd: Array<ServiceIdString> = [];
    let toRemove: Array<ServiceIdString> = memberServiceIds;
    let { isBlockList } = storyDistribution;

    // My Story is set to 'All Signal Connections' or is already an exclude list
    if (
      listId === MY_STORY_ID &&
      (storyDistribution.members.length === 0 || isBlockList)
    ) {
      isBlockList = true;
      toAdd = memberServiceIds;
      toRemove = [];

      // The user has now configured My Stories
      await window.storage.put('hasSetMyStoriesPrivacy', true);
    }

    await DataWriter.modifyStoryDistributionWithMembers(
      {
        ...storyDistribution,
        isBlockList,
        storageNeedsSync: true,
      },
      {
        toAdd,
        toRemove,
      }
    );

    log.info(
      'storyDistributionLists.removeMembersFromDistributionList: removed',
      {
        listId,
        memberServiceIds,
      }
    );

    storageServiceUploadJob({ reason: 'removeMembersFromDistributionList' });

    dispatch({
      type: MODIFY_LIST,
      payload: {
        ...omit(storyDistribution, ['members']),
        isBlockList,
        storageNeedsSync: true,
        membersToAdd: toAdd,
        membersToRemove: toRemove,
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
    const myStories =
      await DataReader.getStoryDistributionWithMembers(MY_STORY_ID);

    if (!myStories) {
      log.error(
        'storyDistributionLists.setMyStoriesToAllSignalConnections: Could not find My Stories!'
      );
      return;
    }

    if (myStories.isBlockList || myStories.members.length > 0) {
      await DataWriter.modifyStoryDistributionWithMembers(
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

      storageServiceUploadJob({ reason: 'setMyStoriesToAllSignalConnections' });
    }

    await window.storage.put('hasSetMyStoriesPrivacy', true);

    dispatch({
      type: RESET_MY_STORIES,
    });
  };
}

function updateStoryViewers(
  listId: string,
  memberServiceIds: Array<ServiceIdString>
): ThunkAction<void, RootStateType, null, ViewersChangedActionType> {
  return async dispatch => {
    const storyDistribution =
      await DataReader.getStoryDistributionWithMembers(listId);

    if (!storyDistribution) {
      log.warn(
        'storyDistributionLists.updateStoryViewers: No story found for id',
        listId
      );
      return;
    }

    const existingServiceIds = new Set<ServiceIdString>(
      storyDistribution.members
    );
    const toAdd: Array<ServiceIdString> = [];

    memberServiceIds.forEach(serviceId => {
      if (!existingServiceIds.has(serviceId)) {
        toAdd.push(serviceId);
      }
    });

    const updatedServiceIds = new Set<ServiceIdString>(memberServiceIds);
    const toRemove: Array<ServiceIdString> = [];

    storyDistribution.members.forEach(serviceId => {
      if (!updatedServiceIds.has(serviceId)) {
        toRemove.push(serviceId);
      }
    });

    await DataWriter.modifyStoryDistributionWithMembers(
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

    storageServiceUploadJob({ reason: 'updateStoryViewers' });

    if (listId === MY_STORY_ID) {
      await window.storage.put('hasSetMyStoriesPrivacy', true);
    }

    dispatch({
      type: VIEWERS_CHANGED,
      payload: {
        listId,
        memberServiceIds,
      },
    });
  };
}

function removeMemberFromAllDistributionLists(
  member: ServiceIdString
): ThunkAction<void, RootStateType, null, ModifyListActionType> {
  return async dispatch => {
    const logId = `removeMemberFromAllDistributionLists(${member})`;
    const lists = await DataReader.getAllStoryDistributionsWithMembers();

    const listsWithMember = lists.filter(({ members }) =>
      members.includes(member)
    );
    log.info(
      `${logId}: removing ${member} from ${listsWithMember.length} lists`
    );

    for (const { id } of listsWithMember) {
      dispatch(removeMembersFromDistributionList(id, [member]));
    }
  };
}

export const actions = {
  allowsRepliesChanged,
  createDistributionList,
  deleteDistributionList,
  hideMyStoriesFrom,
  modifyDistributionList,
  removeMembersFromDistributionList,
  removeMemberFromAllDistributionLists,
  setMyStoriesToAllSignalConnections,
  updateStoryViewers,
};

export const useStoryDistributionListsActions =
  (): BoundActionCreatorsMapObject<typeof actions> => useBoundActions(actions);

// Reducer

export function getEmptyState(): StoryDistributionListStateType {
  return {
    distributionLists: [],
  };
}

function replaceDistributionListData(
  distributionLists: ReadonlyArray<StoryDistributionListDataType>,
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
      const memberServiceIds = new Set<ServiceIdString>(
        existingDistributionList.memberServiceIds
      );
      membersToAdd.forEach(serviceId => memberServiceIds.add(serviceId));
      membersToRemove.forEach(serviceId => memberServiceIds.delete(serviceId));

      return {
        distributionLists: replaceIndex(state.distributionLists, listIndex, {
          ...existingDistributionList,
          ...distributionListDetails,
          memberServiceIds: Array.from(memberServiceIds),
        }),
      };
    }

    return {
      distributionLists: [
        ...state.distributionLists,
        {
          ...distributionListDetails,
          memberServiceIds: membersToAdd,
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
        memberServiceIds: [],
        name: '',
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === HIDE_MY_STORIES_FROM) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      MY_STORY_ID,
      () => ({
        isBlockList: true,
        memberServiceIds: action.payload,
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
        memberServiceIds: Array.from(new Set(action.payload.memberServiceIds)),
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  if (action.type === RESET_MY_STORIES) {
    const distributionLists = replaceDistributionListData(
      state.distributionLists,
      MY_STORY_ID,
      () => ({
        isBlockList: true,
        memberServiceIds: [],
      })
    );

    return distributionLists ? { distributionLists } : state;
  }

  return state;
}
