// Copyright 2019-2021 Signal Messenger, LLC
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
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-unused-vars
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
  predicate: (_getState, action) => {
    if (action.type === 'network/CHECK_NETWORK_STATUS') {
      return false;
    }
    return true;
  },
});

const middlewareList = [
  promise,
  thunk,
  ...(env === 'production' ? [] : [logger]),
];

const enhancer = applyMiddleware(...middlewareList);

export const createStore = (
  initialState: DeepPartial<StateType>
): Store<StateType> => reduxCreateStore(reducer, initialState, enhancer);
