// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { NavTab } from '../../types/Nav.std.js';

import type { PanelArgsType } from '../../types/Panels.std.js';
import type { Location, PanelInfo } from '../../types/Nav.std.js';
import type { StateType } from '../reducer.preload.js';
import type { NavStateType } from '../ducks/nav.std.js';

function getNav(state: StateType): NavStateType {
  return state.nav;
}

export const getSelectedNavTab = createSelector(getNav, nav => {
  return nav.selectedLocation.tab;
});

export const getSelectedLocation = createSelector(getNav, nav => {
  return nav.selectedLocation;
});

export const getSelectedConversationId = createSelector(
  getSelectedLocation,
  (selectedLocation: Location): string | undefined => {
    if (selectedLocation.tab !== NavTab.Chats) {
      return;
    }

    return selectedLocation.details.conversationId;
  }
);

export const getPanels = createSelector(
  getSelectedLocation,
  (selectedLocation: Location): PanelInfo | undefined => {
    if (selectedLocation.tab !== NavTab.Chats) {
      return;
    }

    return selectedLocation.details.panels;
  }
);
export const getHasPanelOpen = createSelector(getPanels, (panels): boolean => {
  return Boolean(panels && panels.watermark > 0);
});

export const getActivePanel = createSelector(
  getPanels,
  (panels: PanelInfo | undefined): PanelArgsType | undefined => {
    if (!panels) {
      return undefined;
    }

    return panels.stack[panels.watermark];
  }
);

type PanelInformationType = {
  currPanel: PanelArgsType | undefined;
  direction: 'push' | 'pop';
  prevPanel: PanelArgsType | undefined;
};

export const getPanelInformation = createSelector(
  getPanels,
  getActivePanel,
  (panels, currPanel): PanelInformationType | undefined => {
    if (!panels) {
      return;
    }

    const { direction, watermark } = panels;

    if (!direction) {
      return;
    }

    const watermarkDirection =
      direction === 'push' ? watermark - 1 : watermark + 1;
    const prevPanel = panels.stack[watermarkDirection];

    return {
      currPanel,
      direction,
      prevPanel,
    };
  }
);

export const getIsPanelAnimating = createSelector(
  getPanels,
  (panels): boolean => {
    return Boolean(panels?.isAnimating);
  }
);

export const getWasPanelAnimated = createSelector(
  getPanels,
  (panels): boolean => {
    return Boolean(panels?.wasAnimated);
  }
);
