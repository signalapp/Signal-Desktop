import { reject } from 'lodash';
import dataInterface from '../../sql/Client';

const { updateGifLastUsed } = dataInterface;

type GifId = string;

export type GifsStateType = Readonly<{
  recentGifs: Array<GifId>;
}>;

type UseGifAction = {
  type: 'gifs/USE_GIF';
  payload: Promise<GifId>;
};
type UseGifFulfilledAction = {
  type: 'gifs/USE_GIF_FULFILLED';
  payload: GifId;
};

export type GifsActionType = UseGifFulfilledAction;

export const actions = {
  useGif,
};

function useGif(gifId: GifId, time?: number): UseGifAction {
  return {
    type: 'gifs/USE_GIF',
    payload: doUseGif(gifId, time),
  };
}

async function doUseGif(gifId: GifId, time = Date.now()): Promise<GifId> {
  await updateGifLastUsed(gifId, time);
  return gifId;
}

// Reducer
export function getEmptyState(): GifsStateType {
  return {
    recentGifs: [],
  };
}

export function reducer(
  state: Readonly<GifsStateType> = getEmptyState(),
  action: Readonly<GifsActionType>
): GifsStateType {
  if (action.type === 'gifs/USE_GIF_FULFILLED') {
    const { payload: usedGifId } = action;
    const { recentGifs } = state;

    const filteredRecents = reject(recentGifs, currId => currId === usedGifId);
    return {
      recentGifs: [usedGifId, ...filteredRecents],
    };
  }
  return state;
}
