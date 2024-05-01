import { createSelector } from '@reduxjs/toolkit';

import { LeftOverlayMode, SectionStateType, SectionType } from '../ducks/section';
import { StateType } from '../reducer';
import type { SessionSettingCategory } from '../../types/ReduxTypes';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getFocusedSection = createSelector(
  getSection,
  (state: SectionStateType): SectionType => state.focusedSection
);

export const getIsMessageSection = (state: StateType) => {
  return state.section.focusedSection === SectionType.Message;
};

export const getFocusedSettingsSection = createSelector(
  getSection,
  (state: SectionStateType): SessionSettingCategory | undefined => state.focusedSettingsSection
);

export const getIsAppFocused = createSelector(
  getSection,
  (state: SectionStateType): boolean => state.isAppFocused
);

export const getLeftOverlayMode = createSelector(
  getSection,
  (state: SectionStateType): LeftOverlayMode | undefined => state.leftOverlayMode
);

export const getRightOverlayMode = (state: StateType) => {
  return state.section.rightOverlayMode;
};

export const getIsMessageRequestOverlayShown = (state: StateType) => {
  const focusedSection = getFocusedSection(state);
  const leftOverlayMode = getLeftOverlayMode(state);

  return focusedSection === SectionType.Message && leftOverlayMode === 'message-requests';
};
