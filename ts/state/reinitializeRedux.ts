// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UnknownAction } from 'redux';

import * as log from '../logging/log';
import { getInitialState } from './getInitialState';
import { reducer as normalReducer } from './reducer';

import type { StateType } from './reducer';
import type { ReduxInitData } from './initializeRedux';

const REPLACE_STATE = 'resetReducer/REPLACE';

export function reinitializeRedux(options: ReduxInitData): void {
  const logId = 'initializeRedux';
  const existingState = window.reduxStore.getState();
  const newInitialState = getInitialState(options, existingState);

  const resetReducer = (
    state: StateType | undefined,
    action: UnknownAction
  ): StateType => {
    if (state == null) {
      log.info(
        `${logId}/resetReducer: Got null incoming state, returning newInitialState`
      );
      return newInitialState;
    }

    const { type } = action;
    if (type === REPLACE_STATE) {
      log.info(
        `${logId}/resetReducer: Got REPLACE_STATE action, returning newInitialState`
      );
      return newInitialState;
    }

    log.info(
      `${logId}/resetReducer: Got action with type ${type}, returning original state`
    );
    return state;
  };

  log.info(`${logId}: installing resetReducer`);
  window.reduxStore.replaceReducer(resetReducer);

  log.info(`${logId}: dispatching REPLACE_STATE event`);
  window.reduxStore.dispatch({
    type: REPLACE_STATE,
  });

  log.info(`${logId}: restoring original reducer`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window.reduxStore.replaceReducer(normalReducer as any);

  log.info(`${logId}: complete!`);
}
