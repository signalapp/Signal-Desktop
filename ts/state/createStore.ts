/* eslint-disable no-console */
import storage from 'redux-persist/lib/storage';

import { configureStore } from '@reduxjs/toolkit';
import { createLogger } from 'redux-logger';

import { persistReducer } from 'redux-persist';

import promiseMiddleware from 'redux-promise-middleware';
import { rootReducer } from './reducer';

// So Redux logging doesn't go to disk, and so we can get colors/styles
const directConsole = {
  log: (console as any)._log,
  groupCollapsed: console.groupCollapsed,
  group: console.group,
  groupEnd: console.groupEnd,
  warn: console.warn,
  error: console.error,
};

const logger = createLogger({
  logger: directConsole,
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['userConfig'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Exclude logger if we're in production mode
const disableLogging = true;
const middlewareList = disableLogging ? [promiseMiddleware] : [logger, promiseMiddleware];

export const createStore = (initialState: any) =>
  configureStore({
    reducer: persistedReducer,
    preloadedState: initialState,
    middleware: (getDefaultMiddleware: any) =>
      getDefaultMiddleware({
        serializableCheck: true,
        immutableCheck: true,
      }).concat(middlewareList),
  });
