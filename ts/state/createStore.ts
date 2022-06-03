// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import type { Store } from 'redux';
import { applyMiddleware, createStore as reduxCreateStore } from 'redux';

import promise from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';

import type { StateType } from './reducer';
import { reducer } from './reducer';
import { dispatchItemsMiddleware } from '../shims/dispatchItemsMiddleware';

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
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
  dispatchItemsMiddleware,
  ...(env === 'production' ? [] : [logger]),
];

const enhancer = applyMiddleware(...middlewareList);

export const createStore = (
  initialState: Readonly<StateType>
): Store<StateType> => reduxCreateStore(reducer, initialState, enhancer);
