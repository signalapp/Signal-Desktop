// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-param-reassign */

import { useMemo } from 'react';
import type { Draft } from 'redux-ts-utils';
import { createAction, handleAction, reduceReducers } from 'redux-ts-utils';
import { useDispatch, useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import {
  clamp,
  find,
  isNumber,
  isString,
  pull,
  remove,
  take,
  uniq,
} from 'lodash';
import type { SortEnd } from 'react-sortable-hoc';
import { bindActionCreators } from 'redux';
import arrayMove from 'array-move';
import type { AppState } from '../reducer';
import type {
  PackMetaData,
  StickerImageData,
  StickerData,
} from '../../util/preload';
import type { EmojiPickDataType } from '../../../ts/components/emoji/EmojiPicker';
import { convertShortName } from '../../../ts/components/emoji/lib';
import { isNotNil } from '../../../ts/util/isNotNil';

export const initializeStickers = createAction<Array<string>>(
  'stickers/initializeStickers'
);
export const addImageData = createAction<StickerImageData>(
  'stickers/addSticker'
);
export const removeSticker = createAction<string>('stickers/removeSticker');
export const moveSticker = createAction<SortEnd>('stickers/moveSticker');
export const setCover = createAction<StickerImageData>('stickers/setCover');
export const resetCover = createAction<StickerImageData>('stickers/resetCover');
export const setEmoji =
  createAction<{ id: string; emoji: EmojiPickDataType }>('stickers/setEmoji');
export const setTitle = createAction<string>('stickers/setTitle');
export const setAuthor = createAction<string>('stickers/setAuthor');
export const setPackMeta = createAction<PackMetaData>('stickers/setPackMeta');

export const addToast = createAction<{
  key: string;
  subs?: Array<string>;
}>('stickers/addToast');
export const dismissToast = createAction<void>('stickers/dismissToast');

export const resetStatus = createAction<void>('stickers/resetStatus');
export const reset = createAction<void>('stickers/reset');

export const minStickers = 1;
export const maxStickers = 200;
export const maxByteSize = 300 * 1024;

type StateStickerData = {
  readonly imageData?: StickerImageData;
  readonly emoji?: EmojiPickDataType;
};

type StateToastData = {
  key: string;
  subs?: Array<string>;
};

export type State = {
  readonly order: Array<string>;
  readonly cover?: StickerImageData;
  readonly title: string;
  readonly author: string;
  readonly packId: string;
  readonly packKey: string;
  readonly toasts: Array<StateToastData>;
  readonly data: {
    readonly [src: string]: StateStickerData;
  };
};

export type Actions = {
  addImageData: typeof addImageData;
  initializeStickers: typeof initializeStickers;
  removeSticker: typeof removeSticker;
  moveSticker: typeof moveSticker;
  setCover: typeof setCover;
  setEmoji: typeof setEmoji;
  setTitle: typeof setTitle;
  setAuthor: typeof setAuthor;
  setPackMeta: typeof setPackMeta;
  addToast: typeof addToast;
  dismissToast: typeof dismissToast;
  reset: typeof reset;
  resetStatus: typeof resetStatus;
};

const defaultState: State = {
  order: [],
  data: {},
  title: '',
  author: '',
  packId: '',
  packKey: '',
  toasts: [],
};

const adjustCover = (state: Draft<State>) => {
  const first = state.order[0];

  if (first) {
    state.cover = state.data[first].imageData;
  } else {
    delete state.cover;
  }
};

export const reducer = reduceReducers<State>(
  [
    handleAction(initializeStickers, (state, { payload }) => {
      const truncated = take(
        uniq([...state.order, ...payload]),
        maxStickers - state.order.length
      );
      truncated.forEach(path => {
        if (!state.data[path]) {
          state.data[path] = {};
          state.order.push(path);
        }
      });
    }),

    handleAction(addImageData, (state, { payload }) => {
      if (isNumber(payload.meta.pages)) {
        state.toasts.push({ key: 'StickerCreator--Toasts--animated' });
        pull(state.order, payload.path);
        delete state.data[payload.path];
      } else if (payload.buffer.byteLength > maxByteSize) {
        state.toasts.push({ key: 'StickerCreator--Toasts--tooLarge' });
        pull(state.order, payload.path);
        delete state.data[payload.path];
      } else {
        const data = state.data[payload.path];

        // If we are adding image data, proceed to update the state and add/update a toast
        if (data && !data.imageData) {
          data.imageData = payload;

          const key = 'StickerCreator--Toasts--imagesAdded';

          const toast = (() => {
            const oldToast = find(state.toasts, { key });

            if (oldToast) {
              return oldToast;
            }

            const newToast = { key, subs: ['0'] };
            state.toasts.push(newToast);

            return newToast;
          })();

          const previousSub = toast?.subs?.[0];
          if (toast && isString(previousSub)) {
            const previousCount = parseInt(previousSub, 10);
            const newCount = Number.isFinite(previousCount)
              ? previousCount + 1
              : 1;

            toast.subs = toast.subs || [];
            toast.subs[0] = newCount.toString();
          }
        }
      }

      adjustCover(state);
    }),

    handleAction(removeSticker, (state, { payload }) => {
      pull(state.order, payload);
      delete state.data[payload];
      adjustCover(state);
    }),

    handleAction(moveSticker, (state, { payload }) => {
      arrayMove.mutate(state.order, payload.oldIndex, payload.newIndex);
    }),

    handleAction(setCover, (state, { payload }) => {
      state.cover = payload;
    }),

    handleAction(resetCover, state => {
      adjustCover(state);
    }),

    handleAction(setEmoji, (state, { payload }) => {
      const data = state.data[payload.id];
      if (data) {
        data.emoji = payload.emoji;
      }
    }),

    handleAction(setTitle, (state, { payload }) => {
      state.title = payload;
    }),

    handleAction(setAuthor, (state, { payload }) => {
      state.author = payload;
    }),

    handleAction(setPackMeta, (state, { payload: { packId, key } }) => {
      state.packId = packId;
      state.packKey = key;
    }),

    handleAction(addToast, (state, { payload: toast }) => {
      remove(state.toasts, { key: toast.key });
      state.toasts.push(toast);
    }),

    handleAction(dismissToast, state => {
      state.toasts.pop();
    }),

    handleAction(resetStatus, state => {
      state.toasts = [];
    }),

    handleAction(reset, () => defaultState),
  ],
  defaultState
);

export const useTitle = (): string =>
  useSelector(({ stickers }: AppState) => stickers.title);

export const useAuthor = (): string =>
  useSelector(({ stickers }: AppState) => stickers.author);

export const useCover = (): StickerImageData | undefined =>
  useSelector(({ stickers }: AppState) => stickers.cover);

export const useStickerOrder = (): Array<string> =>
  useSelector(({ stickers }: AppState) => stickers.order);

export const useStickerData = (src: string): StateStickerData =>
  useSelector(({ stickers }: AppState) => stickers.data[src]);

export const useStickersReady = (): boolean =>
  useSelector(
    ({ stickers }: AppState) =>
      stickers.order.length >= minStickers &&
      stickers.order.length <= maxStickers &&
      Object.values(stickers.data).every(({ imageData }) => Boolean(imageData))
  );

export const useEmojisReady = (): boolean =>
  useSelector(({ stickers }: AppState) =>
    Object.values(stickers.data).every(({ emoji }) => !!emoji)
  );

export const useAllDataValid = (): boolean => {
  const stickersReady = useStickersReady();
  const emojisReady = useEmojisReady();
  const cover = useCover();
  const title = useTitle();
  const author = useAuthor();

  return !!(stickersReady && emojisReady && cover && title && author);
};

const selectUrl = createSelector(
  ({ stickers }: AppState) => stickers.packId,
  ({ stickers }: AppState) => stickers.packKey,
  (id, key) => `https://signal.art/addstickers/#pack_id=${id}&pack_key=${key}`
);

export const usePackUrl = (): string => useSelector(selectUrl);

export const useToasts = (): Array<StateToastData> =>
  useSelector(({ stickers }: AppState) => stickers.toasts);

export const useAddMoreCount = (): number =>
  useSelector(({ stickers }: AppState) =>
    clamp(minStickers - stickers.order.length, 0, minStickers)
  );

const selectOrderedData = createSelector(
  ({ stickers }: AppState) => stickers.order,
  ({ stickers }: AppState) => stickers.data,
  (order, data) =>
    order.map(id => ({
      ...data[id],
      emoji: convertShortName(
        (data[id].emoji as EmojiPickDataType).shortName,
        (data[id].emoji as EmojiPickDataType).skinTone
      ),
    }))
);

export const useSelectOrderedData = (): Array<StickerData> =>
  useSelector(selectOrderedData);

const selectOrderedImagePaths = createSelector(
  selectOrderedData,
  (data: Array<StickerData>) =>
    data.map(({ imageData }) => imageData?.src).filter(isNotNil)
);

export const useOrderedImagePaths = (): Array<string> =>
  useSelector(selectOrderedImagePaths);

export const useStickerActions = (): Actions => {
  const dispatch = useDispatch();

  return useMemo(
    () =>
      bindActionCreators(
        {
          addImageData,
          initializeStickers,
          removeSticker,
          moveSticker,
          setCover,
          setEmoji,
          setTitle,
          setAuthor,
          setPackMeta,
          addToast,
          dismissToast,
          reset,
          resetStatus,
        },
        dispatch
      ),
    [dispatch]
  );
};
