// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import {
  applyMiddleware,
  createStore as reduxCreateStore,
  DeepPartial,
  Store,
} from 'redux';

import promise from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';

import { reducer, StateType } from './reducer';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

const middlewareList = [
  promise,
  thunk,
  ...(env === 'production' ? [] : [logger]),
];

const enhancer = applyMiddleware(...middlewareList);

export const createStore = (initialState: DeepPartial<StateType>): Store =>
  reduxCreateStore(reducer, initialState, enhancer);
