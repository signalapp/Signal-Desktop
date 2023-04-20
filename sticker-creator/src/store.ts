// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { configureStore } from '@reduxjs/toolkit';

import artReducer from './slices/art';
import credentialsReducer from './slices/credentials';

export const store = configureStore({
  reducer: {
    art: artReducer,
    credentials: credentialsReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActionPaths: ['payload.buffer'],
        ignoredPaths: ['art.cover.buffer', /^art.data.*.imageData.buffer$/],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
