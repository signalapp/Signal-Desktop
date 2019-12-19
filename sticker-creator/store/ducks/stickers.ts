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
import { clamp, isNumber, pull, take, uniq } from 'lodash';
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
  readonly tooLarge: number;
  readonly animated: number;
  readonly imagesAdded: number;
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
  tooLarge: 0,
  animated: 0,
  imagesAdded: 0,
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
        state.animated = clamp(state.animated + 1, 0, state.order.length);
        pull(state.order, payload.path);
        delete state.data[payload.path];
      } else if (payload.buffer.byteLength > maxByteSize) {
        state.tooLarge = clamp(state.tooLarge + 1, 0, state.order.length);
        pull(state.order, payload.path);
        delete state.data[payload.path];
      } else {
        const data = state.data[payload.path];

        if (data) {
          data.webp = payload;
          state.imagesAdded = clamp(
            state.imagesAdded + 1,
            0,
            state.order.length
          );
        }
      }

      adjustCover(state);
    }),

    handleAction(removeSticker, (state, { payload }) => {
      pull(state.order, payload);
      delete state.data[payload];
      adjustCover(state);
      state.imagesAdded = clamp(state.imagesAdded - 1, 0, state.order.length);
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

    handleAction(resetStatus, state => {
      state.tooLarge = 0;
      state.animated = 0;
      state.imagesAdded = 0;
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
export const useHasTooLarge = () =>
  useSelector(({ stickers }: AppState) => stickers.tooLarge > 0);
export const useHasAnimated = () =>
  useSelector(({ stickers }: AppState) => stickers.animated > 0);
export const useImageAddedCount = () =>
  useSelector(({ stickers }: AppState) => stickers.imagesAdded);
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
      reset: () => dispatch(reset()),
      resetStatus: () => dispatch(resetStatus()),
    }),
    [dispatch]
  );
};
