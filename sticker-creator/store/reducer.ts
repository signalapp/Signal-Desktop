// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Reducer } from 'redux';
import { combineReducers } from 'redux';
import { reducer as stickers } from './ducks/stickers';

export const reducer = combineReducers({
  stickers,
});

export type AppState = typeof reducer extends Reducer<infer U> ? U : never;
