// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Middleware, Store, UnknownAction } from 'redux';
import { applyMiddleware, createStore as reduxCreateStore } from 'redux';

import promise from 'redux-promise-middleware';
import { thunk } from 'redux-thunk';
import { createLogger as createReduxLogger } from 'redux-logger';

import { createLogger } from '../logging/log.std.js';
import type { StateType } from './reducer.preload.js';
import { reducer } from './reducer.preload.js';
import { dispatchItemsMiddleware } from '../shims/dispatchItemsMiddleware.preload.js';
import { isOlderThan } from '../util/timestamp.std.js';
import { SECOND } from '../util/durations/index.std.js';
import { getEnvironment } from '../environment.std.js';

const log = createLogger('createStore');

const env = getEnvironment();

const logger = createReduxLogger({
  predicate: (_getState, action) => {
    if (action.type === 'network/CHECK_NETWORK_STATUS') {
      return false;
    }
    if (action.type === 'calling/GROUP_CALL_AUDIO_LEVELS_CHANGE') {
      return false;
    }
    if (action.type === 'calling/DIRECT_CALL_AUDIO_LEVELS_CHANGE') {
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
