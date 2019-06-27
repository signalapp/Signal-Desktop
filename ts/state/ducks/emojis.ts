import { take, uniq } from 'lodash';
import { EmojiPickDataType } from '../../components/emoji/EmojiPicker';
import { updateEmojiUsage } from '../../../js/modules/data';

// State

export type EmojisStateType = {
  readonly recents: Array<string>;
};

// Actions

type UseEmojiPayloadType = string;
type UseEmojiAction = {
  type: 'emojis/USE_EMOJI';
  payload: Promise<UseEmojiPayloadType>;
};
type UseEmojiFulfilledAction = {
  type: 'emojis/USE_EMOJI_FULFILLED';
  payload: UseEmojiPayloadType;
};

export type EmojisActionType = UseEmojiAction | UseEmojiFulfilledAction;

// Action Creators

export const actions = {
  useEmoji,
};

function useEmoji({ shortName }: EmojiPickDataType): UseEmojiAction {
  return {
    type: 'emojis/USE_EMOJI',
    payload: doUseEmoji(shortName),
  };
}

async function doUseEmoji(shortName: string): Promise<UseEmojiPayloadType> {
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
