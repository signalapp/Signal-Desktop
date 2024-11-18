// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type { Middleware, UnknownAction } from 'redux';

import {
  COLORS_CHANGED,
  COLOR_SELECTED,
  SET_VOICE_NOTE_PLAYBACK_RATE,
} from '../state/ducks/conversations';

export const dispatchItemsMiddleware: Middleware =
  ({ getState }) =>
  next =>
  _action => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action = _action as any as UnknownAction;
    const result = next(action);
    if (
      action.type === 'items/PUT' ||
      action.type === 'items/PUT_EXTERNAL' ||
      action.type === 'items/REMOVE' ||
      action.type === 'items/REMOVE_EXTERNAL' ||
      action.type === 'items/RESET' ||
      action.type === COLOR_SELECTED ||
      action.type === COLORS_CHANGED ||
      action.type === SET_VOICE_NOTE_PLAYBACK_RATE
    ) {
      ipcRenderer.send('preferences-changed', getState().items);
    }
    return result;
  };
