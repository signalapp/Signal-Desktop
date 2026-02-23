// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { createLogger } from '../../logging/log.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { beforeNavigateService } from '../../services/BeforeNavigate.std.js';
import { NavTab, SettingsPage } from '../../types/Nav.std.js';
import {
  getActivePanel,
  getPanels,
  getSelectedLocation,
} from '../selectors/nav.std.js';

import type { PanelArgsType } from '../../types/Panels.std.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import type { StateType as RootStateType } from '../reducer.preload.js';
import type { Location, PanelInfo } from '../../types/Nav.std.js';

const log = createLogger('nav');

// Types

function printLocation(location: Location): string {
  if (location.tab === NavTab.Settings) {
    if (location.details.page === SettingsPage.Profile) {
      return `${location.tab}/${location.details.page}/${location.details.state}`;
    }
    return `${location.tab}/${location.details.page}`;
  }

  return `${location.tab}`;
}

function getDefaultPanels(): PanelInfo {
  return {
    isAnimating: false,
    wasAnimated: false,
    direction: undefined,
    stack: [],
    watermark: -1,
  };
}

// State

export type NavStateType = ReadonlyDeep<{
  selectedLocation: Location;
  lastChatTabLocation?: Location;
}>;

// Actions

export const CHANGE_LOCATION = 'nav/CHANGE_LOCATION';
const PANEL_ANIMATION_DONE = 'nav/PANEL_ANIMATION_DONE';
const PANEL_ANIMATION_STARTED = 'nav/PANEL_ANIMATION_STARTED';

export type ChangeLocationAction = ReadonlyDeep<{
  type: typeof CHANGE_LOCATION;
  payload: { selectedLocation: Location };
}>;
type PanelAnimationDoneActionType = ReadonlyDeep<{
  type: typeof PANEL_ANIMATION_DONE;
  payload: null;
}>;
type PanelAnimationStartedActionType = ReadonlyDeep<{
  type: typeof PANEL_ANIMATION_STARTED;
  payload: null;
}>;

export type NavActionType = ReadonlyDeep<
  | ChangeLocationAction
  | PanelAnimationDoneActionType
  | PanelAnimationStartedActionType
>;

// Action Creators

export function changeLocation(
  newLocation: Location
): ThunkAction<void, RootStateType, unknown, NavActionType> {
  return async (dispatch, getState) => {
    const existingLocation = getState().nav.selectedLocation;
    const logId = `changeLocation/${printLocation(newLocation)}`;

    const needToCancel = await beforeNavigateService.shouldCancelNavigation({
      context: logId,
      existingLocation,
      newLocation,
    });

    if (needToCancel) {
      log.info(`${logId}: Canceling navigation`);
      return;
    }

    dispatch({
      type: CHANGE_LOCATION,
      payload: { selectedLocation: newLocation },
    });
  };
}

function panelAnimationStarted(): PanelAnimationStartedActionType {
  return {
    type: PANEL_ANIMATION_STARTED,
    payload: null,
  };
}

function panelAnimationDone(): PanelAnimationDoneActionType {
  return {
    type: PANEL_ANIMATION_DONE,
    payload: null,
  };
}

function pushPanelForConversation(
  panel: PanelArgsType
): ThunkAction<void, RootStateType, unknown, ChangeLocationAction> {
  return async (dispatch, getState) => {
    const state = getState();
    const existingLocation = getSelectedLocation(state);

    const logId = `pushPanelForConversation/${panel.type}`;

    if (existingLocation.tab !== NavTab.Chats) {
      log.warn(`${logId}: Not on Chats tab; on ${existingLocation.tab} tab!`);
      return;
    }

    const activePanel = getActivePanel(getState());
    if (panel.type === activePanel?.type && isEqual(panel, activePanel)) {
      log.warn(`${logId}: Already on ${panel.type} panel!`);
      return;
    }

    const panels = getPanels(state) || getDefaultPanels();
    const currentStack = panels.stack;
    const watermark = Math.min(panels.watermark + 1, currentStack.length);
    const stack = [...currentStack.slice(0, watermark), panel];

    const newPanels = {
      isAnimating: false,
      wasAnimated: false,
      direction: 'push' as const,
      stack,
      watermark,
    };

    const newLocation = {
      ...existingLocation,
      details: {
        ...existingLocation.details,
        panels: newPanels,
      },
    };

    const needToCancel = await beforeNavigateService.shouldCancelNavigation({
      context: logId,
      existingLocation,
      newLocation,
    });

    if (needToCancel) {
      log.info(`${logId}: Canceling navigation`);
      return;
    }

    dispatch({
      type: CHANGE_LOCATION,
      payload: { selectedLocation: newLocation },
    });
  };
}

