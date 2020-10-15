/* eslint-disable no-console */

import {
  applyMiddleware,
  createStore as reduxCreateStore,
  DeepPartial,
  Store,
} from 'redux';

import promise from 'redux-promise-middleware';
import { createLogger } from 'redux-logger';

import { reducer, StateType } from './reducer';

declare global {
  interface Console {
    _log: Console['log'];
  }
}

const env = window.getEnvironment();

// So Redux logging doesn't go to disk, and so we can get colors/styles
const directConsole = {
  log: console._log,
  groupCollapsed: console.groupCollapsed,
  group: console.group,
  groupEnd: console.groupEnd,
  warn: console.warn,
  error: console.error,
};

const logger = createLogger({
  logger: directConsole,
});

// Exclude logger if we're in production mode
const middlewareList = env === 'production' ? [promise] : [promise, logger];

const enhancer = applyMiddleware(...middlewareList);

export const createStore = (initialState: DeepPartial<StateType>): Store =>
  reduxCreateStore(reducer, initialState, enhancer);
