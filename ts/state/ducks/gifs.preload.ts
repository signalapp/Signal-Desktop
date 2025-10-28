// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';
import lodash from 'lodash';
import type { GifType } from '../../components/fun/panels/FunPanelGifs.dom.js';
import { DataWriter } from '../../sql/Client.preload.js';
import {
  type BoundActionCreatorsMapObject,
  useBoundActions,
} from '../../hooks/useBoundActions.std.js';

const { take } = lodash;

const { addRecentGif, removeRecentGif } = DataWriter;

export const MAX_RECENT_GIFS = 64;

type RecentGifs = ReadonlyDeep<Array<GifType>>;

// State

export type GifsStateType = ReadonlyDeep<{
  recentGifs: RecentGifs;
}>;

// Actions

const GIFS_RECENT_GIFS_ADD = 'gifs/RECENT_GIFS_ADD';
const GIFS_RECENT_GIFS_REMOVE = 'gifs/RECENT_GIFS_REMOVE';

export type GifsRecentGifsAdd = ReadonlyDeep<{
  type: typeof GIFS_RECENT_GIFS_ADD;
  payload: GifType;
}>;

export type GifsRecentGifsRemove = ReadonlyDeep<{
  type: typeof GIFS_RECENT_GIFS_REMOVE;
  payload: Pick<GifType, 'id'>;
}>;

type GifsActionType = ReadonlyDeep<GifsRecentGifsAdd | GifsRecentGifsRemove>;

// Action Creators

export const actions = {
  onAddRecentGif,
  onRemoveRecentGif,
};

export const useGifsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function onAddRecentGif(
  payload: GifType
): ThunkAction<void, unknown, unknown, GifsRecentGifsAdd> {
  return async dispatch => {
    await addRecentGif(payload, Date.now(), MAX_RECENT_GIFS);
    dispatch({ type: GIFS_RECENT_GIFS_ADD, payload });
  };
}

function onRemoveRecentGif(
  payload: Pick<GifType, 'id'>
): ThunkAction<void, unknown, unknown, GifsRecentGifsRemove> {
  return async dispatch => {
    await removeRecentGif(payload);
    dispatch({ type: GIFS_RECENT_GIFS_REMOVE, payload });
  };
}

function filterRecentGif(
  prev: ReadonlyArray<GifType>,
  gifId: GifType['id']
): ReadonlyArray<GifType> {
  return prev.filter(gif => gif.id !== gifId);
}

function addOrMoveRecentGifToStart(prev: RecentGifs, gif: GifType): RecentGifs {
  // Make sure there isn't a duplicate item in the array
  const filtered = filterRecentGif(prev, gif.id);
  // Make sure final array isn't too long
  const limited = take(filtered, MAX_RECENT_GIFS - 1);
  return [gif, ...limited];
}

// Reducer

export function getEmptyState(): GifsStateType {
  return { recentGifs: [] };
}

export function reducer(
  state: GifsStateType = getEmptyState(),
  action: GifsActionType
): GifsStateType {
  if (action.type === GIFS_RECENT_GIFS_ADD) {
    const { payload } = action;
    return {
      ...state,
      recentGifs: addOrMoveRecentGifToStart(state.recentGifs, payload),
    };
  }

  if (action.type === GIFS_RECENT_GIFS_REMOVE) {
    const { payload } = action;
    return {
      ...state,
      recentGifs: filterRecentGif(state.recentGifs, payload.id),
    };
  }

  return state;
}