export type PopPanelForConversationActionType = ReadonlyDeep<() => unknown>;

export function popPanelForConversation(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ChangeLocationAction
> {
  return async (dispatch, getState) => {
    const state = getState();
    const panels = getPanels(state);
    const existingLocation = getSelectedLocation(state);

    const logId = `popPanelForConversation/length=${panels?.stack.length}`;

    if (existingLocation.tab !== NavTab.Chats) {
      log.warn(`${logId}: Not on Chats tab; on ${existingLocation.tab} tab!`);
      return;
    }

    if (!panels || panels.stack.length === 0) {
      log.warn(`${logId}: No panel to pop!`);
      return;
    }

    if (panels.watermark === -1) {
      log.warn(`${logId}: Watermark is already -1`);
      return;
    }

    const poppedPanel = panels.stack[panels.watermark];
    if (!poppedPanel) {
      log.warn(`${logId}: No panel found at watermark=${panels.watermark}`);
      return;
    }

    const watermark = Math.max(panels.watermark - 1, -1);

    const newPanels = {
      isAnimating: false,
      wasAnimated: false,
      direction: 'pop' as const,
      stack: panels.stack,
      watermark,
    };

    const newLocation = {
      ...existingLocation,
      details: {
        ...existingLocation.details,
        panels: newPanels,
      },
    };

    const needToCancel = await beforeNavigateService.shouldCancelNavigation({
      context: logId,
      existingLocation,
      newLocation,
    });

    if (needToCancel) {
      log.info(`${logId}: Canceling navigation`);
      return;
    }

    dispatch({
      type: CHANGE_LOCATION,
      payload: { selectedLocation: newLocation },
    });
  };
}

export const actions = {
  changeLocation,
  panelAnimationDone,
  panelAnimationStarted,
  popPanelForConversation,
  pushPanelForConversation,
};

export const useNavActions = (): BoundActionCreatorsMapObject<typeof actions> =>
  useBoundActions(actions);

// Reducer

export function getEmptyState(): NavStateType {
  return {
    selectedLocation: {
      tab: NavTab.Chats,
      details: {
        conversationId: undefined,
      },
    },
  };
}

export function reducer(
  state: Readonly<NavStateType> = getEmptyState(),
  action: Readonly<NavActionType>
): NavStateType {
  if (action.type === CHANGE_LOCATION) {
    let { selectedLocation } = action.payload;
    let { lastChatTabLocation } = state;

    // Save last Chats Tab location if switching away from Chats Tab
    if (
      selectedLocation.tab !== NavTab.Chats &&
      state.selectedLocation.tab === NavTab.Chats
    ) {
      lastChatTabLocation = state.selectedLocation;
    }

    // Restore last Chats Tab location if:
    //   - switching back to Chats Tab
    //   - conversationId not set
    if (
      selectedLocation.tab === NavTab.Chats &&
      !selectedLocation.details.conversationId &&
      state.selectedLocation.tab !== NavTab.Chats &&
      state.lastChatTabLocation
    ) {
      selectedLocation = state.lastChatTabLocation;
    }

    return {
      ...state,
      selectedLocation,
      lastChatTabLocation,
    };
  }

  if (action.type === PANEL_ANIMATION_STARTED) {
    if (state.selectedLocation.tab !== NavTab.Chats) {
      return state;
    }
    if (!state.selectedLocation.details.panels) {
      return state;
    }

    return {
      ...state,
      selectedLocation: {
        ...state.selectedLocation,
        details: {
          ...state.selectedLocation.details,
          panels: {
            ...state.selectedLocation.details.panels,
            isAnimating: true,
          },
        },
      },
    };
  }

  if (action.type === PANEL_ANIMATION_DONE) {
    if (state.selectedLocation.tab !== NavTab.Chats) {
      return state;
    }
    if (!state.selectedLocation.details.panels) {
      return state;
    }

    return {
      ...state,
      selectedLocation: {
        ...state.selectedLocation,
        details: {
          ...state.selectedLocation.details,
          panels: {
            ...state.selectedLocation.details.panels,
            isAnimating: false,
            wasAnimated: true,
          },
        },
      },
    };
  }

  return state;
}
