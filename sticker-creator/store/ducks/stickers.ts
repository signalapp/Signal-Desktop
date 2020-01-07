// tslint:disable no-dynamic-delete

import { useMemo } from 'react';
import {
  createAction,
  Draft,
  handleAction,
  reduceReducers,
} from 'redux-ts-utils';
import { useDispatch, useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { clamp, find, isNumber, pull, remove, take, uniq } from 'lodash';
import { SortEnd } from 'react-sortable-hoc';
import arrayMove from 'array-move';
import { AppState } from '../reducer';
import { PackMetaData, WebpData } from '../../util/preload';
import { EmojiPickDataType } from '../../../ts/components/emoji/EmojiPicker';
import { convertShortName } from '../../../ts/components/emoji/lib';

export const initializeStickers = createAction<Array<string>>(
  'stickers/initializeStickers'
);
export const addWebp = createAction<WebpData>('stickers/addSticker');
export const removeSticker = createAction<string>('stickers/removeSticker');
export const moveSticker = createAction<SortEnd>('stickers/moveSticker');
export const setCover = createAction<WebpData>('stickers/setCover');
export const resetCover = createAction<WebpData>('stickers/resetCover');
export const setEmoji = createAction<{ id: string; emoji: EmojiPickDataType }>(
  'stickers/setEmoji'
);
export const setTitle = createAction<string>('stickers/setTitle');
export const setAuthor = createAction<string>('stickers/setAuthor');
export const setPackMeta = createAction<PackMetaData>('stickers/setPackMeta');

export const addToast = createAction<{
  key: string;
  subs?: Array<number | string>;
}>('stickers/addToast');
export const dismissToast = createAction<void>('stickers/dismissToast');

export const resetStatus = createAction<void>('stickers/resetStatus');
export const reset = createAction<void>('stickers/reset');

export const minStickers = 4;
export const maxStickers = 200;
export const maxByteSize = 100 * 1024;

export type State = {
  readonly order: Array<string>;
  readonly cover?: WebpData;
  readonly title: string;
  readonly author: string;
  readonly packId: string;
  readonly packKey: string;
  readonly toasts: Array<{ key: string; subs?: Array<number | string> }>;
  readonly data: {
    readonly [src: string]: {
      readonly webp?: WebpData;
      readonly emoji?: EmojiPickDataType;
    };
  };
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
    state.cover = state.data[first].webp;
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

    handleAction(addWebp, (state, { payload }) => {
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

        // If we are adding webp data, proceed to update the state and add/update a toast
        if (data && !data.webp) {
          data.webp = payload;

          const key = 'StickerCreator--Toasts--imagesAdded';

          const toast = (() => {
            const oldToast = find(state.toasts, { key });

            if (oldToast) {
              return oldToast;
            }

            const newToast = { key, subs: [0] };
            state.toasts.push(newToast);

            return newToast;
          })();

          if (toast.subs && isNumber(toast.subs[0])) {
            toast.subs[0] = (toast.subs[0] || 0) + 1;
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

export const useTitle = () =>
  useSelector(({ stickers }: AppState) => stickers.title);
export const useAuthor = () =>
  useSelector(({ stickers }: AppState) => stickers.author);

export const useCover = () =>
  useSelector(({ stickers }: AppState) => stickers.cover);

export const useStickerOrder = () =>
  useSelector(({ stickers }: AppState) => stickers.order);

export const useStickerData = (src: string) =>
  useSelector(({ stickers }: AppState) => stickers.data[src]);

export const useStickersReady = () =>
  useSelector(
    ({ stickers }: AppState) =>
      stickers.order.length >= minStickers &&
      stickers.order.length <= maxStickers &&
      Object.values(stickers.data).every(({ webp }) => !!webp)
  );

export const useEmojisReady = () =>
  useSelector(({ stickers }: AppState) =>
    Object.values(stickers.data).every(({ emoji }) => !!emoji)
  );

export const useAllDataValid = () => {
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

export const usePackUrl = () => useSelector(selectUrl);
export const useToasts = () =>
  useSelector(({ stickers }: AppState) => stickers.toasts);
export const useAddMoreCount = () =>
  useSelector(({ stickers }: AppState) =>
    clamp(minStickers - stickers.order.length, 0, minStickers)
  );

const selectOrderedData = createSelector(
  ({ stickers }: AppState) => stickers.order,
  ({ stickers }) => stickers.data,
  (order, data) =>
    order.map(id => ({
      ...data[id],
      emoji: convertShortName(
        data[id].emoji.shortName,
        data[id].emoji.skinTone
      ),
    }))
);

export const useSelectOrderedData = () => useSelector(selectOrderedData);

const selectOrderedImagePaths = createSelector(selectOrderedData, data =>
  data.map(({ webp }) => webp.src)
);

export const useOrderedImagePaths = () => useSelector(selectOrderedImagePaths);

export const useStickerActions = () => {
  const dispatch = useDispatch();

  return useMemo(
    () => ({
      addWebp: (data: WebpData) => dispatch(addWebp(data)),
      initializeStickers: (paths: Array<string>) =>
        dispatch(initializeStickers(paths)),
      removeSticker: (src: string) => dispatch(removeSticker(src)),
      moveSticker: (sortEnd: SortEnd) => dispatch(moveSticker(sortEnd)),
      setCover: (webp: WebpData) => dispatch(setCover(webp)),
      setEmoji: (p: { id: string; emoji: EmojiPickDataType }) =>
        dispatch(setEmoji(p)),
      setTitle: (title: string) => dispatch(setTitle(title)),
      setAuthor: (author: string) => dispatch(setAuthor(author)),
      setPackMeta: (e: PackMetaData) => dispatch(setPackMeta(e)),
      addToast: (key: string, subs?: Array<number>) =>
        dispatch(addToast({ key, subs })),
      dismissToast: () => dispatch(dismissToast()),
      reset: () => dispatch(reset()),
      resetStatus: () => dispatch(resetStatus()),
    }),
    [dispatch]
  );
};
