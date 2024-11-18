// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import type { Middleware, Store, UnknownAction } from 'redux';
import { applyMiddleware, createStore as reduxCreateStore } from 'redux';

import promise from 'redux-promise-middleware';
import { thunk } from 'redux-thunk';
import { createLogger } from 'redux-logger';

import * as log from '../logging/log';
import type { StateType } from './reducer';
import { reducer } from './reducer';
import { dispatchItemsMiddleware } from '../shims/dispatchItemsMiddleware';
import { isOlderThan } from '../util/timestamp';
import { SECOND } from '../util/durations';
import { getEnvironment } from '../environment';

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Console {
    _log: Console['log'];
  }
}

const env = getEnvironment();

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
    if (action.type === 'calling/GROUP_CALL_AUDIO_LEVELS_CHANGE') {
      return false;
    }
    return true;
  },
});

const ACTION_COUNT_THRESHOLD = 25;
type ActionStats = {
  timestamp: number;
  names: Array<string>;
};
const actionStats: ActionStats = {
  timestamp: Date.now(),
  names: [],
};
export const actionRateLogger: Middleware = () => next => _action => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const action = _action as any as UnknownAction;
  const name = action.type;
  const lastTimestamp = actionStats.timestamp;
  let count = actionStats.names.length;

  if (isOlderThan(lastTimestamp, SECOND)) {
    if (count > 0) {
      actionStats.names = [];
    }
    actionStats.timestamp = Date.now();

    return next(action);
  }

  actionStats.names.push(name);
  count += 1;

  if (count >= ACTION_COUNT_THRESHOLD) {
    log.warn(
      `ActionRateLogger: got ${count} events since ${lastTimestamp}: ${actionStats.names.join(',')}`
    );

    actionStats.names = [];
    actionStats.timestamp = Date.now();
  }

  return next(action);
};

const middlewareList = [
  promise,
  thunk,
  dispatchItemsMiddleware,
  actionRateLogger,
  ...(env === 'production' ? [] : [logger]),
];

const enhancer = applyMiddleware(...middlewareList);

export const createStore = (
  initialState: Readonly<StateType>
): Store<StateType> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reduxCreateStore<any, any>(reducer, initialState, enhancer);
