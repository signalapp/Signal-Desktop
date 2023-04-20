// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-param-reassign */
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction, Draft } from '@reduxjs/toolkit';

import { ArtType, MAX_STICKERS, MAX_STICKER_BYTE_SIZE } from '../constants';
import { assert } from '../util/assert';
import type { ArtImageData, EmojiData } from '../types.d';

export type StateArtData = {
  emoji?: EmojiData;
  imageData?: ArtImageData;
};

export type StateToastData = {
  key: string;
  subs?: Record<string, string>;
};

export type ArtPath = string;

export type ArtOrder = Array<ArtPath>;

export type ArtState = {
  artType: ArtType;
  order: ArtOrder;
  cover?: ArtImageData;
  title: string;
  author: string;
  packId: string;
  packKey: string;
  toasts: ReadonlyArray<StateToastData>;
  data: Record<ArtPath, StateArtData>;
};

export type SetEmojiPayload = Readonly<{
  id: string;
  emoji: EmojiData;
}>;

export type SetEmojiNamePayload = Readonly<{
  id: string;
  name: string;
}>;

export type SetPackMetaPayload = Readonly<{
  packId: string;
  key: string;
}>;

const initialState: ArtState = {
  artType: ArtType.Sticker,
  order: [],
  data: {},
  title: '',
  author: '',
  packId: '',
  packKey: '',
  toasts: [],
};

const adjustCover = (state: Draft<ArtState>) => {
  const first = state.order[0];

  if (first) {
    state.cover = state.data[first]?.imageData;
  } else {
    delete state.cover;
  }
};

export const artSlice = createSlice({
  name: 'art',
  initialState,
  reducers: {
    initializeImages: (state, { payload }: PayloadAction<ArtOrder>) => {
      assert(state.artType === ArtType.Sticker, 'Unexpected art type');
      const maxImages = MAX_STICKERS;
      const truncated = Array.from(new Set([...state.order, ...payload])).slice(
        0,
        maxImages - state.order.length
      );

      for (const path of truncated) {
        if (!state.data[path]) {
          state.data[path] = {};
          state.order.push(path);
        }
      }
    },

    addImageData: (state, { payload }: PayloadAction<ArtImageData>) => {
      assert(state.artType === ArtType.Sticker, 'Unexpected art type');
      const maxByteSize = MAX_STICKER_BYTE_SIZE;
      if (payload.buffer.length > maxByteSize) {
        state.toasts.push({ key: 'StickerCreator--Toasts--tooLarge' });
        state.order = state.order.filter(path => path !== payload.path);
        delete state.data[payload.path];
        return;
      }

      const data = state.data[payload.path];
      if (!data || data.imageData) {
        return;
      }

      data.imageData = payload;

      const key = 'icu:StickerCreator--Toasts--imagesAdded';

      const toast = (() => {
        const oldToast = state.toasts.find(t => t.key === key);

        if (oldToast) {
          return oldToast;
        }

        const newToast = { key, subs: { count: '0' } };
        state.toasts.push(newToast);

        return newToast;
      })();

      const previousSub = toast?.subs?.count;
      if (toast && typeof previousSub === 'string') {
        const previousCount = parseInt(previousSub, 10);
        const newCount = Number.isFinite(previousCount) ? previousCount + 1 : 1;

        toast.subs = toast.subs || {};
        toast.subs.count = newCount.toString();
      }

      adjustCover(state);
    },

    removeImage: (state, { payload }: PayloadAction<ArtPath>) => {
      state.order = state.order.filter(path => path !== payload);
      delete state.data[payload];
      adjustCover(state);
    },

    setOrder: (state, { payload }: PayloadAction<ArtOrder>) => {
      state.order = payload;
    },

    setCover: (state, { payload }: PayloadAction<ArtImageData>) => {
      state.cover = payload;
    },

    resetCover: state => {
      adjustCover(state);
    },

    setEmoji: (state, { payload }: PayloadAction<SetEmojiPayload>) => {
      const data = state.data[payload.id];
      if (data) {
        data.emoji = payload.emoji;
      }
    },

    setEmojiName: (state, { payload }: PayloadAction<SetEmojiNamePayload>) => {
      const data = state.data[payload.id];
      if (!data) {
        return;
      }

      const newName = payload.name.replace(/[^a-zA-Z_]/g, '');
      if (data.emoji) {
        data.emoji.name = newName;
      } else {
        data.emoji = { name: newName, sheetX: -1, sheetY: -1 };
      }
    },

    setTitle: (state, { payload }: PayloadAction<string>) => {
      state.title = payload;
    },

    setAuthor: (state, { payload }: PayloadAction<string>) => {
      state.author = payload;
    },

    setPackMeta: (
      state,
      { payload: { packId, key } }: PayloadAction<SetPackMetaPayload>
    ) => {
      state.packId = packId;
      state.packKey = key;
    },

    addToast: (state, { payload: toast }: PayloadAction<StateToastData>) => {
      state.toasts = state.toasts.filter(({ key }) => key === toast.key);
      state.toasts.push(toast);
    },

    dismissToast: state => {
      state.toasts.pop();
    },

    resetStatus: state => {
      state.toasts = [];
    },

    reset: (_state, { payload: artType }: PayloadAction<ArtType>) => {
      return {
        ...initialState,
        artType,
      };
    },
  },
});

export const {
  addImageData,
  initializeImages,
  removeImage,
  setCover,
  setEmoji,
  setEmojiName,
  setOrder,
  setTitle,
  setAuthor,
  setPackMeta,
  addToast,
  dismissToast,
  reset,
  resetStatus,
} = artSlice.actions;
export default artSlice.reducer;
