import promise from 'redux-promise-middleware';
import { createLogger } from 'redux-logger';
import { configureStore } from '@reduxjs/toolkit';
import { reducer as allReducers } from './reducer';
import { persistReducer } from 'redux-persist';

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
  whitelist: ['userConfig']
};

const persistedReducer = persistReducer(persistConfig, allReducers);

// Exclude logger if we're in production mode
const disableLogging = env === 'production' || true; // ALWAYS TURNED OFF
const middlewareList = disableLogging ? [promise] : [promise, logger];

export const createStore = (initialState: any) =>
  configureStore({
    reducer: persistedReducer,
    preloadedState: initialState,
    middleware: (getDefaultMiddleware: any) => getDefaultMiddleware().concat(middlewareList),
  });
