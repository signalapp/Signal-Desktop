// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Reducer } from 'redux';
import { combineReducers } from 'redux';
// eslint-disable-next-line import/no-cycle
import { reducer as stickers } from './ducks/stickers';

export const reducer = combineReducers({
  stickers,
});

export type AppState = typeof reducer extends Reducer<infer U> ? U : never;
