// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup
// Minimal Redux state preserved for backward compatibility

import type { ReadonlyDeep } from 'type-fest';
import type { BadgeType } from '../../badges/types.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';

// State

export type BadgesStateType = ReadonlyDeep<{
  byId: Record<string, BadgeType>;
}>;

// Actions

const IMAGE_FILE_DOWNLOADED = 'badges/IMAGE_FILE_DOWNLOADED';
const UPDATE_OR_CREATE = 'badges/UPDATE_OR_CREATE';

type ImageFileDownloadedActionType = ReadonlyDeep<{
  type: typeof IMAGE_FILE_DOWNLOADED;
  payload: { url: string; localPath: string };
}>;

type UpdateOrCreateActionType = ReadonlyDeep<{
  type: typeof UPDATE_OR_CREATE;
  payload: Array<BadgeType>;
}>;

// Action creators

export const actions = {
  badgeImageFileDownloaded,
  updateOrCreate,
};

export const useBadgesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function badgeImageFileDownloaded(
  url: string,
  localPath: string
): ImageFileDownloadedActionType {
  return {
    type: IMAGE_FILE_DOWNLOADED,
    payload: { url, localPath },
  };
}

function updateOrCreate(badges: ReadonlyArray<BadgeType>): UpdateOrCreateActionType {
  return {
    type: UPDATE_OR_CREATE,
    payload: badges as Array<BadgeType>,
  };
}

// Reducer

export function getEmptyState(): BadgesStateType {
  return { byId: {} };
}

export function reducer(
  state: Readonly<BadgesStateType> = getEmptyState(),
  action: Readonly<ImageFileDownloadedActionType | UpdateOrCreateActionType>
): BadgesStateType {
  return state;
}
