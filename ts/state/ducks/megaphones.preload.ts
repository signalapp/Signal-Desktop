// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import type { StateType as RootStateType } from '../reducer.preload.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { createLogger } from '../../logging/log.std.js';
import * as Errors from '../../types/errors.std.js';
import { DataWriter } from '../../sql/Client.preload.js';
import type {
  MegaphoneCtaId,
  RemoteMegaphoneId,
  VisibleRemoteMegaphoneType,
} from '../../types/Megaphone.std.js';
import type { ChangeLocationAction } from './nav.std.js';
import { actions as navActions } from './nav.std.js';
import { NavTab, SettingsPage } from '../../types/Nav.std.js';
import { isTestMegaphoneId } from '../../util/getTestMegaphone.std.js';

const log = createLogger('megaphones');

// State

export type MegaphonesStateType = ReadonlyDeep<{
  visibleMegaphones: ReadonlyArray<VisibleRemoteMegaphoneType>;
}>;

export function getEmptyState(): MegaphonesStateType {
  return {
    visibleMegaphones: [],
  };
}

export function getInitialMegaphonesState(): MegaphonesStateType {
  // Visible megaphones are loaded by the megaphone service
  return {
    visibleMegaphones: [],
  };
}

// Actions

export const ADD_VISIBLE_MEGAPHONE = 'megaphones/ADD_VISIBLE_MEGAPHONE';
export const REMOVE_VISIBLE_MEGAPHONE = 'megaphones/REMOVE_VISIBLE_MEGAPHONE';

export type AddVisibleMegaphoneAction = ReadonlyDeep<{
  type: typeof ADD_VISIBLE_MEGAPHONE;
  payload: { megaphone: VisibleRemoteMegaphoneType };
}>;

export type RemoveVisibleMegaphoneAction = ReadonlyDeep<{
  type: typeof REMOVE_VISIBLE_MEGAPHONE;
  payload: { megaphoneId: RemoteMegaphoneId };
}>;

export type MegaphoneAction = ReadonlyDeep<
  AddVisibleMegaphoneAction | RemoveVisibleMegaphoneAction
>;

// Action Creators

function addVisibleMegaphone(
  megaphone: VisibleRemoteMegaphoneType
): AddVisibleMegaphoneAction {
  return {
    type: ADD_VISIBLE_MEGAPHONE,
    payload: { megaphone },
  };
}

function removeVisibleMegaphone(
  megaphoneId: RemoteMegaphoneId
): RemoveVisibleMegaphoneAction {
  return {
    type: REMOVE_VISIBLE_MEGAPHONE,
    payload: { megaphoneId },
  };
}

function interactWithMegaphone(
  megaphoneId: RemoteMegaphoneId,
  ctaId: MegaphoneCtaId
): ThunkAction<
  void,
  RootStateType,
  unknown,
  RemoveVisibleMegaphoneAction | ChangeLocationAction
> {
  return async dispatch => {
    const isTest = isTestMegaphoneId(megaphoneId);

    if (ctaId === 'donate' || ctaId === 'finish') {
      try {
        log.info(`Finishing megaphone ${megaphoneId}, ctaId=${ctaId}`);
        if (!isTest) {
          await DataWriter.finishMegaphone(megaphoneId);
        }
      } catch (error) {
        log.error(
          `Failed to finish megaphone ${megaphoneId}`,
          Errors.toLogFormat(error)
        );
      }
    }

    if (ctaId === 'donate') {
      dispatch(
        navActions.changeLocation({
          tab: NavTab.Settings,
          details: {
            page: SettingsPage.DonationsDonateFlow,
          },
        })
      );
    } else if (ctaId === 'snooze') {
      try {
        log.info(`Snoozing megaphone ${megaphoneId}`);
        if (!isTest) {
          await DataWriter.snoozeMegaphone(megaphoneId);
        }
      } catch (error) {
        log.error(
          `Failed to snooze megaphone ${megaphoneId}`,
          Errors.toLogFormat(error)
        );
      }
    }

    dispatch({
      type: REMOVE_VISIBLE_MEGAPHONE,
      payload: { megaphoneId },
    });
  };
}

export const actions = {
  addVisibleMegaphone,
  removeVisibleMegaphone,
  interactWithMegaphone,
};

export const useMegaphonesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function reducer(
  state: Readonly<MegaphonesStateType> = getEmptyState(),
  action: Readonly<MegaphoneAction>
): MegaphonesStateType {
  if (action.type === ADD_VISIBLE_MEGAPHONE) {
    return {
      ...state,
      visibleMegaphones: [...state.visibleMegaphones, action.payload.megaphone],
    };
  }

  if (action.type === REMOVE_VISIBLE_MEGAPHONE) {
    const { megaphoneId } = action.payload;
    const visibleMegaphones = state.visibleMegaphones.filter(
      megaphone => megaphone.id !== megaphoneId
    );
    return {
      ...state,
      visibleMegaphones,
    };
  }

  return state;
}
