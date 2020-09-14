import { take, uniq } from 'lodash';
import { EmojiPickDataType } from '../../components/emoji/EmojiPicker';
import dataInterface from '../../sql/Client';
import { useBoundActions } from '../../util/hooks';

const { updateEmojiUsage } = dataInterface;

// State

export type EmojisStateType = {
  readonly recents: Array<string>;
};

// Actions

type OnUseEmojiPayloadType = string;
type OnUseEmojiAction = {
  type: 'emojis/USE_EMOJI';
  payload: Promise<OnUseEmojiPayloadType>;
};
type OnUseEmojiFulfilledAction = {
  type: 'emojis/USE_EMOJI_FULFILLED';
  payload: OnUseEmojiPayloadType;
};

export type EmojisActionType = OnUseEmojiAction | OnUseEmojiFulfilledAction;

// Action Creators

export const actions = {
  onUseEmoji,
};

export const useActions = (): typeof actions => useBoundActions(actions);

function onUseEmoji({ shortName }: EmojiPickDataType): OnUseEmojiAction {
  return {
    type: 'emojis/USE_EMOJI',
    payload: doUseEmoji(shortName),
  };
}

async function doUseEmoji(shortName: string): Promise<OnUseEmojiPayloadType> {
  await updateEmojiUsage(shortName);

  return shortName;
}

// Reducer

function getEmptyState(): EmojisStateType {
  return {
    recents: [],
  };
}

export function reducer(
  state: EmojisStateType = getEmptyState(),
  action: EmojisActionType
): EmojisStateType {
  if (action.type === 'emojis/USE_EMOJI_FULFILLED') {
    const { payload } = action;

    return {
      ...state,
      recents: take(uniq([payload, ...state.recents]), 32),
    };
  }

  return state;
}
