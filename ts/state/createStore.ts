import { createLogger } from 'redux-logger';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './reducer';
import { persistReducer } from 'redux-persist';
// tslint:disable-next-line: match-default-export-name
import promiseMiddleware from 'redux-promise-middleware';

// tslint:disable-next-line: no-submodule-imports match-default-export-name
import storage from 'redux-persist/lib/storage';
// @ts-ignore
const env = window.getEnvironment();

// So Redux logging doesn't go to disk, and so we can get colors/styles
const directConsole = {
  // @ts-ignore
  log: console._log,
  groupCollapsed: console.groupCollapsed,
  group: console.group,
  groupEnd: console.groupEnd,
  warn: console.warn,
  // tslint:disable-next-line no-console
  error: console.error,
};

const logger = createLogger({
  logger: directConsole,
});

export const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['userConfig'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Exclude logger if we're in production mode
const disableLogging = true; //; env === 'production' || true; // ALWAYS TURNED OFF
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
